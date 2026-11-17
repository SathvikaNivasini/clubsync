import { SponsorBoard } from "@/components/sponsor-board";
import { Shell } from "@/components/ui/shell";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Sponsor" };
export const dynamic = "force-dynamic";

export default async function SponsorPage() {
  const { supabase, name } = await requireRole("sponsor");
  const { data } = await supabase.rpc("my_clubs");

  return (
    <Shell role="Sponsor" name={name}>
      <SponsorBoard clubs={(data as { club_id: string; code: string; name: string }[]) ?? []} />
    </Shell>
  );
}
