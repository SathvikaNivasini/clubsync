import Link from "next/link";

import { Wordmark } from "@/components/ui/logo";
import {
  IconArrowRight,
  IconBell,
  IconChart,
  IconGrid,
  IconShield,
  IconSparkle,
} from "@/components/ui/icons";
import { DAYS, PERIODS } from "@/lib/constants";

/* A static illustration of the heatmap, so the landing page shows the real
   shape of the product without pretending to be live club data. */
const DEMO_GRID: Record<string, number> = {
  "0:lunch": 1, "0:after_school": 2,
  "1:after_school": 3, "1:evening": 1,
  "2:before_school": 1, "2:after_school": 2,
  "3:after_school": 5, "3:evening": 3, "3:lunch": 2,
  "4:after_school": 3, "4:evening": 2,
  "5:evening": 2,
  "6:evening": 1,
};
const DEMO_RAMP = ["#1B222D", "#00675B", "#008676", "#00A693", "#1DC7B1", "#50E6CF"];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="cs-card relative p-5">
      <span className="cs-numeric absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-canvas-deep text-xs font-bold text-primary">
        {n}
      </span>
      <h3 className="mt-2 text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/privacy" className="hidden text-sm font-medium text-muted transition-colors hover:text-ink sm:block">
            Privacy
          </Link>
          <Link href="/login" className="cs-btn cs-btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/register" className="cs-btn cs-btn-primary text-sm">
            Get started
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="cs-rise space-y-6">
              <span className="cs-pill border-[#35c6b159] bg-primary-soft text-primary">
                <IconSparkle size={13} />
                Built for school clubs
              </span>

              <h1 className="text-[2.25rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-[3.25rem]">
                Stop guessing when
                <br />
                your club can meet.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Members tell ClubSync when they are free — anonymously. Leaders see exactly which
                day and time reaches the most people, schedule it in two clicks, and everybody gets
                a notification. No group chat poll, no spreadsheet, no names attached.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/register" className="cs-btn cs-btn-primary">
                  I&apos;m a member — join my club
                  <IconArrowRight size={16} />
                </Link>
                <Link href="/login?role=leader" className="cs-btn cs-btn-ghost">
                  I lead a club
                </Link>
              </div>

              <p className="flex items-center gap-2 text-sm text-muted">
                <IconShield size={15} className="shrink-0 text-primary" />
                No real name, email address or phone number — ever.
              </p>
            </div>

            {/* Product illustration */}
            <div className="cs-card cs-fade overflow-hidden p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                    What a leader sees
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    Availability heatmap · 5 members
                  </p>
                </div>
                <span className="cs-pill">Illustration</span>
              </div>

              <div className="space-y-[3px]">
                <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-[3px]">
                  <span />
                  {DAYS.map((d) => (
                    <span key={d.index} className="pb-1 text-center text-[0.625rem] font-bold text-muted">
                      {d.initial}
                    </span>
                  ))}
                </div>
                {PERIODS.map((p) => (
                  <div key={p.key} className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-[3px]">
                    <span className="flex items-center text-[0.625rem] font-semibold leading-tight text-muted">
                      {p.short}
                    </span>
                    {DAYS.map((d) => {
                      const count = DEMO_GRID[`${d.index}:${p.key}`] ?? 0;
                      const isPeak = count === 5;
                      return (
                        <span
                          key={`${d.index}-${p.key}`}
                          className={`cs-numeric flex h-8 items-center justify-center rounded-[5px] text-[0.625rem] font-bold sm:h-9 ${
                            isPeak ? "ring-2 ring-accent" : ""
                          } ${count > 0 ? "text-[#06201c]" : "text-transparent"}`}
                          style={{ backgroundColor: DEMO_RAMP[count] }}
                        >
                          {count || ""}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-[#35c6b159] bg-primary-soft p-3.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-primary">
                  <IconSparkle size={12} /> Recommended
                </p>
                <p className="mt-1.5 text-base font-bold text-ink">Thursday, After School</p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="cs-numeric font-semibold text-primary">5 of 5</span> members free
                  · 100%
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Four steps, start to finish
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
              ClubSync fixes two problems at once: members never know when meetings are, and
              leaders can never find a time everyone can make.
            </p>

            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Step
                n={1}
                title="Join with a code"
                body="Your leader shares a short club code. Enter it once and you are in — no invitation email, no roster upload."
              />
              <Step
                n={2}
                title="Mark when you're free"
                body="Tap a grid of seven days by four time periods. Add exact time ranges if a period is too blunt. Change it whenever your schedule changes."
              />
              <Step
                n={3}
                title="Your leader sees the totals"
                body="Counts only — never who said what. ClubSync ranks every slot and recommends the one that reaches the most members."
              />
              <Step
                n={4}
                title="Everyone gets told"
                body="The leader publishes a meeting and it lands on your calendar, with a push notification if you turned them on."
              />
            </ol>
          </div>
        </section>

        {/* Two audiences */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="cs-card p-6 sm:p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <IconGrid size={19} />
              </div>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-ink">For members</h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted">
                <li>One anonymous account works across every club you belong to.</li>
                <li>A single calendar showing every club&apos;s meetings, colour-coded.</li>
                <li>Update your availability any time — it is never locked in.</li>
                <li>Notifications when a meeting is scheduled, moved or cancelled.</li>
                <li>Your leader cannot see your name, because ClubSync never asked for it.</li>
              </ul>
              <Link href="/register" className="cs-btn cs-btn-primary mt-6">
                Create an anonymous account
                <IconArrowRight size={16} />
              </Link>
            </div>

            <div className="cs-card p-6 sm:p-7">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <IconChart size={19} />
              </div>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-ink">For club leaders</h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted">
                <li>See how many members submitted availability, and how many have not.</li>
                <li>A heatmap and bar charts built from real submissions, not samples.</li>
                <li>A ranked best-time recommendation, with alternatives.</li>
                <li>Schedule, edit and cancel meetings; members are notified automatically.</li>
                <li>Aggregate numbers only — member identities are never exposed to you.</li>
              </ul>
              <Link href="/login?role=leader" className="cs-btn cs-btn-accent mt-6">
                Sign in to your club
                <IconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="border-t border-line bg-surface/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <IconShield size={20} />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Privacy is the product, not a setting
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              There is no column in the ClubSync database for a name, an email address, a phone
              number or a student ID. Leaders have no read access at all to member rows or
              availability rows — every number on their dashboard comes from an aggregate query
              that cannot return an identity.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Anonymous means pseudonymous, and we say so plainly: your pseudonym is not linked to
              you, but hosting and notification infrastructure still process technical data.
            </p>
            <Link href="/privacy" className="cs-link mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
              Read exactly what is and is not stored
              <IconArrowRight size={15} />
            </Link>
          </div>
        </section>

        {/* Notifications */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="cs-card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconBell size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold tracking-tight text-ink">
                Notifications without handing over your phone number
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                ClubSync uses browser push, so alerts reach your device without an email address or
                a phone number. Push support depends on your browser and device, and you can turn
                it off at any time — the in-app notification centre always has the full history
                either way.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Wordmark size={22} />
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <Link href="/privacy" className="transition-colors hover:text-ink">Privacy</Link>
            <Link href="/login" className="transition-colors hover:text-ink">Sign in</Link>
            <Link href="/register" className="transition-colors hover:text-ink">Create account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
