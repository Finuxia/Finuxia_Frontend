import { useLocation } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";

/**
 * The boundary for one page inside the layout. It sits OUTSIDE the boundary class so the class itself needs no
 * router hook: this wrapper only hands it the current path, and a change of path clears a caught error.
 */
export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary variant="route" resetKey={pathname}>
      {children}
    </ErrorBoundary>
  );
}
