import { useEffect, useRef, useState } from "react";

type Params = {
  isPositionMode: boolean;
  isPracticing: boolean;
  totalCount: number;
  progressCount: number;
  practiceSlot: number | null;
  incrementCompletedRounds: (slot: number | null, modeKey: string, amount?: number) => void;
};

export function usePositionCycleToast(params: Params) {
  const {
    isPositionMode,
    isPracticing,
    totalCount,
    progressCount,
    practiceSlot,
    incrementCompletedRounds,
  } = params;

  const [positionCycleToast, setPositionCycleToast] = useState<string | null>(null);
  const prevPositionProgressRef = useRef(0);

  useEffect(() => {
    if (!isPositionMode || !isPracticing || totalCount <= 0) {
      prevPositionProgressRef.current = progressCount;
      return;
    }

    const prev = prevPositionProgressRef.current;
    const justCompletedCycle = prev === totalCount - 1 && progressCount === 0;
    if (justCompletedCycle) {
      incrementCompletedRounds(practiceSlot, "position");
      setPositionCycleToast("사이클 완료! 다음 라운드 시작");
      setTimeout(() => setPositionCycleToast(null), 2000);
    }
    prevPositionProgressRef.current = progressCount;
  }, [isPositionMode, isPracticing, totalCount, progressCount, incrementCompletedRounds, practiceSlot]);

  return positionCycleToast;
}
