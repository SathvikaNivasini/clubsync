#!/usr/bin/env node
/**
 * Seed clearly-labelled demonstration data so the interface can be previewed.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs
 *   node --env-file=.env.local scripts/seed-demo.mjs --remove
 *
 * Everything created here is marked `is_demo = true` on the club, and every
 * account name starts with `demo_`, so demo data is always distinguishable
 * from real club data and can be removed in one command.
 *
 * This is NOT a substitute for the database integration — the app reads these
 * rows through exactly the same queries, policies and aggregates as real data.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "demo-clubsync-2026";
const removing = process.argv.includes("--remove");

const CLUBS = [
  {
    code: "DEMO-CCTIA",
    name: "CCTIA (demo)",
    school: "Riverside High (demo)",
    description:
      "Demonstration club. Competitive coding and tech innovation; meets after school most weeks.",
    accent_color: "#00AD98",
  },
  {
    code: "DEMO-ROBOTICS",
    name: "Robotics Team (demo)",
    school: "Riverside High (demo)",
    description: "Demonstration club. Build season runs through the winter.",
    accent_color: "#C68627",
  },
];

/* Twelve demo members. The availability pattern is deliberately uneven so the
   heatmap, the day/period charts and the recommendation all have something
   real to show. 0 = Monday ... 6 = Sunday. */
const MEMBERS = [
  { username: "demo_quietfox",   cctia: [[3, "after_school"], [1, "after_school"], [0, "lunch"]],                 robotics: [[5, "evening"]] },
  { username: "demo_bluepanda",  cctia: [[3, "after_school"], [1, "after_school"], [4, "after_school"]],          robotics: [] },
  { username: "demo_swiftotter", cctia: [[3, "after_school"], [3, "evening"], [2, "after_school"]],               robotics: [[5, "evening"], [6, "evening"]] },
  { username: "demo_calmheron",  cctia: [[3, "after_school"], [4, "evening"]],                                    robotics: [] },
  { username: "demo_brightkoi",  cctia: [[3, "after_school"], [1, "after_school"], [3, "lunch"]],                 robotics: [[5, "evening"]] },
  { username: "demo_mossfinch",  cctia: [[3, "after_school"], [0, "before_school"], [2, "before_school"]],        robotics: [] },
  { username: "demo_amberlynx",  cctia: [[1, "after_school"], [3, "after_school"], [4, "after_school"]],          robotics: [[5, "evening"]] },
  { username: "demo_cedarwren",  cctia: [[3, "after_school"], [3, "evening"]],                                    robotics: [] },
  { username: "demo_slateibis",  cctia: [[0, "lunch"], [1, "lunch"], [3, "lunch"], [3, "after_school"]],          robotics: [] },
  { username: "demo_pineroe",    cctia: [[4, "after_school"], [5, "evening"]],                                    robotics: [[6, "evening"]] },
  { username: "demo_duskmoth",   cctia: [],                                                                       robotics: [[5, "evening"]] },
  { username: "demo_hazelrook",  cctia: [],                                                                       robotics: [] },
];

const WINDOWS = {
  demo_swiftotter: [[3, "15:30", "17:30"]],
  demo_slateibis: [[3, "15:15", "16:15"]],
  demo_amberlynx: [[1, "15:30", "16:45"]],
};

function memberEmail(username) {
  return `${username}@members.clubsync.invalid`;
}

async function findUserByEmail(email) {
  // listUsers is paginated; demo data is small so one page is enough.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email === email) ?? null;
}

async function remove() {
  console.log("Removing demo data…");
  for (const club of CLUBS) {
    const { data } = await admin.from("clubs").select("id").eq("code", club.code).maybeSingle();
    if (data) {
      await admin.from("clubs").delete().eq("id", data.id);
      console.log(`  removed club ${club.code}`);
    }
  }
  for (const member of MEMBERS) {
    const user = await findUserByEmail(memberEmail(member.username));
    if (user) {
      await admin.auth.admin.deleteUser(user.id);
      console.log(`  removed member ${member.username}`);
    }
  }
  const leader = await findUserByEmail("demo-cctia@admins.clubsync.invalid");
  if (leader) await admin.auth.admin.deleteUser(leader.id);
  const leader2 = await findUserByEmail("demo-robotics@admins.clubsync.invalid");
  if (leader2) await admin.auth.admin.deleteUser(leader2.id);
  console.log("Done.");
}

