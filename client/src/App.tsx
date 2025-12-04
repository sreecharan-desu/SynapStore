import { useNavigate } from "react-router-dom";

const App = () => {
  const navigate = useNavigate();

  return (
    <div className="text-center">
      <h1>Welcome to snap store</h1>
      <button
        className="bg-black text-white"
        onClick={() => navigate("/login")}
      >
        Login
      </button>
    </div>
  );
};

export default App;
