// Cross-user realtime sync via Supabase Realtime.
// - Broadcasts admin control signals (stop / pause / resume / restart / speed)
//   to every connected user so they don't only fire on the admin's device.
// - Tracks player presence so the live-players list and pool data reflect
//   real cross-device players, not just same-browser tabs.
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  raiseStopSignal,
  raisePauseSignal,
  raiseResumeSignal,
  raiseRestartSignal,
  setCallSpeed,
  getCallSpeed,
  setBroadcaster,
  type LivePlayer,
} from "./store";

type ControlEvent =
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "speed"; ms: number };

let channel: RealtimeChannel | null = null;
let isRemote = false;
let myPresence: Omit<LivePlayer, "at"> | null = null;

const presenceMap = new Map<string, LivePlayer>();
let listeners: Array<(p: LivePlayer[]) => void> = [];

function emit() {
  const list = Array.from(presenceMap.values());
  listeners.forEach((fn) => fn(list));
}

export function subscribePresence(fn: (p: LivePlayer[]) => void): () => void {
  listeners.push(fn);
  fn(Array.from(presenceMap.values()));
  return () => {
    listeners = listeners.filter((f) => f !== fn);
  };
}

export function getRemotePlayers(): LivePlayer[] {
  return Array.from(presenceMap.values());
}

export function trackPresence(p: Omit<LivePlayer, "at">) {
  myPresence = p;
  if (channel) void channel.track({ ...p, at: Date.now() });
}

export function untrackPresence() {
  myPresence = null;
  if (channel) void channel.untrack();
}

function broadcastControl(ev: ControlEvent) {
  if (!channel || isRemote) return;
  void channel.send({ type: "broadcast", event: "control", payload: ev });
}

export function initRealtime() {
  if (channel || typeof window === "undefined") return;

  // Wire the store so raise*/setCallSpeed also broadcasts to other users.
  setBroadcaster((ev) => {
    if (ev.type === "speed") broadcastControl({ type: "speed", ms: ev.ms });
    else broadcastControl({ type: ev.type });
  });

  channel = supabase.channel("fk_game", {
    config: { presence: { key: "" }, broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "control" }, ({ payload }) => {
    const ev = payload as ControlEvent;
    isRemote = true;
    try {
      switch (ev.type) {
        case "stop":
          raiseStopSignal();
          break;
        case "pause":
          raisePauseSignal();
          break;
        case "resume":
          raiseResumeSignal();
          break;
        case "restart":
          raiseRestartSignal();
          break;
        case "speed":
          if (ev.ms !== getCallSpeed()) setCallSpeed(ev.ms);
          break;
      }
    } finally {
      isRemote = false;
    }
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel!.presenceState();
    presenceMap.clear();
    for (const arr of Object.values(state)) {
      for (const raw of arr as unknown[]) {
        const p = raw as Partial<LivePlayer>;
        if (p && typeof p.username === "string") {
          presenceMap.set(p.username, {
            username: p.username,
            stake: p.stake ?? 0,
            joined: !!p.joined,
            gameNo: p.gameNo ?? 0,
            at: p.at ?? Date.now(),
          });
        }
      }
    }
    emit();
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED" && myPresence) {
      void channel!.track({ ...myPresence, at: Date.now() });
    }
  });
}