async function seed() {
  const clubIds = {};

  for (const club of CLUBS) {
    const { data: existing } = await admin
      .from("clubs")
      .select("id")
      .eq("code", club.code)
      .maybeSingle();

    if (existing) {
      clubIds[club.code] = existing.id;
      console.log(`club ${club.code} already present`);
    } else {
      const { data, error } = await admin
        .from("clubs")
        .insert({ ...club, is_demo: true })
        .select("id")
        .single();
      if (error) {
        console.error(`could not create club ${club.code}:`, error.message);
        process.exit(1);
      }
      clubIds[club.code] = data.id;
      console.log(`created club ${club.code}`);
    }

    // Leader account for the demo club.
    const handle = club.code;
    const email = `${handle.toLowerCase()}@admins.clubsync.invalid`;
    let leader = await findUserByEmail(email);
    if (!leader) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { app_role: "leader", club_code: handle },
      });
      if (error) {
        console.error(`could not create leader for ${handle}:`, error.message);
        process.exit(1);
      }
      leader = data.user;
    }
    const { data: adminRow } = await admin
      .from("club_admins")
      .select("id")
      .eq("user_id", leader.id)
      .maybeSingle();
    if (!adminRow) {
      await admin.from("club_admins").insert({
        club_id: clubIds[club.code],
        user_id: leader.id,
        admin_handle: handle,
        display_name: `${club.name} leader`,
        must_change_password: false,
      });
    }
    console.log(`  leader login ${handle} / ${DEMO_PASSWORD}`);
  }

  for (const member of MEMBERS) {
    const email = memberEmail(member.username);
    let user = await findUserByEmail(email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { app_role: "member", username: member.username },
      });
      if (error) {
        console.error(`could not create ${member.username}:`, error.message);
        continue;
      }
      user = data.user;
    }

    await admin
      .from("members")
      .upsert({ id: user.id, username: member.username }, { onConflict: "id" });

    for (const [code, slots] of [
      ["DEMO-CCTIA", member.cctia],
      ["DEMO-ROBOTICS", member.robotics],
    ]) {
      const clubId = clubIds[code];
      if (!clubId) continue;
      // Everyone joins CCTIA; only members with robotics availability join it.
      if (code === "DEMO-ROBOTICS" && slots.length === 0) continue;

      await admin
        .from("club_memberships")
        .upsert(
          { club_id: clubId, member_id: user.id, member_number: 0 },
          { onConflict: "club_id,member_id", ignoreDuplicates: true },
        );

      if (slots.length > 0) {
        await admin.from("availability").upsert(
          slots.map(([day, period]) => ({
            club_id: clubId,
            member_id: user.id,
            day_of_week: day,
            period,
          })),
          { onConflict: "club_id,member_id,day_of_week,period", ignoreDuplicates: true },
        );
      }

      const windows = code === "DEMO-CCTIA" ? (WINDOWS[member.username] ?? []) : [];
      if (windows.length > 0) {
        await admin.from("availability_windows").upsert(
          windows.map(([day, start, end]) => ({
            club_id: clubId,
            member_id: user.id,
            day_of_week: day,
            starts_at: start,
            ends_at: end,
          })),
          { onConflict: "club_id,member_id,day_of_week,starts_at,ends_at", ignoreDuplicates: true },
        );
      }
    }
    console.log(`seeded ${member.username}`);
  }

  // One published meeting on the next Thursday, which is the demo data's peak.
  const now = new Date();
  const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + daysUntilThursday);
  const meetingDate = thursday.toISOString().slice(0, 10);

  const { data: existingMeeting } = await admin
    .from("meetings")
    .select("id")
    .eq("club_id", clubIds["DEMO-CCTIA"])
    .eq("meeting_date", meetingDate)
    .maybeSingle();

  if (!existingMeeting) {
    await admin.from("meetings").insert({
      club_id: clubIds["DEMO-CCTIA"],
      title: "Competition prep (demo meeting)",
      description:
        "Demonstration meeting. Bring a laptop; we are running through last year's problem set.",
      location: "Room 214",
      meeting_date: meetingDate,
      starts_at: "15:15",
      ends_at: "17:00",
      period_hint: "after_school",
      estimated_available: 9,
      estimated_total: 12,
    });
    console.log(`created demo meeting on ${meetingDate}`);
  }

  console.log(`
Demo data ready.

  Leader   DEMO-CCTIA      password ${DEMO_PASSWORD}
  Leader   DEMO-ROBOTICS   password ${DEMO_PASSWORD}
  Member   demo_quietfox   password ${DEMO_PASSWORD}
           (any demo_* username above uses the same password)

  Club codes for joining: DEMO-CCTIA, DEMO-ROBOTICS

These credentials are for previewing the interface only. Remove them before
any real use:  node --env-file=.env.local scripts/seed-demo.mjs --remove
`);
}

await (removing ? remove() : seed());
