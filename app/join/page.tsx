import Link from "next/link";
import { JoinForm } from "@/components/join-form";
import { Wordmark } from "@/components/ui/logo";

export const metadata = { title: "Join" };

export default function JoinPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5">
        <Link href="/"><Wordmark /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rise"><JoinForm /></div>
      </main>
    </div>
  );
}
