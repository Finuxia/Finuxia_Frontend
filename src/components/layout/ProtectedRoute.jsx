import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageSpinner from "../ui/PageSpinner";

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // While the session is being restored from the stored token, show a neutral
  // splash instead of flashing the login page.
  if (initializing) return <PageSpinner />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
