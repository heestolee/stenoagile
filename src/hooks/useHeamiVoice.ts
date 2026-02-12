import { useState, useEffect, useRef } from "react";

export function useHeamiVoice(
  isSoundEnabled: boolean,
  speechRate: number,
  sequentialSpeechRate: number,
) {
  const [heamiVoice, setHeamiVoice] = useState<SpeechSynthesisVoice | null>(null);
  const timeoutIds = useRef<number[]>([]);

  // Microsoft Heami 음성 로드
  useEffect(() => {
    const loadHeami = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const heami = availableVoices.find(voice =>
        voice.name.includes('Heami')
      );
      if (heami) {
        setHeamiVoice(heami);
      }
    };

    loadHeami();
    window.speechSynthesis.onvoiceschanged = loadHeami;
  }, []);

  const clearAllTimeouts = () => {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  };

  const speakText = (text: string, isSequential = false) => {
    if (!isSoundEnabled) return;

    if (!isSequential) {
      window.speechSynthesis.cancel();
      clearAllTimeouts();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isSequential ? sequentialSpeechRate : speechRate;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    if (heamiVoice) {
      utterance.voice = heamiVoice;
    }

    if (isSequential) {
      window.speechSynthesis.speak(utterance);
    } else {
      requestAnimationFrame(() => {
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  return { speakText, clearAllTimeouts };
}
