import type { WorkshopRole } from "@/lib/taller";

export type Permission =
  | "ordenes.ver"
  | "ordenes.crear"
  | "ordenes.editar"
  | "clientes.ver"
  | "clientes.crear"
  | "inventario.ver"
  | "inventario.editar"
  | "cobros.ver"
  | "cobros.registrar"
  | "equipo.ver"
  | "equipo.gestionar";

export const ROLE_PERMISSIONS: Record<WorkshopRole, Permission[]> = {
  propietario: [
    "ordenes.ver",
    "ordenes.crear",
    "ordenes.editar",
    "clientes.ver",
    "clientes.crear",
    "inventario.ver",
    "inventario.editar",
    "cobros.ver",
    "cobros.registrar",
    "equipo.ver",
    "equipo.gestionar",
  ],
  recepcion: [
    "ordenes.ver",
    "ordenes.crear",
    "ordenes.editar",
    "clientes.ver",
    "clientes.crear",
    "inventario.ver",
    "cobros.ver",
    "cobros.registrar",
    "equipo.ver",
  ],
  tecnico: ["ordenes.ver", "ordenes.editar", "clientes.ver", "inventario.ver", "inventario.editar"],
};

export function roleCan(role: WorkshopRole | undefined, permission: Permission) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
