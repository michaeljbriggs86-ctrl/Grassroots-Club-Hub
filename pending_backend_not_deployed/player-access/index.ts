// Grassroots Club Hub v2.2.4 — player-access Edge Function
// STATUS: WRITTEN 2026-09-19. NOT DEPLOYED.
//
// Actions:
//   issue: authenticated Club Admin / Coach / Assistant Coach creates or rotates
//          a reusable U15 player code.
//   login: player enters display name + reusable code. No player email/phone is requested.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PLAYER_LOGIN_PEPPER = Deno.env.get("PLAYER_LOGIN_PEPPER") ?? "";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function nameKey(value: unknown) {
  return normalizeName(value).toLocaleLowerCase("en-GB");
}

function normalizeCode(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function codeHash(code: string) {
  return sha256(`${PLAYER_LOGIN_PEPPER}|code|${normalizeCode(code)}`);
}

async function accountPassword(credentialId: string, code: string) {
  const digest = await sha256(`${PLAYER_LOGIN_PEPPER}|password|${credentialId}|${normalizeCode(code)}`);
  return `GCH-PLAYER-${digest}`;
}

function syntheticEmail(credentialId: string) {
  // Synthetic authentication identifier only. It is never shown as or treated as a
  // contact address and no mail is sent to it.
  return `player-${credentialId}@players.grassrootsclubhub.app`;
}

function randomPlayerCode() {
  // 50 bits from an alphabet that omits visually ambiguous characters.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let raw = "";
  for (const b of bytes) raw += alphabet[b % alphabet.length];
  return `P-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function bearer(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !PLAYER_LOGIN_PEPPER) {
    console.error("player-access is missing required server configuration");
    return reply(503, { error: "Player Access is unavailable." });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return reply(400, { error: "Invalid request." });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const action = String(payload.action ?? "").toLowerCase();

  if (action === "issue") {
    const token = bearer(req);
    if (!token) return reply(401, { error: "Sign in required." });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply(401, { error: "Sign in required." });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id,club_id,team_id,role")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError || !profile) return reply(403, { error: "Access denied." });
    if (!["club_admin", "coach", "assistant_coach"].includes(profile.role)) {
      return reply(403, { error: "Club Admin, Coach or Assistant Coach access required." });
    }

    const teamId = String(payload.team_id ?? "").trim();
    const playerName = normalizeName(payload.player_name);
    if (!teamId || playerName.length < 2 || playerName.length > 120) {
      return reply(400, { error: "Choose a player before creating a code." });
    }

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id,club_id,age_group,active")
      .eq("id", teamId)
      .eq("club_id", profile.club_id)
      .eq("active", true)
      .maybeSingle();
    if (teamError || !team) return reply(404, { error: "Team not available." });
    if (Number(team.age_group) !== 15) {
      return reply(400, { error: "Player app access is only available to U15 squads." });
    }
    if (["coach", "assistant_coach"].includes(profile.role) && profile.team_id !== team.id) {
      return reply(403, { error: "Coaching staff can only create access for their own team." });
    }

    const code = randomPlayerCode();
    const hash = await codeHash(code);
    const key = nameKey(playerName);

    const { data: credential, error: upsertError } = await admin
      .from("player_access_credentials")
      .upsert({
        club_id: profile.club_id,
        team_id: team.id,
        player_name: playerName,
        player_name_key: key,
        code_hash: hash,
        active: true,
        created_by: authData.user.id,
        rotated_at: new Date().toISOString(),
      }, { onConflict: "team_id,player_name_key" })
      .select("id,user_id")
      .single();
    if (upsertError || !credential) {
      console.error("player access upsert failed", upsertError);
      return reply(500, { error: "Could not create Player Access." });
    }

    // A rotated code must immediately invalidate the previous credential password.
    if (credential.user_id) {
      const password = await accountPassword(credential.id, code);
      const { error: rotateError } = await admin.auth.admin.updateUserById(credential.user_id, { password });
      if (rotateError) {
        console.error("player auth password rotation failed", rotateError);
        return reply(500, { error: "Could not rotate Player Access." });
      }
    }

    return reply(200, {
      ok: true,
      player_name: playerName,
      player_code: code,
      reusable: true,
      scope: "U15 only",
    });
  }

  if (action === "login") {
    const suppliedName = normalizeName(payload.name);
    const suppliedCode = normalizeCode(payload.code);
    if (suppliedName.length < 2 || suppliedName.length > 120 || suppliedCode.length < 8 || suppliedCode.length > 32) {
      return reply(401, { error: "Player name or code is incorrect." });
    }

    const hash = await codeHash(suppliedCode);
    const key = nameKey(suppliedName);
    const { data: credential, error: credentialError } = await admin
      .from("player_access_credentials")
      .select("id,club_id,team_id,player_name,user_id,active")
      .eq("code_hash", hash)
      .eq("player_name_key", key)
      .eq("active", true)
      .maybeSingle();
    if (credentialError || !credential) return reply(401, { error: "Player name or code is incorrect." });

    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id,club_id,age_group,active")
      .eq("id", credential.team_id)
      .eq("club_id", credential.club_id)
      .eq("active", true)
      .maybeSingle();
    if (teamError || !team || Number(team.age_group) !== 15) {
      return reply(403, { error: "Player Access is not available for this team." });
    }

    const password = await accountPassword(credential.id, suppliedCode);
    const email = syntheticEmail(credential.id);
    let userId = credential.user_id as string | null;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          synthetic_player_access: true,
          player_access_credential_id: credential.id,
        },
      });
      if (createError || !created.user) {
        console.error("player auth user creation failed", createError);
        return reply(500, { error: "Player Access is unavailable." });
      }
      userId = created.user.id;

      const { error: bindError } = await admin
        .from("player_access_credentials")
        .update({ user_id: userId })
        .eq("id", credential.id)
        .is("user_id", null);
      if (bindError) {
        console.error("player credential binding failed", bindError);
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
        return reply(500, { error: "Player Access is unavailable." });
      }
    }

    const now = new Date().toISOString();
    const { error: profileUpsertError } = await admin.from("profiles").upsert({
      user_id: userId,
      club_id: credential.club_id,
      team_id: credential.team_id,
      coach_team_id: null,
      full_name: credential.player_name,
      role: "player",
      access_method: "player_code",
      approved_at: now,
      approved_by: null,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (profileUpsertError) {
      console.error("player profile upsert failed", profileUpsertError);
      return reply(500, { error: "Player Access is unavailable." });
    }

    // Keep the existing public link table authoritative for the player/user relationship.
    const { data: existingLink } = await admin
      .from("player_account_links")
      .select("id")
      .eq("team_id", credential.team_id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!existingLink) {
      const { error: linkError } = await admin.from("player_account_links").insert({
        club_id: credential.club_id,
        team_id: credential.team_id,
        user_id: userId,
        player_name: credential.player_name,
      });
      if (linkError) {
        console.error("player account link failed", linkError);
        return reply(500, { error: "Player Access is unavailable." });
      }
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.session) {
      console.error("player synthetic sign-in failed", signInError);
      return reply(500, { error: "Player Access is unavailable." });
    }

    await admin
      .from("player_access_credentials")
      .update({ last_used_at: now })
      .eq("id", credential.id);

    return reply(200, {
      ok: true,
      role: "player",
      player_name: credential.player_name,
      session: signedIn.session,
    });
  }

  return reply(400, { error: "Unsupported Player Access action." });
});
