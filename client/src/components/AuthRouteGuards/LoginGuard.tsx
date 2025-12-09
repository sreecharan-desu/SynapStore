import { Navigate } from "react-router-dom";
import { useAuthContext } from "../../auth/AuthContext";

interface LoginGuardProps {
  children: React.ReactNode;
}

// This component can be used as the element for the /login route.
// If the user is authenticated, it immediately redirects to /dashboard.
export default function LoginGuard({ children }: LoginGuardProps) {
  const { isAuthenticated } = useAuthContext();

  // Synchronous redirect if auth is already true.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not authenticated -> render login UI (children)
  return <>{children}</>;
}

