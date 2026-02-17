import TypingPractice from "./components/TypingPractice";
import LoginPage from "./components/LoginPage";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <LoginPage />;
  return <TypingPractice />;
}

export default App;
