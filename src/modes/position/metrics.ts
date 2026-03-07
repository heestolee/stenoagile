import type { PositionStage } from "./types";
import {
  POSITION_FAST_THRESHOLD_MS,
  POSITION_FINAL_MAP,
  POSITION_INITIAL_MAP,
  POSITION_KEY_LABEL,
  POSITION_VOWEL_MAP,
  decomposeHangulSyllable,
  getContextTokensForChar,
  getPositionKeyRole,
  getPositionRoleGroup,
  type PositionRoleGroup,
} from "./constants";

export type PositionSample = {
  ms: number;
  correct: boolean;
  at: number;
  stage: PositionStage | "mixed";
  fromKeys: string[];
  toKeys: string[];
  fromChar: string;
  toChar: string;
};

type Stability = "stable_slow" | "unstable" | "fast";

export type PositionTransitionMetric = {
  id: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  fromRole: ReturnType<typeof getPositionKeyRole>;
  toRole: ReturnType<typeof getPositionKeyRole>;
  fromGroup: ReturnType<typeof getPositionRoleGroup>;
  toGroup: ReturnType<typeof getPositionRoleGroup>;
  avgMs: number;
  stdDev: number;
  stability: Stability;
  fastRate: number;
  count: number;
};

export type PositionTransitionContextMetric = {
  id: string;
  group: PositionRoleGroup;
  fromUnit: string;
  toUnit: string;
  fromKeys: string[];
  toKeys: string[];
  fromChar: string;
  toChar: string;
  fromComp: string[];
  toComp: string[];
  fromCompLabel: string;
  toCompLabel: string;
  avgMs: number;
  stdDev: number;
  stability: Stability;
  fastRate: number;
  count: number;
};

export type PositionKeyMetric = {
  key: string;
  label: string;
  role: ReturnType<typeof getPositionKeyRole>;
  avgMs: number;
  fastRate: number;
  count: number;
};

export type PositionMetrics = {
  perTransition: PositionTransitionMetric[];
  perTransitionByContext: PositionTransitionContextMetric[];
  perKey: PositionKeyMetric[];
};

const calcStdDev = (sumMs: number, sumSqMs: number, count: number): number => {
  if (count < 2) return 0;
  const mean = sumMs / count;
  const variance = Math.max(0, sumSqMs / count - mean * mean);
  return Math.round(Math.sqrt(variance));
};

const classifyStability = (avgMs: number, stdDev: number, count: number): Stability => {
  if (count < 3) return "unstable";
  if (avgMs <= POSITION_FAST_THRESHOLD_MS) return "fast";
  const cv = avgMs > 0 ? stdDev / avgMs : 0;
  return cv >= 0.3 ? "unstable" : "stable_slow";
};

