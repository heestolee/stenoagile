import type { ComponentProps } from "react";
import WordSentenceControlPanel from "./WordSentenceControlPanel";
import WordSentenceRoundResult from "./WordSentenceRoundResult";
import SequentialLongtextPracticeControl from "./SequentialLongtextPracticeControl";
import WordSentencePracticeStatus from "./WordSentencePracticeStatus";

type Props = {
  mode: string;
  wordSentenceControlProps: ComponentProps<typeof WordSentenceControlPanel>;
  wordSentenceRoundResultProps: ComponentProps<typeof WordSentenceRoundResult>;
  sequentialLongtextPracticeControlProps: ComponentProps<typeof SequentialLongtextPracticeControl>;
  wordSentencePracticeStatusProps: ComponentProps<typeof WordSentencePracticeStatus>;
};

export default function PracticeTopPanels({
  mode,
  wordSentenceControlProps,
  wordSentenceRoundResultProps,
  sequentialLongtextPracticeControlProps,
  wordSentencePracticeStatusProps,
}: Props) {
  return (
    <>
      {mode !== "sequential" && mode !== "longtext" && mode !== "random" && (
        <WordSentenceControlPanel {...wordSentenceControlProps} />
      )}

      <WordSentenceRoundResult {...wordSentenceRoundResultProps} />

      {(mode === "sequential" || mode === "longtext") && (
        <SequentialLongtextPracticeControl {...sequentialLongtextPracticeControlProps} />
      )}

      <WordSentencePracticeStatus {...wordSentencePracticeStatusProps} />
    </>
  );
}
