// Realtime cartella selection + winner coordination for the shared bingo game.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TakenCartella = { username: string; stake: number };
export type GameWinner = {
  game_no: number;
  username: string;
  cartella_id: number;
  pattern_id: string;
  payout: number;
  drawn_count: number;
  won_at: string;
};

/** Live map of cartella_id -> { username, stake } for a given game. */
export function useTakenCartellas(gameNo: number): Map<number, TakenCartella> {
  const [map, setMap] = useState<Map<number, TakenCartella>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setMap(new Map());

    const load = async () => {
      const { data } = await supabase
        .from("game_cartellas")
        .select("cartella_id, username, stake")
        .eq("game_no", gameNo);
      if (cancelled || !data) return;
      const next = new Map<number, TakenCartella>();
      for (const row of data) {
        next.set(row.cartella_id as number, {
          username: row.username as string,
          stake: row.stake as number,
        });
      }
      setMap(next);
    };
    void load();

    const channel = supabase
      .channel(`game_cartellas_${gameNo}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_cartellas", filter: `game_no=eq.${gameNo}` },
        (payload) => {
          setMap((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const r = payload.new as { cartella_id: number; username: string; stake: number };
              next.set(r.cartella_id, { username: r.username, stake: r.stake });
            } else if (payload.eventType === "DELETE") {
              const r = payload.old as { cartella_id: number };
              if (r?.cartella_id != null) next.delete(r.cartella_id);
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [gameNo]);

  return map;
}

/** Live winner row for the current game (null until someone wins). */
export function useGameWinner(gameNo: number): GameWinner | null {
  const [winner, setWinner] = useState<GameWinner | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWinner(null);

    const load = async () => {
      const { data } = await supabase
        .from("game_winners")
        .select("*")
        .eq("game_no", gameNo)
        .maybeSingle();
      if (!cancelled && data) setWinner(data as GameWinner);
    };
    void load();

    const channel = supabase
      .channel(`game_winners_${gameNo}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_winners", filter: `game_no=eq.${gameNo}` },
        (payload) => setWinner(payload.new as GameWinner),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [gameNo]);

  return winner;
}

/** Try to claim a cartella. Returns true if claim succeeded, false if it was already taken. */
export async function claimCartella(
  gameNo: number,
  cartellaId: number,
  username: string,
  stake: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("game_cartellas")
    .insert({ game_no: gameNo, cartella_id: cartellaId, username, stake });
  return !error;
}

/** Release a cartella I previously claimed. Best-effort. */
export async function releaseCartella(
  gameNo: number,
  cartellaId: number,
  username: string,
): Promise<void> {
  await supabase
    .from("game_cartellas")
    .delete()
    .eq("game_no", gameNo)
    .eq("cartella_id", cartellaId)
    .eq("username", username);
}

/**
 * Try to record the winner. Returns true if THIS client inserted the winning
 * row (so it should pay out locally), false if someone else won first.
 */
export async function claimWinner(args: {
  gameNo: number;
  username: string;
  cartellaId: number;
  patternId: string;
  payout: number;
  drawnCount: number;
}): Promise<boolean> {
  const { error } = await supabase.from("game_winners").insert({
    game_no: args.gameNo,
    username: args.username,
    cartella_id: args.cartellaId,
    pattern_id: args.patternId,
    payout: args.payout,
    drawn_count: args.drawnCount,
  });
  return !error;
}
