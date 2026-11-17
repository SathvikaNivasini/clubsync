import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";

const STEPS = [
  { who: "Sponsor", does: "Marks free days", emoji: "📅", color: "from-[#14b49c] to-[#0b8273]" },
  { who: "Officer", does: "Opens a vote", emoji: "🗳️", color: "from-[#4f8ef7] to-[#3367d6]" },
  { who: "Student", does: "Picks what works", emoji: "✋", color: "from-[#f0a63d] to-[#d8821a]" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Wordmark />
        <Link href="/login" className="btn btn-primary text-sm">Sign in</Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="rise py-10 text-center sm:py-16">
          <h1 className="mx-auto max-w-2xl text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Club meetings,
            <br />
            <span className="text-primary">settled in a day.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted">
            Before school or after school. That&apos;s the only choice.
          </p>
          <Link href="/login" className="btn btn-primary mt-7 px-6 py-3 text-base">
            Get started
          </Link>
        </section>

        {/* three stacked, tilted cards — the 3D bit */}
        <section className="grid gap-4 py-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.who}
              className="card rise p-6 text-center"
              style={{
                animationDelay: `${i * 90}ms`,
                transform: `perspective(900px) rotateX(6deg) translateY(${i * -4}px)`,
              }}
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-2xl shadow-[0_8px_20px_-8px_rgba(16,21,31,.45)]`}
              >
                {s.emoji}
              </div>
              <p className="mt-4 text-lg font-bold">{s.who}</p>
              <p className="text-sm text-muted">{s.does}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
