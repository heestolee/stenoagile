type FinishPracticeCallbacks = {
  stopPractice: () => void;
  resetReview: () => void;
  setPracticingMode: (mode: string | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
};

export function finishPracticeAndOpenDrawer(callbacks: FinishPracticeCallbacks) {
  callbacks.stopPractice();
  callbacks.resetReview();
  callbacks.setPracticingMode(null);
  callbacks.setIsDrawerOpen(true);
}

type HaltOngoingPracticeCallbacks = {
  cancelSpeech: () => void;
  clearVoiceTimeouts: () => void;
  clearCountdownTimer: () => void;
  resetCountdownState: () => void;
  resetRoundRuntimeState: () => void;
  resetBatchAndReviewState: () => void;
  logSessionSummary: () => void;
  finishPracticeAndOpenDrawer: () => void;
  focusInputAfterStop: () => void;
};

export function haltOngoingPractice(callbacks: HaltOngoingPracticeCallbacks) {
  callbacks.cancelSpeech();
  callbacks.clearVoiceTimeouts();
  callbacks.clearCountdownTimer();
  callbacks.resetCountdownState();
  callbacks.resetRoundRuntimeState();
  callbacks.resetBatchAndReviewState();
  callbacks.logSessionSummary();
  callbacks.finishPracticeAndOpenDrawer();
  callbacks.focusInputAfterStop();
}
