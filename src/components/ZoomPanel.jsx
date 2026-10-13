import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Video, Link2, Unlink, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

const STATUS_META = {
  connected: { label: "Connected", dot: "bg-av-green", text: "text-av-green" },
  expired: { label: "Expired", dot: "bg-av-red", text: "text-av-red" },
  revoked: { label: "Revoked", dot: "bg-av-red", text: "text-av-red" },
  disconnected: { label: "Disconnected", dot: "bg-slate-300", text: "text-slate-400" },
};

/**
 * Per-advisor Zoom connection (server-held OAuth, same architecture as
 * Google Drive/Calendar) — only needed if a booking link's location is set
 * to "Zoom"; every other location option works without this.
 */
export default function ZoomPanel() {
  const [status, setStatus] = useState("disconnected");
  const [zoomEmail, setZoomEmail] = useState(null);
  const [isConfigured, setIsConfigured] = useState(true); // assume yes until status says otherwise
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const load = () => {
    setLoading(true);
    api
      .getZoomStatus()
      .then((data) => {
        setStatus(data.status);
        setZoomEmail(data.zoomEmail);
        setIsConfigured(data.isConfigured !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // After the OAuth redirect lands back here with ?zoomConnect=connected|denied|error
  useEffect(() => {
    const result = searchParams.get("zoomConnect");
    if (!result) return;
    if (result === "connected") {
      addToast("Zoom connected");
      load();
    } else if (result === "denied") {
      addToast("Zoom connection was cancelled");
    } else {
      addToast("Could not connect Zoom — please try again");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("zoomConnect");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authUrl } = await api.getZoomConnectUrl(window.location.pathname);
      window.location.href = authUrl;
    } catch (err) {
      addToast(err.message || "Could not start Zoom connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectZoom();
      setStatus("disconnected");
      setZoomEmail(null);
      addToast("Zoom disconnected");
    } catch (err) {
      addToast(err.message || "Could not disconnect Zoom");
    }
  };

  if (!loading && !isConfigured) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Video size={15} className="text-slate-400" />
          Zoom
        </h2>
        <p className="text-sm text-slate-500">
          Not configured yet — an admin needs to add a Zoom OAuth app as{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy">ZOOM_CLIENT_ID</code> /{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy">ZOOM_CLIENT_SECRET</code> on the
          backend to enable this.
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
          <Video size={15} className="text-slate-400" />
          Zoom
        </h2>
        {!loading && (
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span className={meta.text}>{meta.label}</span>
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        {zoomEmail || "Lets booking links set to \"Zoom\" auto-create a join link for every confirmed meeting"}
      </p>

      {(status === "expired" || status === "revoked") && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-av-red/10 px-3 py-2 text-xs text-av-red">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Your Zoom access {status === "revoked" ? "was revoked" : "expired"}. Reconnect to keep auto-creating Zoom
          links.
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
            {connecting ? "Redirecting..." : status === "expired" || status === "revoked" ? "Reconnect Zoom" : "Connect Zoom"}
          </button>
        )}
      </div>
    </section>
  );
}
