import { useState, useEffect, useCallback } from "react";

export function useSlotManager(inputText: string) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slotNames, setSlotNames] = useState<{ [key: number]: string }>({});
  const [favoriteSlots, setFavoriteSlots] = useState<Set<number>>(new Set());

  // ?ㅻ뒛 ?꾨즺???쇱슫????
  const [todayCompletedRounds, setTodayCompletedRounds] = useState(0);
  const [slotCompletedRoundsNormal, setSlotCompletedRoundsNormal] = useState<Record<number, number>>({});
  const [slotCompletedRoundsBatch, setSlotCompletedRoundsBatch] = useState<Record<number, number>>({});
  const [modeCompletedRounds, setModeCompletedRounds] = useState<Record<string, number>>({});
  const [practiceSlot, setPracticeSlot] = useState<number | null>(null);
  const [pendingIncrementSlot, setPendingIncrementSlot] = useState<number | null>(null);

  // ?щ’ ?대쫫 遺덈윭?ㅺ린 諛??꾩옱 ?띿뒪?몄? ?쇱튂?섎뒗 ?щ’ 李얘린
  useEffect(() => {
    const savedNames: { [key: number]: string } = {};
    for (let i = 1; i <= 20; i++) {
      const name = localStorage.getItem(`slot_${i}_name`);
      if (name) {
        savedNames[i] = name;
      }
    }
    setSlotNames(savedNames);

    // 利먭꺼李얘린 ?щ’ 遺덈윭?ㅺ린
    const savedFavorites = localStorage.getItem("favorite_slots");
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites);
        setFavoriteSlots(new Set(parsed));
      } catch {
        // ?뚯떛 ?ㅽ뙣 ??臾댁떆
      }
    }

    // ?꾩옱 inputText? ?쇱튂?섎뒗 ?щ’ 李얘린
    for (let i = 1; i <= 20; i++) {
      const slotContent = localStorage.getItem(`slot_${i}`);
      if (slotContent && slotContent === inputText) {
        setSelectedSlot(i);
        break;
      }
    }
  }, [inputText]);

  // ?ㅻ뒛 ?꾨즺???쇱슫????遺덈윭?ㅺ린
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedData = localStorage.getItem('completedRounds');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.date === today) {
        setTodayCompletedRounds(parsed.count || 0);
        setSlotCompletedRoundsNormal(parsed.normalSlotCounts || parsed.slotCounts || {});
        setSlotCompletedRoundsBatch(parsed.batchSlotCounts || {});
        setModeCompletedRounds(parsed.modeCounts || {});
      } else {
        localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {}, modeCounts: {} }));
        setTodayCompletedRounds(0);
        setSlotCompletedRoundsNormal({});
        setSlotCompletedRoundsBatch({});
        setModeCompletedRounds({});
      }
    } else {
      localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {}, modeCounts: {} }));
    }
  }, []);

  // ?쇱슫???꾨즺 移댁슫??利앷?
  const incrementCompletedRounds = useCallback((slot: number | null, modeKey: string, amount = 1) => {
    setTodayCompletedRounds(prev => prev + amount);

    // 紐⑤뱶蹂?移댁슫??利앷?
    setModeCompletedRounds(prev => ({
      ...prev,
      [modeKey]: (prev[modeKey] || 0) + amount,
    }));

    // ?щ’蹂?移댁슫??(蹂닿퀬移섎씪/留ㅻℓ移섎씪留?
    const isBatch = modeKey === "batch";
    if (slot !== null && (modeKey === "sequential" || modeKey === "batch")) {
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

  // ?뱀젙 紐⑤뱶???꾨즺 ?잛닔 珥덇린??
  const resetModeCompletedRounds = useCallback((modeKey: string) => {
    setModeCompletedRounds(prev => {
      const removed = prev[modeKey] || 0;
      const next = { ...prev };
      delete next[modeKey];
      // todayCompletedRounds???대떦 紐⑤뱶 ?잛닔留뚰겮 媛먯냼
      setTodayCompletedRounds(prevTotal => Math.max(0, prevTotal - removed));
      // 蹂닿퀬移섎씪/留ㅻℓ移섎씪硫??щ’蹂?移댁슫?몃룄 珥덇린??
      if (modeKey === "sequential") {
        setSlotCompletedRoundsNormal({});
      } else if (modeKey === "batch") {
        setSlotCompletedRoundsBatch({});
      }
      return next;
    });
  }, []);

  // localStorage???꾨즺 ?잛닔 ???(?곹깭 蹂寃???
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (todayCompletedRounds > 0 || Object.keys(slotCompletedRoundsNormal).length > 0 || Object.keys(slotCompletedRoundsBatch).length > 0) {
      localStorage.setItem('completedRounds', JSON.stringify({
        date: today,
        count: todayCompletedRounds,
        normalSlotCounts: slotCompletedRoundsNormal,
        batchSlotCounts: slotCompletedRoundsBatch,
        modeCounts: modeCompletedRounds
      }));
    }
  }, [todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch, modeCompletedRounds]);

  const handleRenameSlot = (slot: number) => {
    const currentName = slotNames[slot] || `${slot}`;
    const newName = prompt(`?щ’ ${slot}???대쫫???낅젰?섏꽭??(理쒕? 7湲??:`, currentName);

    if (newName !== null && newName.trim() !== "") {
      const trimmed = newName.trim().slice(0, 7);
      localStorage.setItem(`slot_${slot}_name`, trimmed);
      setSlotNames(prev => ({ ...prev, [slot]: trimmed }));
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
      alert("저장할 슬롯을 선택하세요.");
      return;
    }
    localStorage.setItem(`slot_${selectedSlot}`, inputText);
    const name = slotNames[selectedSlot] || `?щ’ ${selectedSlot}`;
    alert(`${name}????λ릺?덉뒿?덈떎`);
  };

  return {
    selectedSlot,
    setSelectedSlot,
    slotNames,
    favoriteSlots,
    todayCompletedRounds,
    slotCompletedRoundsNormal,
    slotCompletedRoundsBatch,
    modeCompletedRounds,
    practiceSlot,
    setPracticeSlot,
    pendingIncrementSlot,
    setPendingIncrementSlot,
    incrementCompletedRounds,
    resetModeCompletedRounds,
    handleRenameSlot,
    toggleFavoriteSlot,
    handleSaveToSlot,
  };
}



