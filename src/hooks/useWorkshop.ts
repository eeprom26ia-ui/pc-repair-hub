import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkshopRole } from "@/lib/taller";

export type Workshop = {
  id: string;
  name: string;
  code_prefix: string;
  currency: string;
};

export type Membership = {
  id: string;
  role: WorkshopRole;
  full_name: string | null;
  user_id: string;
  workshop: Workshop;
};

export function useWorkshop() {
  return useQuery({
    queryKey: ["membership"],
    queryFn: async (): Promise<Membership | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from("workshop_members")
        .select("id, role, full_name, user_id, workshops(id, name, code_prefix, currency)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data || !data.workshops) return null;

      return {
        id: data.id,
        role: data.role as WorkshopRole,
        full_name: data.full_name,
        user_id: data.user_id,
        workshop: data.workshops as Workshop,
      };
    },
  });
}
