import { OfficerBoard } from "@/components/officer-board";
import { Shell } from "@/components/ui/shell";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Officer" };
export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const { supabase, name } = await requireRole("officer");
  const { data } = await supabase.from("officers").select("club_id, clubs(name)").maybeSingle();
  const clubName =
    (data as { clubs?: { name?: string } } | null)?.clubs?.name ?? "Your club";

  return (
    <Shell role="Officer" name={name}>
      <OfficerBoard clubName={clubName} />
    </Shell>
  );
}
