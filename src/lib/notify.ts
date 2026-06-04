// Telegram bot integration removed.
// This stub keeps the existing call sites working as no-ops.

export async function notifyTelegram(_input: {
  chatId?: number | string | null;
  text?: string;
  adminText?: string;
}): Promise<void> {
  return;
}

export function fmtEtb(n: number): string {
  return `${n.toFixed(2)} ETB`;
}
