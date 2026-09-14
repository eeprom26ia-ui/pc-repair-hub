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

  async function changeRole(id: string, role: WorkshopRole) {
    const { error } = await supabase.from("workshop_members").update({ role }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["members", wsId] });
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

        <div className={`${CARD} p-4`}>
          <div className="label-mono">Cómo se suma alguien al taller</div>
          <p className="mt-2 max-w-xl text-[13px] leading-snug text-muted-foreground">
            Por ahora cada persona crea su cuenta y el propietario la agrega al taller. Si quieres
            invitaciones por correo desde esta pantalla, dímelo y lo agrego.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
