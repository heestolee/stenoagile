type AuthButtonProps = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export default function AuthButton({ isLoggedIn, onLogin, onLogout }: AuthButtonProps) {
  if (isLoggedIn) {
    return (
      <button
        onClick={onLogout}
        className="ml-auto px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
      >
        로그아웃
      </button>
    );
  }

  return (
    <button
      onClick={onLogin}
      className="ml-auto px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
    >
      로그인
    </button>
  );
}
