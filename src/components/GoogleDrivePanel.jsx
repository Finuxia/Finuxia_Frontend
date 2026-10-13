import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HardDrive, Link2, Unlink, AlertTriangle, FolderOpen, ExternalLink, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

const STATUS_META = {
  connected: { label: "Connected", dot: "bg-av-green", text: "text-av-green" },
  expired: { label: "Expired", dot: "bg-av-red", text: "text-av-red" },
  revoked: { label: "Revoked", dot: "bg-av-red", text: "text-av-red" },
  disconnected: { label: "Disconnected", dot: "bg-slate-300", text: "text-slate-400" },
};

/**
 * Per-advisor Google Drive connection (server-held OAuth — a different
 * architecture from the frontend-only Google Calendar integration, since
 * Drive tokens must never reach the browser). Connecting is a full-page
 * redirect to Google, not a JS popup token flow, because the token exchange
 * happens on our backend after Google redirects back to it.
 */
export default function GoogleDrivePanel() {
  const [status, setStatus] = useState("disconnected");
  const [googleEmail, setGoogleEmail] = useState(null);
  const [isConfigured, setIsConfigured] = useState(true); // assume yes until status says otherwise
  const [rootFolder, setRootFolder] = useState(null);
  const [folderInput, setFolderInput] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const load = () => {
    setLoading(true);
    api
      .getDriveStatus()
      .then((data) => {
        setStatus(data.status);
        setGoogleEmail(data.googleEmail);
        setIsConfigured(data.isConfigured !== false);
        setRootFolder(data.rootFolder || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // After the OAuth redirect lands back here with ?drive=connected|denied|error
  useEffect(() => {
    const result = searchParams.get("drive");
    if (!result) return;
    if (result === "connected") {
      addToast("Google Drive connected");
      load();
    } else if (result === "denied") {
      addToast("Google Drive connection was cancelled");
    } else {
      addToast("Could not connect Google Drive — please try again");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("drive");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authUrl } = await api.getDriveConnectUrl();
      window.location.href = authUrl;
    } catch (err) {
      addToast(err.message || "Could not start Google Drive connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectDrive();
      setStatus("disconnected");
      setGoogleEmail(null);
      setRootFolder(null);
      addToast("Google Drive disconnected");
    } catch (err) {
      addToast(err.message || "Could not disconnect Google Drive");
    }
  };

  const handleSaveFolder = async (e) => {
    e.preventDefault();
    if (!folderInput.trim()) return;
    setSavingFolder(true);
    try {
      const data = await api.setDriveRootFolder(folderInput.trim());
      setRootFolder(data.rootFolder || null);
      setFolderInput("");
      addToast(`Now using "${data.rootFolder?.name}" for client folders`);
    } catch (err) {
      addToast(err.message || "Could not use that folder");
    } finally {
      setSavingFolder(false);
    }
  };

  const handleResetFolder = async () => {
    try {
      const data = await api.resetDriveRootFolder();
      setRootFolder(data.rootFolder || null);
      addToast("Back to the default Finuxia folder");
    } catch (err) {
      addToast(err.message || "Could not reset the folder");
    }
  };

  if (!loading && !isConfigured) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
          <HardDrive size={15} className="text-slate-400" />
          Google Drive
        </h2>
        <p className="text-sm text-slate-500">
          Not configured yet — an admin needs to add a Google OAuth client as{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy">GOOGLE_DRIVE_CLIENT_ID</code> /{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy">GOOGLE_DRIVE_CLIENT_SECRET</code> on
          the backend to enable this.
        </p>
      </section>
    );
  }

  const meta = STATUS_META[status] ?? STATUS_META.disconnected;
  const connected = status === "connected";

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <HardDrive size={15} className="text-slate-400" />
          Google Drive
        </h2>
        {!loading && (
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span className={meta.text}>{meta.label}</span>
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">{googleEmail || "Used to store and open each client's files folder"}</p>

      {(status === "expired" || status === "revoked") && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-av-red/10 px-3 py-2 text-xs text-av-red">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Your Google Drive access {status === "revoked" ? "was revoked" : "expired"}. Reconnect to keep using client folders.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {connected ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Unlink size={13} />
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
          >
            <Link2 size={13} />
            {connecting ? "Redirecting..." : status === "expired" || status === "revoked" ? "Reconnect Google Drive" : "Connect Google Drive"}
          </button>
        )}
      </div>

      {connected && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            <FolderOpen size={13} />
            Client folders root
          </p>
          {rootFolder ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <a
                  href={rootFolder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-sm font-medium text-navy hover:underline"
                >
                  {rootFolder.name}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
                <p className="text-xs text-slate-400">
                  {rootFolder.isCustom ? "Your existing folder" : "Auto-created by Finuxia"}
                </p>
              </div>
              {rootFolder.isCustom && (
                <button
                  onClick={handleResetFolder}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-navy"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          ) : (
            <p className="mb-3 text-xs text-slate-400">
              Not set yet — client folders will be created under a new "Finuxia CRM Clients" folder unless you
              point this at one of your own below.
            </p>
          )}
          <form onSubmit={handleSaveFolder} className="flex gap-2">
            <input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="Paste a Google Drive folder link (e.g. your Prospects folder)"
              className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="submit"
              disabled={savingFolder || !folderInput.trim()}
              className="shrink-0 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              {savingFolder ? "Checking..." : "Use this folder"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
