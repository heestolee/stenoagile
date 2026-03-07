type DrawerToggleProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export default function DrawerToggle({ isOpen, onToggle }: DrawerToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="w-6 h-full min-h-[400px] bg-gray-200 hover:bg-gray-300 flex items-center justify-center flex-shrink-0 rounded-r transition-colors"
      title={isOpen ? "설정 패널 닫기" : "설정 패널 열기"}
    >
      <span className="text-gray-600">{isOpen ? "◀" : "▶"}</span>
    </button>
  );
}
