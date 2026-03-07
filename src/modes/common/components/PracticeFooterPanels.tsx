import type { ComponentProps } from "react";
import WordPositionModePanel from "./WordPositionModePanel";

type Props = {
  positionCycleToast: string | null;
} & ComponentProps<typeof WordPositionModePanel>;

export default function PracticeFooterPanels({ positionCycleToast, ...panelProps }: Props) {
  return (
    <>
      {positionCycleToast && (
        <div className="text-center py-1.5 px-4 rounded-full bg-emerald-500 text-white text-sm font-semibold animate-pulse">
          {positionCycleToast}
        </div>
      )}
      {panelProps.mode !== "sequential" && panelProps.mode !== "longtext" && panelProps.mode !== "random" && panelProps.mode !== "sentences" && (
        <WordPositionModePanel {...panelProps} />
      )}
    </>
  );
}
