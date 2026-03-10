import type { ChangeEvent, Dispatch, DragEvent, SetStateAction } from "react";
import type { Mode } from "../types";
import SlotGrid from "./SlotGrid";
import WordSentenceSettingsPanel from "./WordSentenceSettingsPanel";
import SequentialLongtextSettingsPanel from "./SequentialLongtextSettingsPanel";
import RandomSettingsPanel from "./RandomSettingsPanel";
import SourceTextPanel from "./SourceTextPanel";
import DrawerToggle from "./DrawerToggle";

type Props = {
  isDrawerOpen: boolean;
  setIsDrawerOpen: Dispatch<SetStateAction<boolean>>;
  mode: Mode;
  isPositionMode: boolean;
  isWordLikeMode: boolean;
  selectedSlot: number | null;
  slotNames: { [key: number]: string };
  favoriteSlots: Set<number>;
  handleLoadPreset: (slot: number) => void;
  toggleFavoriteSlot: (slot: number) => void;
  handleRenameSlot: (slot: number) => void;
  speechRate: number;
  displayFontSize: number;
  rankFontSize: number;
  showText: boolean;
  isSoundEnabled: boolean;
  showPositionKeyboard: boolean;
  geminiApiKey: string;
  onSaveSentenceDefaults: () => void;
  onSaveWordDefaults: () => void;
  onSavePositionDefaults: () => void;
  onSpeechRateChange: (rate: number) => void;
  onDisplayFontSizeChange: (size: number) => void;
  onRankFontSizeChange: (size: number) => void;
  onToggleShowText: () => void;
  onToggleSound: () => void;
  onTogglePositionKeyboard: () => void;
  onGeminiApiKeyChange: (apiKey: string) => void;
  sentenceReviewWindow: number;
  onSentenceReviewWindowChange: (window: number) => void;
  wordsPerSentence: number;
  onWordsPerSentenceChange: (n: number) => void;
  useRandomSentences: boolean;
  sequentialSpeed: number;
  sequentialSpeechRate: number;
  inputFontSize: number;
  charsPerRead: number;
  longTextLength: number;
  batchSize: number;
  isBatchMode: boolean;
  onSaveDetailSettings: () => void;
  onSequentialSpeedChange: (speed: number) => void;
  onSequentialSpeechRateChange: (rate: number) => void;
  onInputFontSizeChange: (size: number) => void;
  onCharsPerReadChange: (count: number) => void;
  onLongTextLengthChange: (length: number) => void;
  onBatchSizeChange: (size: number) => void;
  videoPlaybackRate: number;
  videoVolume: number;
  videoPlaylist: { name: string; url: string; data?: ArrayBuffer }[];
  currentVideoIndex: number;
  onRandomInputFontSizeChange: (size: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (volume: number) => void;
  onSelectVideo: (index: number) => void;
  removeVideoFromPlaylist: (index: number) => void;
  inputText: string;
  updateInputText: (text: string) => void;
  handleSaveToSlot: () => void;
  handleTextareaChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleTextareaDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
};

export default function PracticeDrawer({
  isDrawerOpen,
  setIsDrawerOpen,
  mode,
  isPositionMode,
  isWordLikeMode,
  selectedSlot,
  slotNames,
  favoriteSlots,
  handleLoadPreset,
  toggleFavoriteSlot,
  handleRenameSlot,
  speechRate,
  displayFontSize,
  rankFontSize,
  showText,
  isSoundEnabled,
  showPositionKeyboard,
  geminiApiKey,
  onSaveSentenceDefaults,
  onSaveWordDefaults,
  onSavePositionDefaults,
  onSpeechRateChange,
  onDisplayFontSizeChange,
  onRankFontSizeChange,
  onToggleShowText,
  onToggleSound,
  onTogglePositionKeyboard,
  onGeminiApiKeyChange,
  sentenceReviewWindow,
  onSentenceReviewWindowChange,
  wordsPerSentence,
  onWordsPerSentenceChange,
  sequentialSpeed,
  sequentialSpeechRate,
  inputFontSize,
  charsPerRead,
  longTextLength,
  batchSize,
  isBatchMode,
  onSaveDetailSettings,
  onSequentialSpeedChange,
  onSequentialSpeechRateChange,
  onInputFontSizeChange,
  onCharsPerReadChange,
  onLongTextLengthChange,
  onBatchSizeChange,
  videoPlaybackRate,
  videoVolume,
  videoPlaylist,
  currentVideoIndex,
  onRandomInputFontSizeChange,
  onPlaybackRateChange,
  onVolumeChange,
  onSelectVideo,
  removeVideoFromPlaylist,
  inputText,
  updateInputText,
  handleSaveToSlot,
  handleTextareaChange,
  handleTextareaDrop,
}: Props) {
  return (
    <>
      <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${isDrawerOpen ? "w-96" : "w-0"}`}>
        <div className="w-96 space-y-4 pr-4">
          {mode !== "random" && !isPositionMode && (
            <SlotGrid
              selectedSlot={selectedSlot}
              slotNames={slotNames}
              favoriteSlots={favoriteSlots}
              onLoadPreset={handleLoadPreset}
              onToggleFavorite={toggleFavoriteSlot}
              onRenameSlot={handleRenameSlot}
            />
          )}

          {(isWordLikeMode || mode === "sentences") && (
            <WordSentenceSettingsPanel
              mode={mode}
              isWordLikeMode={isWordLikeMode}
              isPositionMode={isPositionMode}
              speechRate={speechRate}
              displayFontSize={displayFontSize}
              rankFontSize={rankFontSize}
              showText={showText}
              isSoundEnabled={isSoundEnabled}
              showPositionKeyboard={showPositionKeyboard}
              geminiApiKey={geminiApiKey}
              onSaveSentenceDefaults={onSaveSentenceDefaults}
              onSaveWordDefaults={onSaveWordDefaults}
              onSavePositionDefaults={onSavePositionDefaults}
              onSpeechRateChange={onSpeechRateChange}
              onDisplayFontSizeChange={onDisplayFontSizeChange}
              onRankFontSizeChange={onRankFontSizeChange}
              onToggleShowText={onToggleShowText}
              onToggleSound={onToggleSound}
              onTogglePositionKeyboard={onTogglePositionKeyboard}
              onGeminiApiKeyChange={onGeminiApiKeyChange}
              sentenceReviewWindow={sentenceReviewWindow}
              onSentenceReviewWindowChange={onSentenceReviewWindowChange}
              wordsPerSentence={wordsPerSentence}
              onWordsPerSentenceChange={onWordsPerSentenceChange}
            />
          )}

          {(mode === "sequential" || mode === "longtext") && (
            <SequentialLongtextSettingsPanel
              mode={mode}
              sequentialSpeed={sequentialSpeed}
              sequentialSpeechRate={sequentialSpeechRate}
              displayFontSize={displayFontSize}
              inputFontSize={inputFontSize}
              charsPerRead={charsPerRead}
              longTextLength={longTextLength}
              batchSize={batchSize}
              isBatchMode={isBatchMode}
              showText={showText}
              isSoundEnabled={isSoundEnabled}
              onSaveDefaults={onSaveDetailSettings}
              onSequentialSpeedChange={onSequentialSpeedChange}
              onSequentialSpeechRateChange={onSequentialSpeechRateChange}
              onDisplayFontSizeChange={onDisplayFontSizeChange}
              onInputFontSizeChange={onInputFontSizeChange}
              onCharsPerReadChange={onCharsPerReadChange}
              onLongTextLengthChange={onLongTextLengthChange}
              onBatchSizeChange={onBatchSizeChange}
              onToggleShowText={onToggleShowText}
              onToggleSound={onToggleSound}
            />
          )}

          {mode === "random" && (
            <RandomSettingsPanel
              inputFontSize={inputFontSize}
              videoPlaybackRate={videoPlaybackRate}
              videoVolume={videoVolume}
              videoPlaylist={videoPlaylist}
              currentVideoIndex={currentVideoIndex}
              onInputFontSizeChange={onRandomInputFontSizeChange}
              onPlaybackRateChange={onPlaybackRateChange}
              onVolumeChange={onVolumeChange}
              onSelectVideo={onSelectVideo}
              onRemoveVideo={removeVideoFromPlaylist}
            />
          )}

          <SourceTextPanel
            mode={mode}
            isPositionMode={isPositionMode}
            inputText={inputText}
            onInputTextChange={updateInputText}
            onSaveToSlot={handleSaveToSlot}
            onTextareaChange={handleTextareaChange}
            onTextareaDrop={handleTextareaDrop}
          />
        </div>
      </div>

      <DrawerToggle isOpen={isDrawerOpen} onToggle={() => setIsDrawerOpen((prev) => !prev)} />
    </>
  );
}
