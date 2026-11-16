import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Wordmark } from "@/components/ui/logo";
import { IconShield } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Exactly what ClubSync stores, what it does not, and what the infrastructure processes.",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-line align-top">
      <th scope="row" className="py-2.5 pr-5 text-left text-sm font-medium text-ink">{label}</th>
      <td className="py-2.5 text-sm leading-relaxed text-muted">{value}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/"><Wordmark /></Link>
        <Link href="/login" className="cs-btn cs-btn-ghost text-sm">Sign in</Link>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-10 px-5 pb-20 sm:px-8">
        <div className="space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <IconShield size={20} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">What ClubSync stores</h1>
          <p className="text-base leading-relaxed text-muted">
            ClubSync asks students for the least it can get away with: a made-up username and a
            password. This page is the whole picture, including the parts that are not flattering.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">Never collected</h2>
          <p className="text-sm leading-relaxed text-muted">
            These are not optional fields left blank — there is no column for them anywhere in the
            database, so they cannot be added later without a schema change:
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              "Real names",
              "Email addresses",
              "Phone numbers",
              "Student or school ID numbers",
              "Dates of birth",
              "Home addresses",
              "Photographs",
              "Contacts or social accounts",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-lg border border-line bg-canvas-deep px-3 py-2 text-sm text-muted"
              >
                <span className="text-danger" aria-hidden="true">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">Stored, and why</h2>
          <div className="cs-card overflow-hidden">
            <table className="w-full">
              <caption className="sr-only">Data ClubSync stores and the reason for each item</caption>
              <thead>
                <tr>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">Item</th>
                  <th scope="col" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">Why</th>
                </tr>
              </thead>
              <tbody className="px-5">
                <Row label="Your chosen username" value="So you can sign back in, and so your availability belongs to one account across every club." />
                <Row label="A hash of your password" value="Hashed and verified by Supabase Auth. ClubSync's own code never sees the password." />
                <Row label="A hash of your recovery phrase" value="One-way scrypt hash. It can check a phrase you type, but it cannot reproduce the words." />
                <Row label="Which clubs you joined" value="So your calendar shows the right meetings. Visible to you only — leaders see a count, not a list." />
                <Row label="Your availability selections" value="The whole point of the product. Readable only by you; leaders get aggregate counts." />
                <Row label="Push subscription endpoints" value="Only if you turn notifications on. Includes a coarse device label like 'Chrome on Android' so you can tell your devices apart." />
                <Row label="Timestamps" value="When you joined a club and when you last updated availability, so leaders know how fresh the numbers are." />
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">What your club leader can see</h2>
          <p className="text-sm leading-relaxed text-muted">
            A leader&apos;s dashboard is built entirely from aggregate database functions. Those
            functions return counts and percentages; there is no code path that returns a member
            id, a username, or one person&apos;s grid. The database enforces this with Row Level
            Security, not just the user interface — a leader querying the member or availability
            tables directly gets zero rows back.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#4ed2a659] bg-[#4ed2a60f] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-success">They do see</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                <li>Total members in the club</li>
                <li>How many have and have not submitted</li>
                <li>Counts per day and per time period</li>
                <li>When availability was last updated</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[#f2635c59] bg-danger-soft p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-danger">They never see</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                <li>Your username or member row</li>
                <li>Which slots you personally picked</li>
                <li>Whether a specific person submitted</li>
                <li>Your custom time-range notes</li>
              </ul>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-dim">
            One honest caveat: in a very small club, aggregate counts can still narrow things down.
            If a club has three members and two are free on Friday, a leader who knows one
            member&apos;s schedule can infer the rest. Aggregation protects you in proportion to
            how many people share the club.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            &ldquo;Anonymous&rdquo; means pseudonymous
          </h2>
          <Alert tone="warning" title="Technical metadata still exists">
            Your ClubSync account carries no identifying details, but it is not the same as being
            untraceable. The services that run the application process technical data as a normal
            part of delivering it:
          </Alert>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <strong className="text-ink">The web host</strong> sees IP addresses and user-agent
              strings in request logs, as any web server does.
            </li>
            <li>
              <strong className="text-ink">Supabase</strong> stores the database rows above, plus
              its own authentication records including sign-in timestamps.
            </li>
            <li>
              <strong className="text-ink">Your browser&apos;s push service</strong> — Google,
              Mozilla or Apple, depending on your browser — handles notification delivery and sees
              that a message was sent to your device. ClubSync encrypts the contents, but the push
              service knows the delivery happened.
            </li>
            <li>
              <strong className="text-ink">Your school network</strong>, if you use it, can see
              that you visited ClubSync.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted">
            ClubSync minimises what it keeps: it stores no analytics, sets no tracking cookies,
            loads no third-party scripts, and records a coarse device label rather than the full
            user-agent string. The only cookies are the ones that keep you signed in.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">Account recovery, and its limits</h2>
          <p className="text-sm leading-relaxed text-muted">
            Because there is no email address or phone number on file, the usual
            &ldquo;reset by email&rdquo; route does not exist. Instead you get a twelve-word
            recovery phrase once, at sign-up. ClubSync stores only a one-way hash of it.
          </p>
          <Alert tone="danger" title="If you lose both your password and your phrase, the account is gone">
            Nobody can recover it — not your club leader, not your school, not whoever operates the
            deployment. There is deliberately no identity to verify you against. You would create a
            new account and rejoin your clubs with their codes.
          </Alert>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-ink">Deleting your data</h2>
          <p className="text-sm leading-relaxed text-muted">
            Leaving a club deletes your availability for it immediately, by database cascade.
            Deleting your account removes your member row, every membership, all your availability,
            your notifications and your push subscriptions in the same cascade. Published meetings
            belong to the club and remain, but they never referenced you.
          </p>
        </section>

        <div className="cs-divider" />

        <p className="text-sm text-muted">
          <Link href="/" className="cs-link font-semibold">Back to the landing page</Link>
        </p>
      </main>
    </div>
  );
}
