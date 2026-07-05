export type MysteryEvent = {
  is_mystery: boolean;
  reveal_hours_before: number;
  event_date: string;
};

export function mysteryRevealAt(event: MysteryEvent): Date {
  return new Date(
    new Date(event.event_date).getTime() - event.reveal_hours_before * 3600_000,
  );
}

export function isMysteryRevealed(event: MysteryEvent): boolean {
  if (!event.is_mystery) return true;
  return Date.now() >= mysteryRevealAt(event).getTime();
}

export function priceTier(priceCents: number): string {
  if (priceCents < 4000) return "$";
  if (priceCents < 8000) return "$$";
  if (priceCents < 15000) return "$$$";
  return "$$$$";
}

export function revealCountdownLabel(event: MysteryEvent): string {
  const ms = mysteryRevealAt(event).getTime() - Date.now();
  if (ms <= 0) return "Revealing now";
  const hours = Math.floor(ms / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Revealed in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `Revealed in ${hours}h ${mins}m`;
  return `Revealed in ${mins}m`;
}
