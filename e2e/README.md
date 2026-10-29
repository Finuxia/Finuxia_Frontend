# End-to-end smoke suite (TEST-06, SCRUM-58)

Browser journeys through the real application and a real backend. Not unit tests: nothing here is
mocked, which is the point — these catch the things that only break when the pieces are joined
together.

## Running it

Two processes, in two terminals. The backend first:

```bash
# in Finuxia_Backend
export FINUXIA_DB_PORT=55432          # 5433-5435 are often taken by other projects
docker compose up e2e-api             # http://127.0.0.1:8000, writes emails to ./.e2e-mail
```

Then the suite, which starts the Vite dev server itself:

```bash
# in Finuxia_Frontend
E2E_MAIL_DIR=../Finuxia_Backend/.e2e-mail npm run test:e2e
```

Useful variants:

```bash
npm run test:e2e -- --headed        # watch it
npm run test:e2e -- --debug         # step through
npm run test:e2e -- account         # one file
npx playwright show-report          # after a failure
```

If port 8000 is taken on your machine, give the API another one and tell the suite:

```bash
FINUXIA_E2E_API_PORT=8010 docker compose up e2e-api                       # in Finuxia_Backend
VITE_API_URL=http://localhost:8010 E2E_API_URL=http://localhost:8010 \
  E2E_MAIL_DIR=../Finuxia_Backend/.e2e-mail npm run test:e2e            # in Finuxia_Frontend
```

`VITE_API_URL` is what the dev server the suite starts calls; `E2E_API_URL` is what `support/api.js`
calls when a journey sets something up through the API.

## Setting things up through the API

A journey drives through the browser what it is about, and may prepare the rest through the same
public API the web app calls, as the signed-in user (`support/api.js`: the browser context's cookies
plus the `X-CSRF-Token` header). The booking journey creates the link and the working hours that way;
the AI journey changes plan that way. Nothing in the backend exists for the tests.

## The AI provider

`e2e-api` points `AI_BASE_URL` at `e2e-ai-stub` (`Finuxia_Backend/scripts/e2e_ai_stub.py`), an
OpenAI-compatible stand-in on the compose network. Everything else is real: the plan's AI grant, the
hold on the wallet, settling, the 402 and the blocked notice. `e2e-api` also sets
`AI_CHARGE_MARKUP_PERCENT=300000`, so one suggestion costs about $1.50-$1.80 and the $10 every account
starts with runs out after five or six calls instead of thousands. The AI journey refuses to run
against anything but a local target, because elsewhere it would spend real money.

## Why there is a separate backend service for this

Two journeys need a link that only ever arrives by email — confirming an address, and resetting a
password. A browser cannot read an inbox.

The tempting shortcut is a test-only HTTP endpoint that returns the token for an address. That is an
endpoint which hands out account-takeover tokens, living in production code, guarded by a flag. It
would be one careless change away from being reachable for real, and it is not worth that for a test
convenience.

So `e2e-api` runs with Django's own **file-based** email backend and writes each message into
`Finuxia_Backend/.e2e-mail`, which `support/mail.js` reads. No application code exists for the
benefit of the tests and nothing new is exposed over HTTP. SEC-14 made `EMAIL_BACKEND` an explicit
opt-in that overrides the `DEBUG` default; this is that mechanism used as intended.

Without `E2E_MAIL_DIR` those journeys **skip** rather than pass, so a misconfigured run cannot look
like a green one.

## Where it is allowed to run

These journeys register accounts and write client records. `support/target.js` has two gates:

1. an **allowlist** — local addresses, plus anything named in `E2E_ALLOWED_HOSTS`, so running against
   a remote environment is a deliberate act;
2. a **denylist** the allowlist cannot override — the hostnames that serve real users are refused
   even if someone adds them to `E2E_ALLOWED_HOSTS`, because the realistic mistake is not inventing
   a hostname, it is pasting one from a runbook into the wrong variable.

The check runs when the Playwright config loads, so a bad target fails before a browser starts
rather than after it has created an account.

```bash
# a deployed environment that holds no real data
E2E_ALLOWED_HOSTS=finuxia-staging.example.com \
E2E_BASE_URL=https://finuxia-staging.example.com npm run test:e2e
```

Against a remote target the mail-reading journeys skip, because the backend writes its messages on
its own disk.

## Two traps worth knowing before writing another journey

**Unique email addresses must not use `+tag`.** The backend canonicalises a mailbox by lower-casing
it and stripping `+tag` and Gmail dots before deciding whether it has already had a free trial
(`canonical_mailbox`, and DATA-07 which hashes that form). So every `e2e+anything@example.com` is one
mailbox: the first run would get a trial and pass, and every run after it would register an account
with no trial, land on the subscribe page instead of the application, and fail nowhere near the
cause. `uniqueEmail()` puts the stamp in the local part for this reason. It cost an afternoon to
find once.

**The journeys share one address** (the Docker gateway), so anything the backend limits per address
is shared by all of them. That is how TEST-06 found a real bug: every signed-out page load asks
`/api/auth/refresh` whether it has a session, and with no session it failed the CSRF check and counted
as a failed sign-in attempt. After about 30 signed-out page loads a minute, sign-in, verification and
reset links from that address were refused for everyone (an office, a VPN). Fixed in the backend; if
the journeys start failing with 429s again, look at the per-address limits first.

**No fixed waits, ever.** `retries` is 0 on purpose, because this story's criteria say flaky tests
are fixed or deleted rather than retried until they pass — and a retry turns a real intermittent bug
into a green run that tells you nothing. Every wait in here waits for a condition. The project has
already paid for this lesson elsewhere: a `sleep(2.2)` in the AI concurrency tests failed once under
load and took three full suite runs plus a diagnostic to prove it was the sleep and not a defect.

## Selectors

By **label** and by **role**, never by CSS class. The classes are Tailwind utility strings that
change whenever the design does, and a suite that fails on a restyle teaches people to ignore it. A
label changing is a real change to what the user sees, and a test noticing that is the test working.

The account menu is found by its name ("Account menu for <name>") and its entries by role
`menuitem`, which FE-05 (SCRUM-48) gave them. Until TEST-06's second batch `signOut` still looked for a
*button* named "Log out", so every journey that signs out timed out after FE-05 landed.

## What is here, and what is not

| Journey | State |
|---|---|
| register → confirm → sign in → create a client → sign out → sign back in | **done** |
| forgot password → reset → old password dead, new one works, link not reusable | **done** |
| public booking link → pick a slot → submit → advisor approves (`booking.spec.js`) | **done** |
| subscribe → pay with a test card → entitlement granted | not yet, deliberately — see below |
| use an AI feature until the wallet is empty → blocked state → add credit → works again (`ai-quota.spec.js`) | **done**, local only |
| import a real spreadsheet → row counts match | not yet; needs the fixture from TEST-08 (SCRUM-86) |

**The payment journey is last on purpose.** BIL-20 (SCRUM-108) walks a real Stripe sandbox checkout
by hand first and captures what the provider actually sends. Automating it before anyone has seen it
work would encode our assumptions about Stripe rather than Stripe's behaviour — which is the exact
mistake TEST-04 was raised to fix, where a hand-written fixture contained a field the provider does
not send and the test passed anyway.

Still outstanding from the story: running in CI against a deployed environment and gating promotion.
That needs OPS-12 (SCRUM-112) to exist first.
