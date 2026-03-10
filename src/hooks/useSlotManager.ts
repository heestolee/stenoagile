import { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// KST 기준 날짜 반환 (오전 5시 이전은 전날로 처리)
const getKstDate = (): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  if (kst.getUTCHours() < 5) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  return kst.toISOString().split('T')[0];
};

export function useSlotManager(inputText: string, user: User | null = null) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slotNames, setSlotNames] = useState<{ [key: number]: string }>({});
  const [favoriteSlots, setFavoriteSlots] = useState<Set<number>>(new Set());

  // 오늘 완료 횟수 상태
  const [todayCompletedRounds, setTodayCompletedRounds] = useState(0);
  const [slotCompletedRoundsNormal, setSlotCompletedRoundsNormal] = useState<Record<number, number>>({});
  const [slotCompletedRoundsBatch, setSlotCompletedRoundsBatch] = useState<Record<number, number>>({});
  const [modeCompletedRounds, setModeCompletedRounds] = useState<Record<string, number>>({});
  const [practiceSlot, setPracticeSlot] = useState<number | null>(null);
  const [pendingIncrementSlot, setPendingIncrementSlot] = useState<number | null>(null);
  const prevUserRef = useRef<User | null>(null);

  // 로그인 시 localStorage 기록 → Supabase 마이그레이션
  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // null → non-null: 로그인 이벤트
    if (!prevUser && user) {
      (async () => {
        type HistoryEntry = { date: string; total: number; mode_counts: Record<string, number> };
        const rows: HistoryEntry[] = [];

        // completedRoundsHistory 수집
        try {
          const raw = localStorage.getItem("completedRoundsHistory");
          if (raw) {
            const parsed: HistoryEntry[] = JSON.parse(raw);
            rows.push(...parsed);
          }
        } catch { /* ignore */ }

        // completedRounds(오늘) 수집 — history에 없으면 추가
        try {
          const raw = localStorage.getItem("completedRounds");
          if (raw) {
            const today = JSON.parse(raw) as { date: string; count: number; modeCounts?: Record<string, number>; mode_counts?: Record<string, number> };
            if (today.date && today.count > 0) {
              const already = rows.some((r) => r.date === today.date);
              if (!already) {
                rows.push({ date: today.date, total: today.count, mode_counts: today.mode_counts ?? today.modeCounts ?? {} });
              }
            }
          }
        } catch { /* ignore */ }

        if (rows.length === 0) return;

        // 기존 Supabase 데이터 조회 후 합산 upsert
        const dates = rows.map((r) => r.date);
        const { data: existing } = await supabase
          .from("daily_completions")
          .select("date, total, mode_counts")
          .eq("user_id", user.id)
          .in("date", dates);

        const existingMap: Record<string, HistoryEntry> = {};
        (existing ?? []).forEach((e: HistoryEntry) => { existingMap[e.date] = e; });

        const upsertRows = rows.map((r) => {
          const ex = existingMap[r.date];
          if (!ex) return { user_id: user.id, date: r.date, total: r.total, mode_counts: r.mode_counts, updated_at: new Date().toISOString() };
          // 합산: total은 최대값, mode_counts는 각 키 합산
          const mergedCounts: Record<string, number> = { ...ex.mode_counts };
          Object.entries(r.mode_counts).forEach(([k, v]) => {
            mergedCounts[k] = Math.max(mergedCounts[k] ?? 0, v);
          });
          return { user_id: user.id, date: r.date, total: Math.max(ex.total, r.total), mode_counts: mergedCounts, updated_at: new Date().toISOString() };
        });

        await supabase.from("daily_completions").upsert(upsertRows, { onConflict: "user_id,date" });
      })();
    }
  }, [user]);

  // 슬롯 이름 로드 및 현재 텍스트와 일치하는 슬롯 찾기
  useEffect(() => {
    const savedNames: { [key: number]: string } = {};
    for (let i = 1; i <= 20; i++) {
      const name = localStorage.getItem(`slot_${i}_name`);
      if (name) {
        savedNames[i] = name;
      }
    }
    setSlotNames(savedNames);

    // 즐겨찾기 슬롯 로드
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
  }, [inputText]);

  // 오늘 완료 횟수 로드
  useEffect(() => {
    const today = getKstDate();
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

  // 완료 횟수 증가 함수
  const incrementCompletedRounds = useCallback((slot: number | null, modeKey: string, amount = 1) => {
    setTodayCompletedRounds(prev => prev + amount);

    // 모드별 증가 함수
    setModeCompletedRounds(prev => ({
      ...prev,
      [modeKey]: (prev[modeKey] || 0) + amount,
    }));

    // 슬롯별 증가 (보고치라/매매치라)
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

  // 특정 모드의 완료 횟수 초기화
  const resetModeCompletedRounds = useCallback((modeKey: string) => {
    setModeCompletedRounds(prev => {
      const removed = prev[modeKey] || 0;
      const next = { ...prev };
      delete next[modeKey];
      // todayCompletedRounds에서 해당 모드 횟수만큼 감소
      setTodayCompletedRounds(prevTotal => Math.max(0, prevTotal - removed));
      // 보고치라/매매치라면 슬롯별 카운트도 초기화
      if (modeKey === "sequential") {
        setSlotCompletedRoundsNormal({});
      } else if (modeKey === "batch") {
        setSlotCompletedRoundsBatch({});
      }
      return next;
    });
  }, []);

  // localStorage에 완료 횟수 저장 (상태 변경 시)
  useEffect(() => {
    const today = getKstDate();
    if (todayCompletedRounds > 0 || Object.keys(slotCompletedRoundsNormal).length > 0 || Object.keys(slotCompletedRoundsBatch).length > 0) {
      localStorage.setItem('completedRounds', JSON.stringify({
        date: today,
        count: todayCompletedRounds,
        normalSlotCounts: slotCompletedRoundsNormal,
        batchSlotCounts: slotCompletedRoundsBatch,
        modeCounts: modeCompletedRounds
      }));
      // localStorage 날짜별 히스토리 누적 저장
      try {
        const historyRaw = localStorage.getItem('completedRoundsHistory');
        const history: { date: string; total: number; mode_counts: Record<string, number> }[] =
          historyRaw ? JSON.parse(historyRaw) : [];
        const idx = history.findIndex((r) => r.date === today);
        const entry = { date: today, total: todayCompletedRounds, mode_counts: modeCompletedRounds };
        if (idx >= 0) history[idx] = entry;
        else history.unshift(entry);
        localStorage.setItem('completedRoundsHistory', JSON.stringify(history));
      } catch { /* ignore */ }
      // Supabase upsert (로그인된 경우에만)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from('daily_completions').upsert({
          user_id: user.id,
          date: today,
          total: todayCompletedRounds,
          mode_counts: modeCompletedRounds,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' });
      });
    }
  }, [todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch, modeCompletedRounds]);

  const handleRenameSlot = (slot: number) => {
    const currentName = slotNames[slot] || `${slot}`;
    const newName = prompt(`슬롯 ${slot}의 이름을 입력하세요 (최대 7자):`, currentName);

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
    const name = slotNames[selectedSlot] || `슬롯 ${selectedSlot}`;
    alert(`${name}에 저장됐습니다`);
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



