export type OrderStatus = "ingreso" | "diagnostico" | "en_progreso" | "listo" | "entregado";
export type WorkshopRole = "propietario" | "recepcion" | "tecnico";

export const ORDER_STATUSES: { value: OrderStatus; label: string; badge: string; dot: string }[] = [
  {
    value: "ingreso",
    label: "Ingreso",
    badge: "bg-st-ingreso text-st-ingreso-fg",
    dot: "bg-st-ingreso-fg",
  },
  {
    value: "diagnostico",
    label: "Diagnóstico",
    badge: "bg-st-diagnostico text-st-diagnostico-fg",
    dot: "bg-st-diagnostico-fg",
  },
  {
    value: "en_progreso",
    label: "En progreso",
    badge: "bg-st-progreso text-st-progreso-fg",
    dot: "bg-st-progreso-fg",
  },
  {
    value: "listo",
    label: "Listo",
    badge: "bg-st-listo text-st-listo-fg",
    dot: "bg-st-listo-fg",
  },
  {
    value: "entregado",
    label: "Entregado",
    badge: "bg-st-entregado text-st-entregado-fg",
    dot: "bg-st-entregado-fg",
  },
];

export function statusMeta(status: OrderStatus) {
  return ORDER_STATUSES.find((s) => s.value === status) ?? ORDER_STATUSES[0]!;
}

export const ROLE_LABELS: Record<WorkshopRole, string> = {
  propietario: "Propietario",
  recepcion: "Recepción",
  tecnico: "Técnico",
};

export function money(value: number | string | null | undefined, currency = "$") {
  const n = Number(value ?? 0);
  return `${currency}${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "··";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function todayLabel(date = new Date()) {
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Hace ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}
