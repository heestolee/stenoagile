import { useState, useCallback } from "react";
import {
  updateTodayProficiency,
  getAllTodayProficiencies,
  clearTodayProficiencies,
  getAllWordProficiencies,
  clearWordProficiencies,
  mergeTodayToOverall,
  type WordProficiency,
} from "../utils/indexedDB";

export function useWordProficiency() {
  const [todayProficiencies, setTodayProficiencies] = useState<WordProficiency[]>([]);
  const [overallProficiencies, setOverallProficiencies] = useState<WordProficiency[]>([]);

  const recordResult = useCallback((word: string, isCorrect: boolean) => {
    updateTodayProficiency(word, isCorrect).catch(() => {});
  }, []);

  const refreshToday = useCallback(async () => {
    try {
      const data = await getAllTodayProficiencies();
      setTodayProficiencies(data);
    } catch { /* ignore */ }
  }, []);

  const refreshOverall = useCallback(async () => {
    try {
      const data = await getAllWordProficiencies();
      setOverallProficiencies(data);
    } catch { /* ignore */ }
  }, []);

  const clearToday = useCallback(async () => {
    try {
      await clearTodayProficiencies();
      setTodayProficiencies([]);
    } catch { /* ignore */ }
  }, []);

  const clearOverall = useCallback(async () => {
    try {
      await clearWordProficiencies();
      setOverallProficiencies([]);
    } catch { /* ignore */ }
  }, []);

  const mergeToOverall = useCallback(async () => {
    try {
      await mergeTodayToOverall();
      await clearTodayProficiencies();
      setTodayProficiencies([]);
      const data = await getAllWordProficiencies();
      setOverallProficiencies(data);
    } catch { /* ignore */ }
  }, []);

  return {
    todayProficiencies,
    overallProficiencies,
    recordResult,
    refreshToday,
    refreshOverall,
    clearToday,
    clearOverall,
    mergeToOverall,
  };
}
