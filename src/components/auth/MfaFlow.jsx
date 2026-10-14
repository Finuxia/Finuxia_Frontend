import AuthCard from "../layout/AuthCard";
import { useAuth } from "../../context/AuthContext";
import MfaEnrolStep from "./MfaEnrolStep";
import MfaVerifyStep from "./MfaVerifyStep";

// What follows a correct password when the account needs a second factor (SEC-12): `step` is "verify" (type the code) or "enrol" (set the factor up first).
// There is no session until this finishes; `onDone` is called once the account has been loaded into the app.
export default function MfaFlow({ step, challenge, onDone, onBack }) {
  const { completeMfa } = useAuth();
  const finish = (result) => onDone(completeMfa(result), result);

  return step === "enrol" ? (
    <AuthCard
      title="Set up two-factor sign-in"
      subtitle="Every Finuxia account signs in with a password and a code from an authenticator app."
    >
      <MfaEnrolStep challenge={challenge} onSignedIn={finish} onBack={onBack} />
    </AuthCard>
  ) : (
    <AuthCard title="Enter your code" subtitle="Open your authenticator app and type the 6-digit code for Finuxia.">
      <MfaVerifyStep challenge={challenge} onSignedIn={finish} onBack={onBack} />
    </AuthCard>
  );
}
