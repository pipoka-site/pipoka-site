import type { OpeningHours, StoreSettings } from "@/lib/store";

const keys: (keyof OpeningHours)[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const labels: Record<keyof OpeningHours, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isStoreCurrentlyOpen(settings: StoreSettings, now = new Date()) {
  if (!settings.store_open) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "Sun";
  const weekdayMap: Record<string, keyof OpeningHours> = { Sun: "sunday", Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday" };
  const day = settings.opening_hours?.[weekdayMap[weekday]];
  if (!day?.enabled) return false;
  const current = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value || 0);
  const start = minutes(day.open);
  const end = minutes(day.close);
  return end >= start ? current >= start && current < end : current >= start || current < end;
}

export function formatOpeningHours(hours: OpeningHours) {
  return keys.map((key) => {
    const day = hours[key];
    return `${labels[key]}: ${day.enabled ? `${day.open} às ${day.close}` : "Fechado"}`;
  });
}

export const openingDayLabels = labels;
