export type DayRange = { from: string; to: string };
export function chooseRange(draft: DayRange, day: string): DayRange {
  if (!draft.from || draft.to) return { from: day, to: "" };
  return day < draft.from
    ? { from: day, to: draft.from }
    : { from: draft.from, to: day };
}
export function formatRange({ from, to }: DayRange) {
  const short = (v: string) =>
    new Date(v + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
    });
  if (!from && !to) return "Selecionar período";
  if (!from) return `Até ${short(to)} ${to.slice(0, 4)}`;
  if (!to) return `A partir de ${short(from)} ${from.slice(0, 4)}`;
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${short(from)} — ${short(to)} ${to.slice(0, 4)}`
    : `${short(from)} ${from.slice(0, 4)} — ${short(to)} ${to.slice(0, 4)}`;
}
