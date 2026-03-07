import type { RefObject } from "react";

type SetCountdown = (value: number | null) => void;

type CountdownTimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

export function startSequentialCountdown(params: {
  setCountdown: SetCountdown;
  countdownTimerRef: CountdownTimerRef;
  onComplete: () => void;
}) {
  const { setCountdown, countdownTimerRef, onComplete } = params;
  setCountdown(5);
  let count = 5;

  const tick = () => {
    count -= 1;
    if (count > 0) {
      setCountdown(count);
      countdownTimerRef.current = setTimeout(tick, 1000);
    } else {
      setCountdown(null);
      onComplete();
    }
  };

  countdownTimerRef.current = setTimeout(tick, 1000);
}

export function findBestSequentialResumePosition(typed: string, original: string): number {
  const typedNoSpace = typed.replace(/\s+/g, "");
  const originalNoSpace = original.replace(/\s+/g, "");

  if (typedNoSpace.length === 0) return 0;

  for (let len = Math.min(10, typedNoSpace.length); len >= 1; len--) {
    const lastChars = typedNoSpace.slice(-len);
    for (let i = originalNoSpace.length - len; i >= 0; i--) {
      const window = originalNoSpace.slice(i, i + len);
      if (window === lastChars) {
        return i + len;
      }
    }
  }

  let bestPos = 0;
  let bestScore = 0;
  const searchLen = Math.min(10, typedNoSpace.length);
  const lastChars = typedNoSpace.slice(-searchLen);

  for (let i = 0; i <= originalNoSpace.length - searchLen; i++) {
    const window = originalNoSpace.slice(i, i + searchLen);
    let score = 0;
    for (let j = 0; j < searchLen; j++) {
      if (window[j] === lastChars[j]) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPos = i + searchLen;
    }
  }

  return bestPos;
}

