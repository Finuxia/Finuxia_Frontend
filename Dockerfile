# --- build stage: compile the Vite app ---
# Node 22 to match .github/workflows/ci.yml and .nvmrc. CI is the only place the 867 tests actually
# run, so building the shipped artifact on a different major version means production runs a
# toolchain nothing has been tested against — the same mismatch the backend had with Postgres.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# `npm ci` installs exactly what package-lock.json pins (reproducible builds).
RUN npm ci
COPY . .

# The commit being built, passed in by the deployment workflow as --build-arg GIT_SHA=$GITHUB_SHA.
#
# It has to arrive as a BUILD argument because the value is compiled INTO the bundle: Vite inlines
# import.meta.env at build time, so a runtime environment variable on Cloud Run would never reach
# the browser. That is also why it cannot live in the committed .env.production.
#
# Appended to .env.production because that is the route verified to work: a build with
# GIT_SHA=<sha> puts the value in .env.production, and the full SHA then appears in the built
# bundle. (It lands in assets/Footer-*.js, not assets/index-*.js — Footer gets its own chunk, which
# is worth knowing before concluding from a narrow grep that it is missing.)
#
# An `ENV VITE_SENTRY_RELEASE=$GIT_SHA` line was tried first; the probe used to judge it only
# searched index-*.js, so whether that form works is genuinely unknown rather than disproven. No
# claim either way — this form is tested, so this form is used.
#
# Defaults to empty, so a plain `docker build` with no argument still works and the footer shows no
# version at all. The guard matters: appending an empty value would write
# `VITE_SENTRY_RELEASE=` and leave Sentry with an empty release rather than no release.
ARG GIT_SHA=""
RUN if [ -n "$GIT_SHA" ]; then printf '\nVITE_SENTRY_RELEASE=%s\n' "$GIT_SHA" >> .env.production; fi

# Vite reads .env.production for VITE_API_URL, and now for VITE_SENTRY_RELEASE too.
RUN npm run build

# --- serve stage: static files via nginx on Cloud Run's port 8080 ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Not into conf.d/: everything matching conf.d/*.conf is auto-loaded as top-level configuration,
# and this is a fragment meant to be `include`d from inside a server block.
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
