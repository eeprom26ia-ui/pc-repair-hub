import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";
import { BTN_INK, CARD, FIELD, initials, money, statusMeta, type OrderStatus } from "@/lib/taller";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · TallerBinaria" },
      {
        name: "description",
        content: "Fichas de clientes del taller con contacto e historial de equipos reparados.",
      },
      { property: "og:title", content: "Clientes · TallerBinaria" },
      {
        property: "og:description",
        content: "Contacto e historial de reparaciones de cada cliente del taller.",
      },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { data: membership } = useWorkshop();
  const wsId = membership?.workshop.id;
  const currency = membership?.workshop.currency ?? "$";
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const customers = useQuery({
    queryKey: ["customers", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, notes, created_at")
        .eq("workshop_id", wsId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = (customers.data ?? []).find((c) => c.id === selectedId) ?? customers.data?.[0];

  const history = useQuery({
    queryKey: ["customer-orders", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_orders")
        .select("id, code, issue, status, device_model, labor_cost, created_at")
        .eq("customer_id", selected!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell
      title="Clientes"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={BTN_INK}>+ Nuevo cliente</DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">Nuevo cliente</DialogTitle>
            </DialogHeader>
            <CustomerForm
              workshopId={wsId}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["customers", wsId] });
              }}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div className={CARD}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-display text-sm font-semibold tracking-tight">
              Directorio del taller
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {(customers.data ?? []).length} clientes
            </span>
          </div>
          {(customers.data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Todavía no hay clientes. Se crean al registrar una orden o con “Nuevo cliente”.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {(customers.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`snap-ui flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-safety/10 ${
                      selected?.id === c.id ? "bg-safety/10" : ""
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center bg-ink font-mono text-[10px] font-bold text-ink-foreground">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {c.phone ?? "sin teléfono"} · {c.email ?? "sin correo"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <aside className={CARD}>
            <div className="border-b border-line px-4 py-3">
              <div className="label-mono">Ficha</div>
              <div className="mt-1 font-display text-lg font-bold tracking-tight">
                {selected.name}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {selected.phone ?? "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">{selected.email ?? "—"}</div>
            </div>
            <div className="px-4 py-3">
              <div className="label-mono">Historial de equipos</div>
              <ul className="mt-2 space-y-2">
                {(history.data ?? []).length === 0 ? (
                  <li className="text-[13px] text-muted-foreground">Sin reparaciones aún.</li>
                ) : (
                  (history.data ?? []).map((o) => (
                    <li key={o.id} className="border-b border-line pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {o.code}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusMeta(o.status as OrderStatus).badge}`}
                        >
                          {statusMeta(o.status as OrderStatus).label}
                        </span>
                      </div>
                      <div className="text-[13px]">{o.device_model ?? "Equipo"}</div>
                      <div className="text-[11px] text-muted-foreground">{o.issue}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Mano de obra {money(o.labor_cost, currency)}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}

function CustomerForm({
  workshopId,
  onDone,
}: {
  workshopId: string | undefined;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workshopId) return;
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      workshop_id: workshopId,
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente guardado");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label-mono">Nombre</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-mono">Teléfono</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label className="label-mono">Correo</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </div>
      </div>
      <div>
        <label className="label-mono">Notas</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={FIELD}
        />
      </div>
      <button disabled={saving} className={`${BTN_INK} w-full py-2.5`}>
        {saving ? "Guardando…" : "Guardar cliente"}
      </button>
    </form>
  );
}
