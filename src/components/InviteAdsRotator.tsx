import { useEffect, useState } from "react";
import { BOT_USERNAME } from "@/routes/index";

type Ad = {
  title: string;
  subtitle: string;
  cta: string;
  gradient: string;
  emoji: string;
};

const ADS: Ad[] = [
  {
    title: "Invite & Earn 50 ETB",
    subtitle: "Bonus on every friend who signs up",
    cta: "Share on Telegram",
    gradient: "linear-gradient(135deg,#0088cc 0%,#005f8a 100%)",
    emoji: "🎁",
  },
  {
    title: "Double Bonus Today",
    subtitle: "+100 ETB when your friend deposits",
    cta: "Invite Now",
    gradient: "linear-gradient(135deg,#f59e0b 0%,#b45309 100%)",
    emoji: "💸",
  },
  {
    title: "Play Together, Win Bigger",
    subtitle: "Bring friends, share the pot",
    cta: "Send Invite",
    gradient: "linear-gradient(135deg,#16a34a 0%,#065f46 100%)",
    emoji: "🏆",
  },
  {
    title: "Limited Referral Boost",
    subtitle: "Top inviters featured on leaderboard",
    cta: "Share Link",
    gradient: "linear-gradient(135deg,#7c3aed 0%,#4c1d95 100%)",
    emoji: "🚀",
  },
  {
    title: "Earn While They Play",
    subtitle: "Lifetime referral rewards",
    cta: "Invite Friends",
    gradient: "linear-gradient(135deg,#dc2626 0%,#7f1d1d 100%)",
    emoji: "🔥",
  },
];

export function InviteAdsRotator({ refCode }: { refCode: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % ADS.length), 5000);
    return () => clearInterval(id);
  }, []);

  const share = () => {
    const url = `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(refCode)}`;
    const msg = `🎮 Join me on Bingo! Play, win & earn. Use my link: ${url}`;
    const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(msg)}`;
    window.open(tg, "_blank");
  };

  const ad = ADS[i];
  return (
    <div className="px-2 pt-1 overflow-hidden" style={{ contain: "layout paint" }}>
      <div className="relative h-[52px]">
        <button
          onClick={share}
          key={i}
          className="absolute inset-0 w-full text-left rounded-lg overflow-hidden shadow-md ad-fly"
          style={{ background: ad.gradient }}
        >
          <div className="flex items-center gap-3 px-3 py-2 h-full">
            <div className="text-3xl drop-shadow">{ad.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-extrabold text-sm leading-tight truncate">
                {ad.title}
              </div>
              <div className="text-white/85 text-[11px] truncate">{ad.subtitle}</div>
            </div>
            <div className="bg-white/95 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shrink-0">
              {ad.cta} ›
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
