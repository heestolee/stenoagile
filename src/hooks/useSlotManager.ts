import { useState, useEffect, useCallback } from "react";

export function useSlotManager(inputText: string) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slotNames, setSlotNames] = useState<{ [key: number]: string }>({});
  const [favoriteSlots, setFavoriteSlots] = useState<Set<number>>(new Set());

  // 오늘 완료한 라운드 수
  const [todayCompletedRounds, setTodayCompletedRounds] = useState(0);
  const [slotCompletedRoundsNormal, setSlotCompletedRoundsNormal] = useState<Record<number, number>>({});
  const [slotCompletedRoundsBatch, setSlotCompletedRoundsBatch] = useState<Record<number, number>>({});
  const [practiceSlot, setPracticeSlot] = useState<number | null>(null);
  const [pendingIncrementSlot, setPendingIncrementSlot] = useState<number | null>(null);

  // 슬롯 이름 불러오기 및 현재 텍스트와 일치하는 슬롯 찾기
  useEffect(() => {
    const savedNames: { [key: number]: string } = {};
    for (let i = 1; i <= 20; i++) {
      const name = localStorage.getItem(`slot_${i}_name`);
      if (name) {
        savedNames[i] = name;
      }
    }
    setSlotNames(savedNames);

    // 즐겨찾기 슬롯 불러오기
    const savedFavorites = localStorage.getItem("favorite_slots");
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites);
        setFavoriteSlots(new Set(parsed));
      } catch {
        // 파싱 실패 시 무시
      }
    }

    // 현재 inputText와 일치하는 슬롯 찾기
    for (let i = 1; i <= 20; i++) {
      const slotContent = localStorage.getItem(`slot_${i}`);
      if (slotContent && slotContent === inputText) {
        setSelectedSlot(i);
        break;
      }
    }
  }, []);

  // 오늘 완료한 라운드 수 불러오기
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = localStorage.getItem('completedRounds');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.date === today) {
        setTodayCompletedRounds(parsed.count || 0);
        setSlotCompletedRoundsNormal(parsed.normalSlotCounts || parsed.slotCounts || {});
        setSlotCompletedRoundsBatch(parsed.batchSlotCounts || {});
      } else {
        localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {} }));
        setTodayCompletedRounds(0);
        setSlotCompletedRoundsNormal({});
        setSlotCompletedRoundsBatch({});
      }
    } else {
      localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {} }));
    }
  }, []);

  // 라운드 완료 카운트 증가
  const incrementCompletedRounds = useCallback((slot: number | null, isBatch: boolean) => {
    setTodayCompletedRounds(prev => prev + 1);

    if (slot !== null) {
      if (isBatch) {
        setSlotCompletedRoundsBatch(prevSlots => {
          const newSlotCounts = { ...prevSlots };
          newSlotCounts[slot] = (newSlotCounts[slot] || 0) + 1;
          return newSlotCounts;
        });
      } else {
        setSlotCompletedRoundsNormal(prevSlots => {
          const newSlotCounts = { ...prevSlots };
          newSlotCounts[slot] = (newSlotCounts[slot] || 0) + 1;
          return newSlotCounts;
        });
      }
    }
  }, []);

  // localStorage에 완료 횟수 저장 (상태 변경 시)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (todayCompletedRounds > 0 || Object.keys(slotCompletedRoundsNormal).length > 0 || Object.keys(slotCompletedRoundsBatch).length > 0) {
      localStorage.setItem('completedRounds', JSON.stringify({
        date: today,
        count: todayCompletedRounds,
        normalSlotCounts: slotCompletedRoundsNormal,
        batchSlotCounts: slotCompletedRoundsBatch
      }));
    }
  }, [todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch]);

  const handleRenameSlot = (slot: number) => {
    const currentName = slotNames[slot] || `${slot}`;
    const newName = prompt(`슬롯 ${slot}의 이름을 입력하세요:`, currentName);

    if (newName !== null && newName.trim() !== "") {
      localStorage.setItem(`slot_${slot}_name`, newName.trim());
      setSlotNames(prev => ({ ...prev, [slot]: newName.trim() }));
    }
  };

  const toggleFavoriteSlot = (slot: number) => {
    setFavoriteSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slot)) {
        newSet.delete(slot);
      } else {
        newSet.add(slot);
      }
      localStorage.setItem("favorite_slots", JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const handleSaveToSlot = () => {
    if (selectedSlot === null) {
      alert("저장할 슬롯을 선택하세요");
      return;
    }
    localStorage.setItem(`slot_${selectedSlot}`, inputText);
    alert(`슬롯 ${selectedSlot}에 저장되었습니다`);
  };

  return {
    selectedSlot,
    setSelectedSlot,
    slotNames,
    favoriteSlots,
    todayCompletedRounds,
    slotCompletedRoundsNormal,
    slotCompletedRoundsBatch,
    practiceSlot,
    setPracticeSlot,
    pendingIncrementSlot,
    setPendingIncrementSlot,
    incrementCompletedRounds,
    handleRenameSlot,
    toggleFavoriteSlot,
    handleSaveToSlot,
  };
}
