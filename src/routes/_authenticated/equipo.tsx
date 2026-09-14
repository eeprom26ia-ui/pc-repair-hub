import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";
import { BTN_INK, CARD, FIELD, ROLE_LABELS, initials, type WorkshopRole } from "@/lib/taller";

export const Route = createFileRoute("/_authenticated/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo y roles · TallerBinaria" },
      {
        name: "description",
        content:
          "Personal del taller con roles de propietario, recepción y técnico, y su nivel de acceso.",
      },
      { property: "og:title", content: "Equipo y roles · TallerBinaria" },
      {
        property: "og:description",
        content: "Administra quién trabaja en el taller y con qué permisos.",
      },
    ],
  }),
  component: EquipoPage,
});

const PERMISSIONS: Record<WorkshopRole, string[]> = {
  propietario: [
    "Ve y edita todo: órdenes, clientes, inventario y cobros",
    "Agrega miembros al taller y cambia los roles del equipo",
    "Puede editar o eliminar el taller",
  ],
  recepcion: [
    "Crea órdenes de reparación y registra clientes",
    "Registra pagos y adelantos",
    "Consulta el inventario de repuestos",
  ],
  tecnico: [
    "Actualiza diagnóstico, estado y mano de obra de las órdenes",
    "Agrega piezas a las órdenes (descuenta stock)",
    "Consulta clientes e inventario",
  ],
};

function EquipoPage() {
  const { data: membership } = useWorkshop();
  const wsId = membership?.workshop.id;
  const isOwner = membership?.role === "propietario";
  const qc = useQueryClient();

  const members = useQuery({
    queryKey: ["members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_members")
        .select("id, full_name, role, user_id, created_at")
        .eq("workshop_id", wsId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const owner = (members.data ?? []).find((m) => m.role === "propietario");


  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<WorkshopRole>("tecnico");
  const [adding, setAdding] = useState(false);

  async function changeRole(id: string, role: WorkshopRole) {
    const { error } = await supabase.from("workshop_members").update({ role }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["members", wsId] });
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!wsId) return;
    setAdding(true);
    try {
      const { data: found, error: findError } = await supabase.rpc("find_profile_by_email", {
        _email: email,
      });
      if (findError) throw findError;
      const profile = (found ?? [])[0];
      if (!profile) {
        toast.error("No hay ninguna cuenta registrada con ese correo");
        return;
      }
      if ((members.data ?? []).some((m) => m.user_id === profile.id)) {
        toast.error("Esa persona ya forma parte del taller");
        return;
      }
      const { error } = await supabase.from("workshop_members").insert({
        workshop_id: wsId,
        user_id: profile.id,
        full_name: profile.full_name ?? profile.email,
        role: newRole,
      });
      if (error) throw error;
      toast.success(`${profile.full_name ?? profile.email} se unió como ${ROLE_LABELS[newRole]}`);
      setEmail("");
      setNewRole("tecnico");
      qc.invalidateQueries({ queryKey: ["members", wsId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AppShell title="Equipo y roles">
      <div className="space-y-5">
        <div className={CARD}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-display text-sm font-semibold tracking-tight">
              Personal del taller
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {(members.data ?? []).length} personas
            </span>
          </div>
          <ul className="divide-y divide-line">
            {(members.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-bold text-ink-foreground">
                  {initials(m.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.full_name ?? "Sin nombre"}
                  </span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {ROLE_LABELS[m.role as WorkshopRole]}
                  </span>
                </span>
                {isOwner ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as WorkshopRole)}
                    className={`${FIELD} mt-0 w-40`}
                  >
                    {(Object.keys(ROLE_LABELS) as WorkshopRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {isOwner ? (
          <form onSubmit={addMember} className={`${CARD} p-4`}>
            <div className="label-mono">Agregar técnico o recepción</div>
            <p className="mt-2 max-w-xl text-[13px] leading-snug text-muted-foreground">
              La persona debe tener su cuenta creada (desde "Crear mi taller"). Ingresa el correo
              con el que se registró y asígnale su rol.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className={`${FIELD} mt-0 flex-1`}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as WorkshopRole)}
                className={`${FIELD} mt-0 sm:w-44`}
              >
                <option value="tecnico">{ROLE_LABELS.tecnico}</option>
                <option value="recepcion">{ROLE_LABELS.recepcion}</option>
                <option value="propietario">{ROLE_LABELS.propietario}</option>
              </select>
              <button disabled={adding} className={`${BTN_INK} px-4`}>
                {adding ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </form>
        ) : (
          <div className={`${CARD} p-4`}>
            <div className="label-mono">Cómo se suma alguien al taller</div>
            <p className="mt-2 max-w-xl text-[13px] leading-snug text-muted-foreground">
              Solo el propietario puede agregar técnicos y recepción desde esta pantalla.
            </p>
          </div>
        )}

        <div className={CARD}>
          <div className="border-b border-line px-4 py-2.5">
            <span className="font-display text-sm font-semibold tracking-tight">
              Propietario del taller
            </span>
          </div>
          {owner ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-safety font-mono text-[10px] font-bold text-safety-foreground">
                {initials(owner.full_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {owner.full_name ?? "Sin nombre"}
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  Control total del taller
                </span>
              </span>
            </div>
          ) : (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              Este taller aún no tiene propietario asignado.
            </p>
          )}
        </div>

        <div className={CARD}>
          <div className="border-b border-line px-4 py-2.5">
            <span className="font-display text-sm font-semibold tracking-tight">
              Permisos por rol
            </span>
          </div>
          <ul className="divide-y divide-line">
            {(Object.keys(ROLE_LABELS) as WorkshopRole[]).map((r) => (
              <li key={r} className="px-4 py-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                  {ROLE_LABELS[r]}
                </span>
                <ul className="mt-1.5 space-y-1">
                  {PERMISSIONS[r].map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] leading-snug">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-safety" />
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
