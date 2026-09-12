import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: membership, isLoading } = useWorkshop();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("RB");
  const [currency, setCurrency] = useState("$");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (membership) navigate({ to: "/ordenes", replace: true });
  }, [membership, navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setFullName(meta?.full_name ?? data.user?.email ?? "");
    });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Sesión no válida");

      const { data: workshop, error } = await supabase
        .from("workshops")
        .insert({ name, code_prefix: prefix.toUpperCase(), currency, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;

      const { error: memberError } = await supabase.from("workshop_members").insert({
        workshop_id: workshop.id,
        user_id: user.id,
        full_name: fullName,
        role: "propietario",
      });
      if (memberError) throw memberError;

      await queryClient.invalidateQueries({ queryKey: ["membership"] });
      navigate({ to: "/ordenes", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el taller");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-paper text-sm">Cargando…</div>;
  }

  return (
    <div className="workfloor grid min-h-screen place-items-center bg-paper px-4 font-body text-ink">
      <form onSubmit={create} className="w-full max-w-md rounded-lg bg-surface ring-1 ring-black/5">
        <div className="border-b border-line px-6 py-4">
          <h1 className="font-display text-lg font-bold tracking-tight">Crea tu taller</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada taller tiene sus propias órdenes, clientes, piezas y equipo.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div>
            <label className="label-mono">Nombre del taller</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-safety"
              placeholder="Taller Norte · Local 1"
            />
          </div>
          <div>
            <label className="label-mono">Tu nombre</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-safety"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono">Prefijo de órdenes</label>
              <input
                required
                maxLength={4}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-safety"
              />
            </div>
            <div>
              <label className="label-mono">Símbolo de moneda</label>
              <input
                required
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-safety"
              />
            </div>
          </div>
        </div>
        <div className="border-t border-line px-6 py-4">
          <button
            disabled={saving}
            className="snap-ui w-full rounded-md bg-ink py-2.5 text-xs font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-60"
          >
            {saving ? "Creando…" : "Crear taller"}
          </button>
        </div>
      </form>
    </div>
  );
}
