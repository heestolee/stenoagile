import type { ComponentProps } from "react";
import PracticeTopPanels from "./PracticeTopPanels";
import LongtextModePanel from "../../longtext/components/LongtextModePanel";
import SequentialPracticePanel from "../../sequential/components/SequentialPracticePanel";
import RandomModePanel from "../../random/components/RandomModePanel";
import CommonPracticeTextPanel from "./CommonPracticeTextPanel";
import SentenceModePanel from "../../sentences/components/SentenceModePanel";
import PracticeFooterPanels from "./PracticeFooterPanels";

type Props = {
  practiceTopPanelsProps: ComponentProps<typeof PracticeTopPanels>;
  longtextModePanelProps: ComponentProps<typeof LongtextModePanel>;
  sequentialPracticePanelProps: ComponentProps<typeof SequentialPracticePanel>;
  randomModePanelProps: ComponentProps<typeof RandomModePanel>;
  commonPracticeTextPanelProps: ComponentProps<typeof CommonPracticeTextPanel>;
  sentenceModePanelProps: ComponentProps<typeof SentenceModePanel>;
  practiceFooterPanelsProps: ComponentProps<typeof PracticeFooterPanels>;
};

export default function PracticeMainArea({
  practiceTopPanelsProps,
  longtextModePanelProps,
  sequentialPracticePanelProps,
  randomModePanelProps,
  commonPracticeTextPanelProps,
  sentenceModePanelProps,
  practiceFooterPanelsProps,
}: Props) {
  return (
    <div className="flex-1 flex flex-col gap-4 pl-4">
      <PracticeTopPanels {...practiceTopPanelsProps} />
      <LongtextModePanel {...longtextModePanelProps} />
      <SequentialPracticePanel {...sequentialPracticePanelProps} />
      <RandomModePanel {...randomModePanelProps} />
      <CommonPracticeTextPanel {...commonPracticeTextPanelProps} />
      <SentenceModePanel {...sentenceModePanelProps} />
      <PracticeFooterPanels {...practiceFooterPanelsProps} />
    </div>
  );
}