export function computePositionMetrics(samples: PositionSample[]): PositionMetrics {
  const transitions = samples.filter((s) => s.correct && s.ms > 0);

  const transitionMap = new Map<string, { sumMs: number; sumSqMs: number; count: number; fastCount: number }>();
  const transitionContextMap = new Map<string, {
    sumMs: number;
    sumSqMs: number;
    count: number;
    fastCount: number;
    group: PositionRoleGroup;
    fromUnit: string;
    toUnit: string;
    fromKeys: string[];
    toKeys: string[];
    fromChar: string;
    toChar: string;
    fromComp: string[];
    toComp: string[];
  }>();
  const fromKeyMap = new Map<string, { sumMs: number; count: number; fastCount: number }>();

  for (const s of transitions) {
    const fromKeys = s.fromKeys ?? [];
    const toKeys = s.toKeys ?? [];
    if (fromKeys.length === 0 || toKeys.length === 0) continue;

    for (const fromKey of fromKeys) {
      for (const toKey of toKeys) {
        const transitionId = `${fromKey}->${toKey}`;
        const item = transitionMap.get(transitionId) ?? { sumMs: 0, sumSqMs: 0, count: 0, fastCount: 0 };
        item.sumMs += s.ms;
        item.sumSqMs += s.ms * s.ms;
        item.count += 1;
        if (s.ms <= POSITION_FAST_THRESHOLD_MS) item.fastCount += 1;
        transitionMap.set(transitionId, item);
      }

      const fromItem = fromKeyMap.get(fromKey) ?? { sumMs: 0, count: 0, fastCount: 0 };
      fromItem.sumMs += s.ms;
      fromItem.count += 1;
      if (s.ms <= POSITION_FAST_THRESHOLD_MS) fromItem.fastCount += 1;
      fromKeyMap.set(fromKey, fromItem);
    }

    const fromParts = decomposeHangulSyllable(s.fromChar);
    const toParts = decomposeHangulSyllable(s.toChar);
    if (!fromParts || !toParts) continue;

    const contexts: Array<{
      group: PositionRoleGroup;
      fromUnit: string;
      toUnit: string;
      fromKeys: string[];
      toKeys: string[];
    }> = [
      {
        group: "initial",
        fromUnit: fromParts.initial,
        toUnit: toParts.initial,
        fromKeys: POSITION_INITIAL_MAP[fromParts.initial] ?? [],
        toKeys: POSITION_INITIAL_MAP[toParts.initial] ?? [],
      },
      {
        group: "vowel",
        fromUnit: fromParts.vowel,
        toUnit: toParts.vowel,
        fromKeys: POSITION_VOWEL_MAP[fromParts.vowel] ?? [],
        toKeys: POSITION_VOWEL_MAP[toParts.vowel] ?? [],
      },
      {
        group: "final",
        fromUnit: fromParts.final,
        toUnit: toParts.final,
        fromKeys: fromParts.final ? (POSITION_FINAL_MAP[fromParts.final] ?? []) : [],
        toKeys: toParts.final ? (POSITION_FINAL_MAP[toParts.final] ?? []) : [],
      },
    ];

    for (const ctx of contexts) {
      if (!ctx.fromUnit || !ctx.toUnit) continue;
      const fromComp = getContextTokensForChar(s.fromChar, ctx.group);
      const toComp = getContextTokensForChar(s.toChar, ctx.group);
      const contextId = `${ctx.group}:${ctx.fromUnit}->${ctx.toUnit}|FC:${s.fromChar}|TC:${s.toChar}|F:${fromComp.join("+")}|T:${toComp.join("+")}`;
      const contextItem = transitionContextMap.get(contextId) ?? {
        sumMs: 0,
        sumSqMs: 0,
        count: 0,
        fastCount: 0,
        group: ctx.group,
        fromUnit: ctx.fromUnit,
        toUnit: ctx.toUnit,
        fromKeys: [...ctx.fromKeys],
        toKeys: [...ctx.toKeys],
        fromChar: s.fromChar,
        toChar: s.toChar,
        fromComp,
        toComp,
      };
      contextItem.sumMs += s.ms;
      contextItem.sumSqMs += s.ms * s.ms;
      contextItem.count += 1;
      if (s.ms <= POSITION_FAST_THRESHOLD_MS) contextItem.fastCount += 1;
      contextItem.fromKeys = [...new Set([...contextItem.fromKeys, ...ctx.fromKeys])];
      contextItem.toKeys = [...new Set([...contextItem.toKeys, ...ctx.toKeys])];
      transitionContextMap.set(contextId, contextItem);
    }
  }

  const perTransition = [...transitionMap.entries()]
    .map(([id, v]) => {
      const [from, to] = id.split("->");
      const fromRole = getPositionKeyRole(from);
      const toRole = getPositionKeyRole(to);
      const avgMs = Math.round(v.sumMs / v.count);
      const stdDev = calcStdDev(v.sumMs, v.sumSqMs, v.count);
      return {
        id,
        from,
        to,
        fromLabel: POSITION_KEY_LABEL[from] || from,
        toLabel: POSITION_KEY_LABEL[to] || to,
        fromRole,
        toRole,
        fromGroup: getPositionRoleGroup(fromRole),
        toGroup: getPositionRoleGroup(toRole),
        avgMs,
        stdDev,
        stability: classifyStability(avgMs, stdDev, v.count),
        fastRate: Math.round((v.fastCount / v.count) * 100),
        count: v.count,
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs);

  const perTransitionByContext = [...transitionContextMap.entries()]
    .map(([id, v]) => {
      const avgMs = Math.round(v.sumMs / v.count);
      const stdDev = calcStdDev(v.sumMs, v.sumSqMs, v.count);
      return {
        id,
        group: v.group,
        fromUnit: v.fromUnit,
        toUnit: v.toUnit,
        fromKeys: v.fromKeys,
        toKeys: v.toKeys,
        fromChar: v.fromChar,
        toChar: v.toChar,
        fromComp: v.fromComp,
        toComp: v.toComp,
        fromCompLabel: v.fromComp.join("+"),
        toCompLabel: v.toComp.join("+"),
        avgMs,
        stdDev,
        stability: classifyStability(avgMs, stdDev, v.count),
        fastRate: Math.round((v.fastCount / v.count) * 100),
        count: v.count,
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs);

  const perKey = [...fromKeyMap.entries()]
    .map(([key, v]) => ({
      key,
      label: POSITION_KEY_LABEL[key] || key,
      role: getPositionKeyRole(key),
      avgMs: Math.round(v.sumMs / v.count),
      fastRate: Math.round((v.fastCount / v.count) * 100),
      count: v.count,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  return {
    perTransition,
    perTransitionByContext,
    perKey,
  };
}

export function computeStagePositionMetrics(
  samples: PositionSample[],
  stageOrder: Array<PositionStage | "mixed">,
) {
  return stageOrder
    .map((stage) => {
      const stageSamples = samples.filter((s) => s.stage === stage);
      const transitions = stageSamples.filter((s) => s.correct && s.ms > 0);
      const avgMs = transitions.length > 0
        ? Math.round(transitions.reduce((sum, s) => sum + s.ms, 0) / transitions.length)
        : 0;
      const fastCount = transitions.filter((s) => s.ms <= POSITION_FAST_THRESHOLD_MS).length;
      const fastRate = transitions.length > 0 ? Math.round((fastCount / transitions.length) * 100) : 0;
      return { stage, count: transitions.length, avgMs, fastRate };
    })
    .filter((row) => row.count > 0);
}
