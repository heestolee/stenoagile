import type { Mode } from "../types";
import ModeTabsBar from "./ModeTabsBar";
import LoginToggleButton from "./LoginToggleButton";

type Props = {
  mode: Mode;
  isBatchMode: boolean;
  onPosition: () => void;
  onWords: () => void;
  onSentences: () => void;
  onLongtext: () => void;
  onBatchSequential: () => void;
  onSequential: () => void;
  onRandom: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  userEmail?: string;
};

export default function PracticeHeader({
  mode,
  isBatchMode,
  onPosition,
  onWords,
  onSentences,
  onLongtext,
  onBatchSequential,
  onSequential,
  onRandom,
  isLoggedIn,
  onLogin,
  onLogout,
  userEmail,
}: Props) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h1 className="text-2xl font-bold">Stenosaurus</h1>
      <ModeTabsBar
        mode={mode}
        isBatchMode={isBatchMode}
        onPosition={onPosition}
        onWords={onWords}
        onSentences={onSentences}
        onLongtext={onLongtext}
        onBatchSequential={onBatchSequential}
        onSequential={onSequential}
        onRandom={onRandom}
      />
      <LoginToggleButton isLoggedIn={isLoggedIn} onLogout={onLogout} onLogin={onLogin} userEmail={userEmail} />
    </div>
  );
}
