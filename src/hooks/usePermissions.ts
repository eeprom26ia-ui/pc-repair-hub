import { useWorkshop } from "@/hooks/useWorkshop";
import { roleCan, type Permission } from "@/lib/permissions";

export function usePermissions() {
  const { data: membership, isFetched, isLoading } = useWorkshop();
  const role = membership?.role;

  return {
    role,
    isFetched,
    isLoading,
    can: (permission: Permission) => roleCan(role, permission),
  };
}
