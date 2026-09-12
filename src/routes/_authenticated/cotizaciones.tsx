import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";
import { CARD, money, statusMeta, type OrderStatus } from "@/lib/taller";

export const Route = createFileRoute("/_authenticated/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones y pagos · TallerBinaria" },
      {
        name: "description",
        content: "Cotización de cada orden, pagos registrados y saldo pendiente del taller.",
      },
      { property: "og:title", content: "Cotizaciones y pagos · TallerBinaria" },
      {
        property: "og:description",
        content: "Revisa cuánto se cotizó, cuánto se cobró y qué falta por cobrar.",
      },
    ],
  }),
  component: CotizacionesPage,
});

function CotizacionesPage() {
  const { data: membership } = useWorkshop();
  const wsId = membership?.workshop.id;
  const currency = membership?.workshop.currency ?? "$";

  const data = useQuery({
    queryKey: ["quotes", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [ordersRes, itemsRes, paymentsRes] = await Promise.all([
        supabase
          .from("repair_orders")
          .select("id, code, status, labor_cost, created_at, customers(name)")
          .eq("workshop_id", wsId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("order_items")
          .select("order_id, quantity, unit_price")
          .eq("workshop_id", wsId!),
        supabase.from("payments").select("order_id, amount").eq("workshop_id", wsId!),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const itemTotals = new Map<string, number>();
      for (const i of itemsRes.data ?? []) {
        itemTotals.set(
          i.order_id,
          (itemTotals.get(i.order_id) ?? 0) + Number(i.quantity) * Number(i.unit_price),
        );
      }
      const paidTotals = new Map<string, number>();
      for (const p of paymentsRes.data ?? []) {
        paidTotals.set(p.order_id, (paidTotals.get(p.order_id) ?? 0) + Number(p.amount));
      }

      return (ordersRes.data ?? []).map((o) => {
        const total = (itemTotals.get(o.id) ?? 0) + Number(o.labor_cost);
        const paid = paidTotals.get(o.id) ?? 0;
        return {
          id: o.id,
          code: o.code,
          status: o.status as OrderStatus,
          customer: (o.customers as { name: string } | null)?.name ?? "Sin cliente",
          total,
          paid,
          balance: Math.max(total - paid, 0),
        };
      });
    },
  });

  const rows = data.data ?? [];
  const totalQuoted = rows.reduce((s, r) => s + r.total, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <AppShell title="Cotizaciones y pagos">
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <Box label="Cotizado" value={money(totalQuoted, currency)} />
          <Box label="Cobrado" value={money(totalPaid, currency)} />
          <Box label="Por cobrar" value={money(totalBalance, currency)} warn />
        </section>

        <div className={CARD}>
          <div className="grid grid-cols-[1fr_120px_120px_120px_110px] border-b border-line px-4 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            <span>Orden</span>
            <span>Total</span>
            <span>Cobrado</span>
            <span>Saldo</span>
            <span className="text-right">Estado</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Sin órdenes cotizadas todavía.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_120px_120px_120px_110px] items-center px-4 py-2.5"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                      <span className="truncate text-sm font-medium">{r.customer}</span>
                    </div>
                  </div>
                  <div className="font-mono text-sm">{money(r.total, currency)}</div>
                  <div className="font-mono text-sm text-ok">{money(r.paid, currency)}</div>
                  <div
                    className={`font-mono text-sm ${r.balance > 0 ? "font-semibold text-warn" : "text-muted-foreground"}`}
                  >
                    {money(r.balance, currency)}
                  </div>
                  <div className="justify-self-end">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusMeta(r.status).badge}`}
                    >
                      {statusMeta(r.status).label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Box({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`${CARD} rise p-4`}>
      <div className="label-mono">{label}</div>
      <div
        className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${warn ? "text-warn" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
