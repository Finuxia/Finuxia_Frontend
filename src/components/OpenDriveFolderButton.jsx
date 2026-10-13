import { useState } from "react";
import { FolderOpen, ExternalLink, HardDrive, X, Link2, AlertTriangle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useToast } from "../context/ToastContext";

/**
 * Opens (finding-or-creating, idempotently) a client's Google Drive folder.
 * Disabled while in flight so a double-click can't trigger two requests —
 * the backend's own unique-constraint find-or-create is the real guard, this
 * just avoids the obvious accidental double-fire.
 *
 * If Drive isn't connected yet, this offers to connect right here (a modal),
 * rather than sending the advisor off to the Profile page to figure it out —
 * connecting redirects back to this same page when it's done.
 */
export default function OpenDriveFolderButton({ clientId, clientName }) {
  const [loading, setLoading] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const [prompt, setPrompt] = useState(null); // null | "connect" | "not_configured"
  const [connecting, setConnecting] = useState(false);
  const { addToast } = useToast();

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setBlockedUrl(null);
    try {
      const { url } = await api.openClientDriveFolder(String(clientId), clientName);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) setBlockedUrl(url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPrompt("connect");
      } else if (err instanceof ApiError && err.status === 503) {
        setPrompt("not_configured");
      } else {
        addToast(err.message || "Could not open the Drive folder");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authUrl } = await api.getDriveConnectUrl(window.location.pathname);
      window.location.href = authUrl;
    } catch (err) {
      addToast(err.message || "Could not start Google Drive connection");
      setConnecting(false);
    }
  };

  if (blockedUrl) {
    return (
      <a
        href={blockedUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setBlockedUrl(null)}
        className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold-dark transition hover:bg-gold/20"
      >
        <ExternalLink size={14} />
        Popup blocked — click to open
      </a>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
      >
        <FolderOpen size={14} />
        {loading ? "Opening..." : "Drive Folder"}
      </button>

      {prompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPrompt(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy">
                <HardDrive size={18} />
              </div>
              <button
                onClick={() => setPrompt(null)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {prompt === "connect" ? (
              <>
                <h2 className="text-base font-semibold text-navy">Connect Google Drive</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Connect your Google Drive to store and open {clientName}'s files folder. You'll be sent to Google
                  and brought right back here.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setPrompt(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
                  >
                    <Link2 size={14} />
                    {connecting ? "Redirecting..." : "Connect Google Drive"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="flex items-center gap-1.5 text-base font-semibold text-navy">
                  <AlertTriangle size={16} className="text-av-red" />
                  Google Drive isn't set up yet
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  This app's Google Drive integration hasn't been configured on the server. Ask an admin to set it
                  up, then try again.
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => setPrompt(null)}
                    className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
