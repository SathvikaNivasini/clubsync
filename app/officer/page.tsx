import { OfficerBoard } from "@/components/officer-board";
import { Shell } from "@/components/ui/shell";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Officer" };
export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const { supabase, name } = await requireRole("officer");
  const { data } = await supabase.from("officers").select("clubs(name, code)").maybeSingle();
  const club = (data as { clubs?: { name?: string; code?: string } } | null)?.clubs;

  return (
    <Shell role="Officer" name={name}>
      <OfficerBoard clubName={club?.name ?? "Your club"} clubCode={club?.code ?? ""} />
    </Shell>
  );
}
