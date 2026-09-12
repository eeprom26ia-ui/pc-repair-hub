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
import { BTN_GHOST, BTN_INK, CARD, FIELD, money } from "@/lib/taller";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario de piezas · TallerBinaria" },
      {
        name: "description",
        content: "Stock de repuestos del taller con mínimos, precios y avisos de faltantes.",
      },
      { property: "og:title", content: "Inventario de piezas · TallerBinaria" },
      {
        property: "og:description",
        content: "Controla repuestos, mínimos y precios de las piezas del taller.",
      },
    ],
  }),
  component: InventarioPage,
});

function InventarioPage() {
  const { data: membership } = useWorkshop();
  const wsId = membership?.workshop.id;
  const currency = membership?.workshop.currency ?? "$";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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

  async function adjust(id: string, stock: number) {
    const { error } = await supabase
      .from("parts")
      .update({ stock: Math.max(stock, 0) })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["parts", wsId] });
  }

  return (
    <AppShell
      title="Inventario de piezas"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={BTN_INK}>+ Nueva pieza</DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">Nueva pieza</DialogTitle>
            </DialogHeader>
            <PartForm
              workshopId={wsId}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["parts", wsId] });
              }}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <div className={CARD}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="font-display text-sm font-semibold tracking-tight">
            Piezas en almacén
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {(parts.data ?? []).filter((p) => p.stock <= p.min_stock).length} bajo mínimo
          </span>
        </div>
        <div className="grid grid-cols-[1fr_100px_100px_120px_140px] border-b border-line px-4 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <span>Pieza</span>
          <span>Stock</span>
          <span>Mínimo</span>
          <span>Precio</span>
          <span className="text-right">Ajustar</span>
        </div>
        {(parts.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Aún no hay piezas registradas.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {(parts.data ?? []).map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[1fr_100px_100px_120px_140px] items-center px-4 py-2.5"
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {p.sku ?? "sin clave"}
                  </div>
                </div>
                <div
                  className={`font-mono text-sm ${p.stock <= p.min_stock ? "font-semibold text-warn" : ""}`}
                >
                  {p.stock}
                </div>
                <div className="font-mono text-sm text-muted-foreground">{p.min_stock}</div>
                <div className="font-mono text-sm">{money(p.unit_price, currency)}</div>
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => adjust(p.id, p.stock - 1)} className={BTN_GHOST}>
                    −
                  </button>
                  <button onClick={() => adjust(p.id, p.stock + 1)} className={BTN_GHOST}>
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function PartForm({ workshopId, onDone }: { workshopId: string | undefined; onDone: () => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("1");
  const [price, setPrice] = useState("0");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workshopId) return;
    setSaving(true);
    const { error } = await supabase.from("parts").insert({
      workshop_id: workshopId,
      name,
      sku: sku || null,
      stock: Number(stock) || 0,
      min_stock: Number(minStock) || 0,
      unit_price: Number(price) || 0,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pieza registrada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label-mono">Nombre de la pieza</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fuente 20V"
          className={FIELD}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-mono">Clave / SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label className="label-mono">Precio</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className={FIELD}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-mono">Stock actual</label>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            inputMode="numeric"
            className={FIELD}
          />
        </div>
        <div>
          <label className="label-mono">Mínimo</label>
          <input
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            inputMode="numeric"
            className={FIELD}
          />
        </div>
      </div>
      <button disabled={saving} className={`${BTN_INK} w-full py-2.5`}>
        {saving ? "Guardando…" : "Guardar pieza"}
      </button>
    </form>
  );
}
