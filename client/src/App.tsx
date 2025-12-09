import { Navigate } from "react-router-dom";
import { useAuthContext } from "./auth/AuthContext";
import LandingPage from "./pages/LandingPage";

const App = () => {
  const { isAuthenticated } = useAuthContext();

  // If user is already logged in, send them to /dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
};

export default App;
