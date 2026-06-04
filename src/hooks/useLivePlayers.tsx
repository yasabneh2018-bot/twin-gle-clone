import { useEffect, useState } from "react";
import type { LivePlayer } from "@/lib/store";
import { subscribePresence, getRemotePlayers } from "@/lib/realtime";

/** Reactive list of live players from Supabase Realtime presence (cross-device). */
export function useLivePlayers(): LivePlayer[] {
  const [list, setList] = useState<LivePlayer[]>(() =>
    typeof window === "undefined" ? [] : getRemotePlayers(),
  );
  useEffect(() => subscribePresence(setList), []);
  return list;
}
