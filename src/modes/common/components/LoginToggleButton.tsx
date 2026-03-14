type Props = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  userEmail?: string;
};

export default function LoginToggleButton({ isLoggedIn, onLogin, onLogout, userEmail }: Props) {
  if (isLoggedIn) {
    return (
      <div className="ml-auto flex items-center gap-2">
        {userEmail && <span className="text-xs text-gray-500">{userEmail}</span>}
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
        >
          로그아웃
        </button>
      </div>
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
