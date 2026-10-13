import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearLegacyToken, clearLocalData, setSessionExpiredHandler } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `initializing` covers the boot-time /me call so ProtectedRoute doesn't
  // bounce a logged-in user to /login before their session is restored.
  const [initializing, setInitializing] = useState(true);
  // { plan, status, moduleKeys, currentPeriodEnd } — which modules this
  // account's plan unlocks. null while unknown (still loading, or logged out).
  const [billing, setBilling] = useState(null);
  // "loading" | "ready" | "error": lets a page that needs the plan tell "still fetching" from "could not fetch"
  // (and offer a retry) instead of showing nothing forever.
  const [billingStatus, setBillingStatus] = useState("loading");

  const refreshBilling = async () => {
    setBillingStatus((s) => (s === "ready" ? s : "loading"));
    try {
      const status = await api.getMyBillingStatus();
      setBilling(status);
      setBillingStatus("ready");
      return status;
    } catch {
      setBillingStatus((s) => (s === "ready" ? s : "error")); // a refresh that fails keeps the plan we already know
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    clearLegacyToken();
    async function restore() {
      try {
        const { user: me } = await api.me();
        if (!cancelled) {
          setUser(me);
          refreshBilling();
        }
      } catch {
        // No valid session cookie (or it couldn't be refreshed) — stay logged out.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (identifier, password) => {
    const { user: u } = await api.login(identifier, password);
    setUser(u);
    refreshBilling();
    return u;
  };

  const register = async (name, email, password) => {
    const { user: u } = await api.register({ name, email, password });
    setUser(u);
    refreshBilling();
    return u;
  };

  // Re-reads the account (e.g. after the email link was used in another tab or browser).
  const refreshUser = async () => {
    const { user: u } = await api.me();
    setUser(u);
    refreshBilling();
    return u;
  };

  const resendVerification = () => api.resendVerification();

  const requestPasswordReset = async (email) => {
    await api.forgotPassword(email);
    return true;
  };

  const changePassword = async (currentPassword, newPassword) => {
    // Other devices are signed out; this one gets a fresh session from the response.
    const { user: u } = await api.changePassword(currentPassword, newPassword);
    setUser(u);
    return u;
  };

  const updateProfile = async (patch) => {
    const { user: u } = await api.updateMe(patch);
    setUser(u);
    return u;
  };

  const updateComplianceProfile = async (patch) => {
    const { user: u } = await api.updateComplianceProfile(patch);
    setUser(u);
    return u;
  };

  const uploadAvatar = async (file) => {
    const { user: u } = await api.uploadAvatar(file);
    setUser(u);
    return u;
  };

  const removeAvatar = async () => {
    const { user: u } = await api.deleteAvatar();
    setUser(u);
    return u;
  };

  const logout = () => {
    // The refresh cookie is httpOnly, so only the server can clear and revoke it.
    api.logout().catch(() => {});
    clearLocalData();
    setUser(null);
    setBilling(null);
    setBillingStatus("loading");
  };

  useEffect(() => {
    // The API reports a session that can no longer be refreshed (expired/revoked).
    setSessionExpiredHandler(() => {
      clearLocalData();
      setUser(null);
      setBilling(null);
      setBillingStatus("loading");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const hasModule = (moduleKey) => (billing?.moduleKeys || []).includes(moduleKey);

  const value = useMemo(
    () => ({
      user,
      initializing,
      billing,
      billingStatus,
      refreshBilling,
      refreshUser,
      resendVerification,
      hasModule,
      login,
      register,
      logout,
      requestPasswordReset,
      updateProfile,
      changePassword,
      updateComplianceProfile,
      uploadAvatar,
      removeAvatar,
    }),
    [user, initializing, billing, billingStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
