import { useEffect, useRef, useState } from "react";
import { useLivePlayers } from "@/hooks/useLivePlayers";

type Toast = { key: number; name: string };

export function JoinTicker() {
  const players = useLivePlayers();
  const knownIds = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const joinedNames = new Set(players.filter((p) => p.joined).map((p) => p.username));
    if (knownIds.current === null) {
      knownIds.current = joinedNames;
      return;
    }
    const fresh: Toast[] = [];
    for (const name of joinedNames) {
      if (!knownIds.current.has(name)) {
        seq.current += 1;
        fresh.push({ key: seq.current, name });
      }
    }
    knownIds.current = joinedNames;
    if (fresh.length === 0) return;
    setToasts((cur) => [...cur, ...fresh]);
    // Auto-remove each after animation (~3.2s total).
    fresh.forEach((f) => {
      window.setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.key !== f.key));
      }, 3400);
    });
  }, [players]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none relative h-7 overflow-hidden bg-background/40 border-b border-border/40">
      {toasts.map((t, i) => (
        <div
          key={t.key}
          className="join-ticker-item absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-[#f5c518]"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5c518]/15 border border-[#f5c518]/40">
            🎉 <span className="text-foreground">{t.name}</span> joined
          </span>
        </div>
      ))}
    </div>
  );
}
