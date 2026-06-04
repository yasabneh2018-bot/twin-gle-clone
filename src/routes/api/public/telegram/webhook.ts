import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

const APP_URL = "https://twin-gle-clone.lovable.app";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`tg-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function tg(method: string, body: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Telegram ${method} failed: ${res.status} ${t}`);
  }
  return res;
}

function buildOpenUrl(opts: {
  tgId: number;
  firstName?: string;
  username?: string;
  phone?: string;
  view?: string;
}) {
  const u = new URL(APP_URL);
  u.searchParams.set("tg", String(opts.tgId));
  if (opts.firstName) u.searchParams.set("name", opts.firstName);
  if (opts.username) u.searchParams.set("uname", opts.username);
  if (opts.phone) u.searchParams.set("phone", opts.phone);
  if (opts.view) u.searchParams.set("view", opts.view);
  return u.toString();
}

async function getRegistered(telegramId: number) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/tg_users?telegram_id=eq.${telegramId}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    telegram_id: number;
    phone: string;
    first_name: string | null;
    tg_username: string | null;
  }>;
  return rows[0] ?? null;
}

async function upsertUser(row: {
  telegram_id: number;
  phone: string;
  first_name?: string | null;
  tg_username?: string | null;
}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/tg_users?on_conflict=telegram_id`;
  await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
}

async function sendStartUnregistered(chatId: number) {
  // Image 1 design: welcome bubble + Share my contact reply keyboard
  await tg("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      "🎁 You'll receive a <b>20 ETB welcome bonus</b> on first login.\n\n" +
      "Tap below to share your phone number and start playing:",
    reply_markup: {
      keyboard: [[{ text: "📱 Share my contact", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendMainMenu(
  chatId: number,
  reg: { telegram_id: number; phone: string; first_name: string | null; tg_username: string | null },
) {
  // Image 2 design: balance card + reply keyboard menu
  const name = reg.first_name || reg.tg_username || "Player";
  await tg("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `🎮 <b>Fast Bingo</b>\n\n` +
      `👋 Welcome, <b>${name}</b>!\n` +
      `💰 Tap <b>Play Bingo</b> to see your live balance and start playing.\n\n` +
      `Select an option:`,
    reply_markup: {
      keyboard: [
        [{ text: "🎮 Play Bingo" }],
        [{ text: "💰 Deposit" }, { text: "💸 Withdraw" }, { text: "🔁 Transfer" }],
        [{ text: "💰 Balance" }, { text: "📋 Transactions" }],
        [{ text: "ℹ️ How To Play" }, { text: "🎁 Invite" }],
      ],
      resize_keyboard: true,
    },
  });
}

async function sendOpenButton(
  chatId: number,
  reg: { telegram_id: number; phone: string; first_name: string | null; tg_username: string | null },
  view: string | undefined,
  label: string,
) {
  const url = buildOpenUrl({
    tgId: reg.telegram_id,
    firstName: reg.first_name ?? undefined,
    username: reg.tg_username ?? undefined,
    phone: reg.phone,
    view,
  });
  await tg("sendMessage", {
    chat_id: chatId,
    text: label,
    reply_markup: {
      inline_keyboard: [[{ text: label, web_app: { url } }]],
    },
  });
}

const MENU_VIEWS: Record<string, { view?: string; label: string }> = {
  "🎮 Play Bingo": { label: "🎮 Open Game (auto-login)" },
  "💰 Deposit": { view: "deposit", label: "💰 Open Deposit" },
  "💸 Withdraw": { view: "withdraw", label: "💸 Open Withdraw" },
  "🔁 Transfer": { view: "transfer", label: "🔁 Open Transfer" },
  "💰 Balance": { view: "wallet", label: "💰 Open Balance" },
  "📋 Transactions": { view: "tx", label: "📋 Open Transactions" },
  "ℹ️ How To Play": { view: "help", label: "ℹ️ Open How To Play" },
  "🎁 Invite": { view: "invite", label: "🎁 Open Invite" },
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Bot not configured", { status: 500 });

        const expected = deriveSecret(token);
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("ok");
        }

        const message = update.message ?? update.edited_message;
        if (!message?.chat?.id) return Response.json({ ok: true });
        const chatId = message.chat.id as number;
        const fromId = (message.from?.id ?? chatId) as number;
        const firstName = message.from?.first_name ?? null;
        const tgUsername = message.from?.username ?? null;

        try {
          // 1) Phone shared via contact button → register
          if (message.contact?.phone_number) {
            const phone = String(message.contact.phone_number).replace(/[^0-9+]/g, "");
            await upsertUser({
              telegram_id: fromId,
              phone,
              first_name: firstName,
              tg_username: tgUsername,
            });
            const reg = (await getRegistered(fromId))!;
            await tg("sendMessage", {
              chat_id: chatId,
              parse_mode: "HTML",
              text:
                `✅ <b>Registration successful!</b>\n` +
                `🎁 +20 ETB welcome bonus added.\n` +
                `Tap <b>Play Bingo</b> below to start.`,
              reply_markup: { remove_keyboard: true },
            });
            await sendMainMenu(chatId, reg);
            await sendOpenButton(chatId, reg, undefined, "🎮 Open Game (auto-login)");

            // Notify admin
            const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
            if (adminChat) {
              await tg("sendMessage", {
                chat_id: adminChat,
                parse_mode: "HTML",
                text: `🆕 New Telegram signup: <b>${firstName ?? tgUsername ?? fromId}</b> · ${phone} · tg:${fromId}`,
              });
            }
            return Response.json({ ok: true });
          }

          const text = (message.text ?? "").trim();

          // 2) /start → registered: show menu, unregistered: ask for contact
          if (text === "/start" || text.startsWith("/start ")) {
            const reg = await getRegistered(fromId);
            if (reg) {
              await sendMainMenu(chatId, reg);
              await sendOpenButton(chatId, reg, undefined, "🎮 Open Game (auto-login)");
            } else {
              await sendStartUnregistered(chatId);
            }
            return Response.json({ ok: true });
          }

          // 3) Menu buttons (only for registered users)
          const menu = MENU_VIEWS[text];
          if (menu) {
            const reg = await getRegistered(fromId);
            if (!reg) {
              await sendStartUnregistered(chatId);
            } else {
              await sendOpenButton(chatId, reg, menu.view, menu.label);
            }
            return Response.json({ ok: true });
          }

          // Fallback: nudge unregistered users, show menu for registered
          const reg = await getRegistered(fromId);
          if (!reg) {
            await sendStartUnregistered(chatId);
          } else {
            await sendMainMenu(chatId, reg);
          }
          return Response.json({ ok: true });
        } catch (e) {
          console.error("telegram webhook error", e);
          return Response.json({ ok: true });
        }
      },
    },
  },
});
