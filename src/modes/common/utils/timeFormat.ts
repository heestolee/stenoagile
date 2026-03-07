export const formatElapsedTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
};
