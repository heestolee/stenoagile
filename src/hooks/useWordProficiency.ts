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

export function useWordProficiency(scope: "words" | "position" = "words") {
  const [todayProficiencies, setTodayProficiencies] = useState<WordProficiency[]>([]);
  const [overallProficiencies, setOverallProficiencies] = useState<WordProficiency[]>([]);

  const recordResult = useCallback((word: string, result: "correct" | "half" | "incorrect") => {
    updateTodayProficiency(word, result, scope).catch(() => {});
  }, [scope]);

  const refreshToday = useCallback(async () => {
    try {
      const data = await getAllTodayProficiencies(scope);
      setTodayProficiencies(data);
    } catch { /* ignore */ }
  }, [scope]);

  const refreshOverall = useCallback(async () => {
    try {
      const data = await getAllWordProficiencies(scope);
      setOverallProficiencies(data);
    } catch { /* ignore */ }
  }, [scope]);

  const clearToday = useCallback(async () => {
    try {
      await clearTodayProficiencies(scope);
      setTodayProficiencies([]);
    } catch { /* ignore */ }
  }, [scope]);

  const clearOverall = useCallback(async () => {
    try {
      await clearWordProficiencies(scope);
      setOverallProficiencies([]);
    } catch { /* ignore */ }
  }, [scope]);

  const mergeToOverall = useCallback(async () => {
    try {
      await mergeTodayToOverall(scope);
      await clearTodayProficiencies(scope);
      setTodayProficiencies([]);
      const data = await getAllWordProficiencies(scope);
      setOverallProficiencies(data);
    } catch { /* ignore */ }
  }, [scope]);

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
