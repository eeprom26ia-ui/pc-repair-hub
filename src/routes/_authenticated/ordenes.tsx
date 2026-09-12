import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";
import {
  BTN_GHOST,
  BTN_INK,
  CARD,
  FIELD,
  ORDER_STATUSES,
  money,
  relativeTime,
  statusMeta,
  type OrderStatus,
} from "@/lib/taller";

export const Route = createFileRoute("/_authenticated/ordenes")({
  head: () => ({
    meta: [
      { title: "Órdenes de reparación · TallerBinaria" },
      {
        name: "description",
        content:
          "Tablero de órdenes de reparación: equipos en ingreso, diagnóstico, progreso, listos y entregados.",
      },
      { property: "og:title", content: "Órdenes de reparación · TallerBinaria" },
      {
        property: "og:description",
        content: "Sigue cada equipo del taller, su técnico, su diagnóstico y su cotización.",
      },
    ],
  }),
  component: OrdenesPage,
});

type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  issue: string;
  diagnosis: string | null;
  device_type: string | null;
  device_model: string | null;
  serial_number: string | null;
  technician_name: string | null;
  labor_cost: number;
  advance: number;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  customers: { name: string; phone: string | null; email: string | null } | null;
};

function OrdenesPage() {
  const { data: membership } = useWorkshop();
  const workshop = membership?.workshop;
  const wsId = workshop?.id;
  const currency = workshop?.currency ?? "$";
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const orders = useQuery({
    queryKey: ["orders", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_orders")
        .select(
          "id, code, status, issue, diagnosis, device_type, device_model, serial_number, technician_name, labor_cost, advance, created_at, updated_at, customer_id, customers(name, phone, email)",
        )
        .eq("workshop_id", wsId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const customers = useQuery({
    queryKey: ["customers", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email")
        .eq("workshop_id", wsId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_members")
        .select("id, full_name, role, user_id")
        .eq("workshop_id", wsId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const parts = useQuery({
    queryKey: ["parts", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("id, sku, name, stock, min_stock, unit_price")
        .eq("workshop_id", wsId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paymentsToday = useQuery({
    queryKey: ["payments-today", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("payments")
        .select("amount")
        .eq("workshop_id", wsId!)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useMemo(() => {
    const rows = orders.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((o) =>
      [o.code, o.issue, o.device_model, o.customers?.name, o.technician_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [orders.data, search]);

  const selected = list.find((o) => o.id === selectedId) ?? list[0] ?? null;

  const items = useQuery({
    queryKey: ["order-items", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, description, quantity, unit_price")
        .eq("order_id", selected!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paidQuery = useQuery({
    queryKey: ["order-payments", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount")
        .eq("order_id", selected!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const partsTotal = (items.data ?? []).reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.unit_price),
    0,
  );
  const total = partsTotal + Number(selected?.labor_cost ?? 0);
  const paid = (paidQuery.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const activeCount = (orders.data ?? []).filter((o) => o.status !== "entregado").length;
  const diagCount = (orders.data ?? []).filter((o) => o.status === "diagnostico").length;
  const readyCount = (orders.data ?? []).filter((o) => o.status === "listo").length;
  const incomeToday = (paymentsToday.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const lowStock = (parts.data ?? []).filter((p) => p.stock <= p.min_stock).length;

  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: ["orders", wsId] });
  };

  const updateOrder = useMutation({
    mutationFn: async (
      patch: { id: string } & Partial<{
        status: OrderStatus;
        diagnosis: string;
        labor_cost: number;
      }>,
    ) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("repair_orders").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateOrders,
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const addItem = useMutation({
    mutationFn: async (input: {
      partId: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
    }) => {
      if (!selected || !wsId) return;
      const { error } = await supabase.from("order_items").insert({
        workshop_id: wsId,
        order_id: selected.id,
        part_id: input.partId,
        description: input.description,
        quantity: input.quantity,
        unit_price: input.unitPrice,
      });
      if (error) throw error;
      if (input.partId) {
        const part = (parts.data ?? []).find((p) => p.id === input.partId);
        if (part) {
          await supabase
            .from("parts")
            .update({ stock: Math.max(part.stock - input.quantity, 0) })
            .eq("id", part.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items", selected?.id] });
      qc.invalidateQueries({ queryKey: ["parts", wsId] });
      toast.success("Pieza agregada a la orden");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar"),
  });

  const addPayment = useMutation({
    mutationFn: async (amount: number) => {
      if (!selected || !wsId) return;
      const { error } = await supabase
        .from("payments")
        .insert({ workshop_id: wsId, order_id: selected.id, amount, method: "efectivo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-payments", selected?.id] });
      qc.invalidateQueries({ queryKey: ["payments-today", wsId] });
      toast.success("Pago registrado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar el pago"),
  });

  return (
    <AppShell
      title="Órdenes de reparación"
      actions={
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar orden, cliente o equipo…"
            className="w-56 rounded-md border border-line bg-surface px-3 py-2 text-xs outline-none focus:border-safety"
          />
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger className={BTN_INK}>+ Nueva orden</DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display tracking-tight">
                  Registrar equipo en el taller
                </DialogTitle>
              </DialogHeader>
              <NewOrderForm
                workshopId={wsId}
                customers={customers.data ?? []}
                members={members.data ?? []}
                onDone={() => {
                  setNewOpen(false);
                  invalidateOrders();
                  qc.invalidateQueries({ queryKey: ["customers", wsId] });
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Órdenes activas" value={String(activeCount)} note={`${diagCount} en diagnóstico`} />
          <Kpi label="Listos para entrega" value={String(readyCount)} note="Esperan al cliente" />
          <Kpi
            label="Cobrado hoy"
            value={money(incomeToday, currency)}
            note={`${(paymentsToday.data ?? []).length} pagos`}
          />
          <Kpi
            label="Piezas bajo mínimo"
            value={String(lowStock)}
            note="Revisa el inventario"
            warn
          />
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
          <div className={CARD}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-display text-sm font-semibold tracking-tight">
                Órdenes del taller
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {list.length} órdenes
              </span>
            </div>
            <div className="grid grid-cols-[1fr_120px_120px_96px] border-b border-line px-4 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              <span>Orden</span>
              <span>Equipo</span>
              <span>Técnico</span>
              <span className="text-right">Estado</span>
            </div>
            {orders.isLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Cargando órdenes…</p>
            ) : list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Sin órdenes todavía. Registra el primer equipo con “Nueva orden”.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((o) => {
                  const meta = statusMeta(o.status);
                  return (
                    <li key={o.id}>
                      <button
                        onClick={() => setSelectedId(o.id)}
                        className={`snap-ui grid w-full grid-cols-[1fr_120px_120px_96px] items-center px-4 py-2.5 text-left hover:bg-safety/10 ${
                          selected?.id === o.id ? "bg-safety/10" : ""
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {o.code}
                            </span>
                            <span className="truncate text-sm font-medium">
                              {o.customers?.name ?? "Sin cliente"}
                            </span>
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {o.issue}
                          </div>
                        </div>
                        <div className="truncate pr-3 text-xs text-muted-foreground">
                          {o.device_model ?? o.device_type ?? "—"}
                        </div>
                        <div className="truncate pr-3 text-xs">{o.technician_name ?? "—"}</div>
                        <div className="justify-self-end">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected ? (
            <aside className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {selected.code}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusMeta(selected.status).badge}`}
                  >
                    {statusMeta(selected.status).label}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {relativeTime(selected.updated_at)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-line px-4 py-3">
                <div>
                  <div className="label-mono">Equipo</div>
                  <div className="mt-1 text-sm font-medium">
                    {selected.device_model ?? selected.device_type ?? "Equipo"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selected.device_type ?? "—"}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    S/N {selected.serial_number ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="label-mono">Cliente</div>
                  <div className="mt-1 text-sm font-medium">
                    {selected.customers?.name ?? "Sin cliente"}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {selected.customers?.phone ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selected.customers?.email ?? "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-b border-line px-4 py-3">
                <div>
                  <div className="label-mono">Estado</div>
                  <select
                    value={selected.status}
                    onChange={(e) =>
                      updateOrder.mutate({
                        id: selected.id,
                        status: e.target.value as OrderStatus,
                      })
                    }
                    className={FIELD}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <DiagnosisEditor
                  key={selected.id}
                  initial={selected.diagnosis ?? ""}
                  labor={Number(selected.labor_cost)}
                  onSave={(diagnosis, labor) =>
                    updateOrder.mutate({ id: selected.id, diagnosis, labor_cost: labor })
                  }
                />
              </div>

              <div className="border-b border-line px-4 py-3">
                <div className="label-mono">Piezas y trabajos</div>
                <ul className="mt-1.5 space-y-1.5">
                  {(items.data ?? []).map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-[13px]">
                      <span className="truncate pr-2 font-mono text-[12px] text-muted-foreground">
                        {i.description} · {Number(i.quantity)}
                      </span>
                      <span className="font-mono text-[12px]">
                        {money(Number(i.quantity) * Number(i.unit_price), currency)}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between text-[13px]">
                    <span className="font-mono text-[12px] text-muted-foreground">
                      Mano de obra
                    </span>
                    <span className="font-mono text-[12px]">
                      {money(selected.labor_cost, currency)}
                    </span>
                  </li>
                </ul>
                <AddItemForm parts={parts.data ?? []} onAdd={(v) => addItem.mutate(v)} />
              </div>

              <div className="bg-ink px-4 py-3 text-ink-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-widest text-white/50 uppercase">
                    Cotización total
                  </span>
                  <span className="font-display text-2xl font-extrabold tracking-tight">
                    {money(total, currency)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  Pagado {money(paid, currency)} · Saldo {money(Math.max(total - paid, 0), currency)}
                </div>
                <PaymentForm
                  suggested={Math.max(total - paid, 0)}
                  onPay={(amount) => addPayment.mutate(amount)}
                />
              </div>
            </aside>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: string;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className={`${CARD} rise p-4`}>
      <div className="label-mono">{label}</div>
      <div
        className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${warn ? "text-warn" : ""}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

function DiagnosisEditor({
  initial,
  labor,
  onSave,
}: {
  initial: string;
  labor: number;
  onSave: (diagnosis: string, labor: number) => void;
}) {
  const [text, setText] = useState(initial);
  const [laborCost, setLaborCost] = useState(String(labor));
  return (
    <div>
      <div className="label-mono">Diagnóstico</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Qué encontró el técnico y qué recomienda…"
        className={FIELD}
      />
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <div className="label-mono">Mano de obra</div>
          <input
            value={laborCost}
            onChange={(e) => setLaborCost(e.target.value)}
            inputMode="decimal"
            className={FIELD}
          />
        </div>
        <button
          onClick={() => onSave(text, Number(laborCost) || 0)}
          className={`${BTN_INK} shrink-0`}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function AddItemForm({
  parts,
  onAdd,
}: {
  parts: { id: string; name: string; unit_price: number; stock: number }[];
  onAdd: (v: {
    partId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
  }) => void;
}) {
  const [partId, setPartId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("0");

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <select
        value={partId}
        onChange={(e) => {
          setPartId(e.target.value);
          const p = parts.find((x) => x.id === e.target.value);
          if (p) {
            setDescription(p.name);
            setPrice(String(p.unit_price));
          }
        }}
        className={FIELD}
      >
        <option value="">Trabajo o pieza libre…</option>
        {parts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · stock {p.stock}
          </option>
        ))}
      </select>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción"
        className={FIELD}
      />
      <div className="flex items-end gap-2">
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="decimal"
          className={FIELD}
          placeholder="Cant."
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className={FIELD}
          placeholder="Precio"
        />
        <button
          onClick={() => {
            if (!description.trim()) {
              toast.error("Escribe una descripción");
              return;
            }
            onAdd({
              partId: partId || null,
              description,
              quantity: Number(quantity) || 1,
              unitPrice: Number(price) || 0,
            });
            setPartId("");
            setDescription("");
            setQuantity("1");
            setPrice("0");
          }}
          className={`${BTN_GHOST} shrink-0`}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function PaymentForm({
  suggested,
  onPay,
}: {
  suggested: number;
  onPay: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(suggested || 0));
  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-md bg-white/10 px-3 py-2 text-xs text-ink-foreground outline-none placeholder:text-white/40"
        placeholder="Monto"
      />
      <button
        onClick={() => {
          const value = Number(amount);
          if (!value) {
            toast.error("Indica un monto");
            return;
          }
          onPay(value);
        }}
        className="snap-ui shrink-0 rounded-md bg-safety px-3 py-2 text-xs font-semibold text-safety-foreground hover:bg-safety/90"
      >
        Registrar pago
      </button>
    </div>
  );
}

function NewOrderForm({
  workshopId,
  customers,
  members,
  onDone,
}: {
  workshopId: string | undefined;
  customers: { id: string; name: string; phone: string | null; email: string | null }[];
  members: { id: string; full_name: string | null; user_id: string; role: string }[];
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [serial, setSerial] = useState("");
  const [issue, setIssue] = useState("");
  const [technician, setTechnician] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workshopId) return;
    setSaving(true);
    try {
      let finalCustomerId: string | null = customerId || null;
      if (!finalCustomerId && customerName.trim()) {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            workshop_id: workshopId,
            name: customerName,
            phone: phone || null,
            email: email || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        finalCustomerId = data.id;
      }

      const member = members.find((m) => m.user_id === technician);
      const { error } = await supabase.from("repair_orders").insert({
        code: "", // el taller genera el folio automáticamente
        workshop_id: workshopId,
        customer_id: finalCustomerId,
        device_type: deviceType || null,
        device_model: deviceModel || null,
        serial_number: serial || null,
        issue,
        technician_id: technician || null,
        technician_name: member?.full_name ?? null,
      });
      if (error) throw error;
      toast.success("Orden creada");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la orden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label-mono">Cliente existente</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={FIELD}>
          <option value="">Nuevo cliente…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {!customerId && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label-mono">Nombre</label>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label className="label-mono">Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className="label-mono">Correo</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label-mono">Tipo de equipo</label>
          <input
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            placeholder="Laptop"
            className={FIELD}
          />
        </div>
        <div>
          <label className="label-mono">Modelo</label>
          <input
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            placeholder="Dell XPS 13"
            className={FIELD}
          />
        </div>
        <div>
          <label className="label-mono">Número de serie</label>
          <input value={serial} onChange={(e) => setSerial(e.target.value)} className={FIELD} />
        </div>
      </div>
      <div>
        <label className="label-mono">Falla reportada</label>
        <textarea
          required
          rows={3}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="No enciende, se apaga sola…"
          className={FIELD}
        />
      </div>
      <div>
        <label className="label-mono">Técnico asignado</label>
        <select value={technician} onChange={(e) => setTechnician(e.target.value)} className={FIELD}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.user_id}>
              {m.full_name ?? "Sin nombre"}
            </option>
          ))}
        </select>
      </div>
      <button disabled={saving} className={`${BTN_INK} w-full py-2.5`}>
        {saving ? "Guardando…" : "Registrar orden"}
      </button>
    </form>
  );
}
