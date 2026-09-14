import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshop } from "@/hooks/useWorkshop";
import { ROLE_LABELS, initials, todayLabel } from "@/lib/taller";

import { roleCan, type Permission } from "@/lib/permissions";

const OPERACIONES = [
  { to: "/ordenes", label: "Órdenes de reparación", perm: "ordenes.ver" },
  { to: "/clientes", label: "Clientes", perm: "clientes.ver" },
  { to: "/inventario", label: "Inventario de piezas", perm: "inventario.ver" },
  { to: "/cotizaciones", label: "Cotizaciones y pagos", perm: "cobros.ver" },
] as const satisfies ReadonlyArray<{ to: string; label: string; perm: Permission }>;

const GESTION = [
  { to: "/equipo", label: "Equipo y roles", perm: "equipo.ver" },
] as const satisfies ReadonlyArray<{ to: string; label: string; perm: Permission }>;

export function AppShell({
  title,
  actions,
  permission,
  children,
}: {
  title: string;
  actions?: ReactNode;
  permission?: Permission;
  children: ReactNode;
}) {
  const { data: membership, isFetched } = useWorkshop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isFetched && !membership) navigate({ to: "/onboarding", replace: true });
  }, [isFetched, membership, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const workshopName = membership?.workshop.name ?? "Taller";
  const role = membership?.role;
  const operaciones = OPERACIONES.filter((i) => roleCan(role, i.perm));
  const gestion = GESTION.filter((i) => roleCan(role, i.perm));
  const blocked = !!membership && !!permission && !roleCan(role, permission);

  return (
    <div className="workfloor min-h-screen bg-paper font-body text-ink">
      <div className="flex h-screen overflow-hidden">
        <aside className="flex w-60 shrink-0 flex-col bg-ink text-ink-foreground">
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
            <div className="grid size-8 place-items-center bg-safety font-display font-extrabold text-safety-foreground">
              {initials(workshopName)}
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold tracking-tight uppercase">
                {workshopName}
              </div>
              <div className="font-mono text-[10px] tracking-widest text-white/40 uppercase">
                Consola de taller
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-3 py-3">
            <div className="px-2 py-1 font-mono text-[10px] tracking-widest text-white/35 uppercase">
              Taller activo
            </div>
            <div className="flex items-center justify-between rounded-md bg-white/5 px-2 py-2 ring-1 ring-white/10">
              <span className="truncate text-xs font-medium">{workshopName}</span>
              <span className="size-2 rounded-full bg-safety" />
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            <div className="px-2 py-1 font-mono text-[10px] tracking-widest text-white/30 uppercase">
              Operaciones
            </div>
            {operaciones.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="snap-ui flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                activeProps={{
                  className:
                    "snap-ui flex items-center justify-between rounded-md px-2.5 py-2 text-sm bg-safety text-safety-foreground font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
            <div className="px-2 pt-4 pb-1 font-mono text-[10px] tracking-widest text-white/30 uppercase">
              Gestión
            </div>
            {GESTION.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="snap-ui flex items-center justify-between rounded-md px-2.5 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                activeProps={{
                  className:
                    "snap-ui flex items-center justify-between rounded-md px-2.5 py-2 text-sm bg-safety text-safety-foreground font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2.5 px-1">
              <div className="grid size-9 place-items-center rounded-full bg-white/10 font-display text-xs font-bold ring-1 ring-white/15">
                {initials(membership?.full_name)}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">
                  {membership?.full_name ?? "Sin nombre"}
                </div>
                <div className="text-[11px] text-white/45">
                  {membership ? ROLE_LABELS[membership.role] : "—"}
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="snap-ui mt-3 w-full rounded-md bg-white/10 py-2 text-xs font-medium text-white hover:bg-white/15"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface/85 px-6 py-3 backdrop-blur-sm">
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">{title}</h1>
              <p className="text-xs text-muted-foreground">Hoy · {todayLabel()}</p>
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
