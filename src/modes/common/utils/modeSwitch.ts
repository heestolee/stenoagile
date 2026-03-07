import type { Mode } from "../types";

type ModeSwitchHandlersParams = {
  mode: Mode;
  isBatchMode: boolean;
  saveSentenceState: () => void;
  saveLongtextState: () => void;
  cleanupForModeSwitch: () => void;
  switchMode: (mode: Mode) => void;
  restoreSentenceState: () => void;
  restoreLongtextState: () => void;
  setIsBatchMode: (enabled: boolean) => void;
};

export function createModeSwitchHandlers(params: ModeSwitchHandlersParams) {
  const {
    mode,
    isBatchMode,
    saveSentenceState,
    saveLongtextState,
    cleanupForModeSwitch,
    switchMode,
    restoreSentenceState,
    restoreLongtextState,
    setIsBatchMode,
  } = params;

  const handleSwitchPosition = () => {
    saveSentenceState();
    saveLongtextState();
    cleanupForModeSwitch();
    switchMode("position");
  };

  const handleSwitchWords = () => {
    saveSentenceState();
    saveLongtextState();
    cleanupForModeSwitch();
    switchMode("words");
  };

  const handleSwitchSentences = () => {
    saveLongtextState();
    cleanupForModeSwitch();
    switchMode("sentences");
    restoreSentenceState();
  };

  const handleSwitchLongtext = () => {
    saveSentenceState();
    saveLongtextState();
    cleanupForModeSwitch();
    switchMode("longtext");
    restoreLongtextState();
  };

  const handleSwitchBatchSequential = () => {
    saveSentenceState();
    saveLongtextState();
    if (!isBatchMode || mode !== "sequential") {
      cleanupForModeSwitch();
    }
    switchMode("sequential");
    setIsBatchMode(true);
  };

  const handleSwitchSequential = () => {
    saveSentenceState();
    saveLongtextState();
    if (isBatchMode || mode !== "sequential") {
      cleanupForModeSwitch();
    }
    switchMode("sequential");
    setIsBatchMode(false);
  };

  const handleSwitchRandom = () => {
    saveSentenceState();
    saveLongtextState();
    cleanupForModeSwitch();
    switchMode("random");
  };

  return {
    handleSwitchPosition,
    handleSwitchWords,
    handleSwitchSentences,
    handleSwitchLongtext,
    handleSwitchBatchSequential,
    handleSwitchSequential,
    handleSwitchRandom,
  };
}
