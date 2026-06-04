import { useEffect, useState } from "react";
import { getCallSpeed, SPEED_DEFAULT } from "@/lib/store";

export type ServerClock = {
  gameNo: number;
  drawing: boolean;
  /** Whole-seconds countdown until the drawing phase starts (0 when drawing). */
  countdown: number;
  /** How many balls have been called in the current drawing phase. */
  drawnCount: number;
  /** Elapsed ms inside the current phase. */
  elapsedMs: number;
  raw: null;
};

// Globally-shared round timing. Every client computes the same gameNo /
// phase / countdown from wall-clock time, so users see the same game and
// a page refresh resumes the same round automatically.
const EPOCH_MS = 1700000000000; // fixed reference instant (Nov 2023)
const COUNTDOWN_S = 25;
const DRAWING_S = 85; // upper bound; actual draw time depends on speed
const CYCLE_S = COUNTDOWN_S + DRAWING_S;
const TOTAL_BALLS = 75;

export function deriveClock(nowMs: number = Date.now(), speedMs: number = SPEED_DEFAULT): ServerClock {
  const sinceEpochMs = Math.max(0, nowMs - EPOCH_MS);
  const cycleMs = CYCLE_S * 1000;
  const gameNo = Math.floor(sinceEpochMs / cycleMs);
  const intoCycleMs = sinceEpochMs % cycleMs;
  const countdownMs = COUNTDOWN_S * 1000;

  if (intoCycleMs < countdownMs) {
    return {
      gameNo,
      drawing: false,
      countdown: Math.max(0, Math.ceil((countdownMs - intoCycleMs) / 1000)),
      drawnCount: 0,
      elapsedMs: intoCycleMs,
      raw: null,
    };
  }

  const drawElapsedMs = intoCycleMs - countdownMs;
  // Ball cadence is driven by admin-controlled call speed so a change in
  // speed is reflected universally for every viewer.
  const drawnCount = Math.min(
    TOTAL_BALLS,
    Math.max(0, Math.floor(drawElapsedMs / Math.max(200, speedMs))),
  );
  return {
    gameNo,
    drawing: true,
    countdown: 0,
    drawnCount,
    elapsedMs: drawElapsedMs,
    raw: null,
  };
}

/**
 * Subscribe to the global, wall-clock-derived bingo clock.
 * No backend round-trip — every client computes the same value from Date.now().
 */
export function useServerClock(_syncMs = 250): ServerClock {
  const [speed, setSpeed] = useState<number>(() => getCallSpeed());
  const [clock, setClock] = useState<ServerClock>(() => deriveClock(Date.now(), getCallSpeed()));

  useEffect(() => {
    const tick = window.setInterval(() => {
      const s = getCallSpeed();
      setSpeed((prev) => (prev === s ? prev : s));
      setClock(deriveClock(Date.now(), s));
    }, 150);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fk_call_speed_ms") setSpeed(getCallSpeed());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // speed is intentionally read on each tick; expose nothing extra.
  void speed;
  return clock;
}
