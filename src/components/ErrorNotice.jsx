import { Link } from "react-router-dom";
import { Ban, Clock, RefreshCw, WifiOff } from "lucide-react";
import useCountdown from "../hooks/useCountdown";
import { describeError, formatWait } from "../lib/apiErrors";
import AiBlockedNotice from "./AiBlockedNotice";
import UpgradePrompt from "./UpgradePrompt";

/**
 * The inline state for a refused request, in place of a toast that vanishes. What it shows follows the kind of
 * refusal (see describeError), and always starts from the server's own sentence:
 *   rate_limited / login_locked  how long to wait, counting down, with the retry enabled when it reaches zero
 *   quota                        out of credit: "Add credit" (and the plans, if the server offers them)
 *   plan_gate                    the existing upgrade prompt
 *   conflict                     "this record changed elsewhere" with a Refresh action
 *   trial_ended / network / other  the message, with a retry where there is one
 *
 *   <ErrorNotice error={error} onRetry={submit} onRefresh={reload} onDismiss={() => setError(null)} />
 */
export default function ErrorNotice({ error, onRetry, onRefresh, onDismiss, className = "" }) {
  const { kind, message, retryAfter } = describeError(error);
  const left = useCountdown(kind === "rate_limited" || kind === "login_locked" ? retryAfter : 0);

  if (!error) return null;
  if (kind === "plan_gate") return <UpgradePrompt message={message} />;
  // Out of credit is the same inline state the AI usage view uses: the server's sentence and the ways out it names (AI-07); adding credit is always offered, so a refusal never leaves a dead end.
  if (kind === "quota")
    return (
      <AiBlockedNotice
        message={message}
        actions={["top_up", ...(error?.data?.actions || [])]}
        onDismiss={onDismiss}
        className={className}
      />
    );

  const waiting = (kind === "rate_limited" || kind === "login_locked") && retryAfter && left > 0;
  const Icon = kind === "network" ? WifiOff : kind === "rate_limited" || kind === "login_locked" ? Clock : Ban;
  const button = "rounded-md px-3 py-1 text-xs font-semibold";

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-av-red/40 bg-av-red/10 px-3 py-2.5 text-xs text-av-red ${className}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{waiting ? waitingMessage(kind, left, message) : message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {kind === "trial_ended" && (
            <Link to="/subscribe" className={`${button} bg-navy text-white hover:bg-navy-light`}>
              Subscribe
            </Link>
          )}
          {kind === "conflict" && (
            <button
              type="button"
              onClick={onRefresh || (() => window.location.reload())}
              className={`${button} bg-navy text-white hover:bg-navy-light`}
            >
              <RefreshCw size={12} className="mr-1 inline" />
              Refresh
            </button>
          )}
          {onRetry && ["rate_limited", "login_locked", "network", "other"].includes(kind) && (
            <button
              type="button"
              onClick={onRetry}
              disabled={waiting}
              className={`${button} bg-navy text-white hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Try again
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="font-semibold underline">
          Dismiss
        </button>
      )}
    </div>
  );
}

// While counting down, the live number replaces the one in the server's sentence; a custom server sentence is kept as it is.
function waitingMessage(kind, left, message) {
  if (!/^Too many (requests|attempts)\./.test(message)) return message;
  return `${kind === "login_locked" ? "Too many attempts." : "Too many requests."} Try again in ${formatWait(left)}.`;
}
