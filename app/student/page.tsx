import { StudentBoard } from "@/components/student-board";
import { Shell } from "@/components/ui/shell";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Vote" };
export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const { name } = await requireRole("student");
  return (
    <Shell role="Student" name={name}>
      <StudentBoard />
    </Shell>
  );
}
