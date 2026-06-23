import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ROLES = new Set(["owner", "admin", "manager"]);
const CLERK_ROLES = new Set(["sales_clerk", "cashier", "pos"]);

type Body = {
  org_id?: string;
  email?: string;
  full_name?: string;
  role?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { step: "auth", error: authErr?.message ?? "Not signed in." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Body;

    const orgId = body.org_id?.trim();
    const email = body.email?.trim().toLowerCase();
    const fullName = body.full_name?.trim() ?? "";
    const roleRaw = (body.role ?? "sales_clerk").trim().toLowerCase();
    const invitedRole = CLERK_ROLES.has(roleRaw) ? roleRaw : "sales_clerk";

    if (!orgId || !email) {
      return NextResponse.json(
        { step: "validation", error: "org_id and email are required." },
        { status: 400 }
      );
    }

    const { data: membership, error: memErr } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr) {
      return NextResponse.json(
        { step: "membership_check", error: memErr.message },
        { status: 400 }
      );
    }

    const currentRole = String(membership?.role ?? "").trim().toLowerCase();

    if (!ADMIN_ROLES.has(currentRole)) {
      return NextResponse.json(
        {
          step: "permission",
          error: `Only owner/admin/manager can invite staff. Current role: ${
            membership?.role ?? "none"
          }`,
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
const redirectTo = baseUrl
  ? `${baseUrl}/auth/confirm`
  : undefined;
  
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          invited_org_id: orgId,
          invited_role: invitedRole,
        },
        redirectTo,
      });

    if (inviteErr) {
      return NextResponse.json(
        { step: "invite_user", error: inviteErr.message },
        { status: 400 }
      );
    }

    const invitedUserId = invited.user?.id;

    if (!invitedUserId) {
      return NextResponse.json(
        { step: "invite_user_id", error: "No invited user id returned." },
        { status: 500 }
      );
    }

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: invitedUserId,
      full_name: fullName,
      created_at: new Date().toISOString(),
    });

    if (profileErr) {
      return NextResponse.json(
        { step: "profile_upsert", error: profileErr.message },
        { status: 400 }
      );
    }

    const { error: memberErr } = await admin.from("org_members").upsert(
      {
        org_id: orgId,
        user_id: invitedUserId,
        role: invitedRole,
      },
      {
        onConflict: "org_id,user_id",
      }
    );

    if (memberErr) {
      return NextResponse.json(
        { step: "org_member_upsert", error: memberErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      step: "done",
      message: "Invitation sent and staff membership created.",
      user_id: invitedUserId,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        step: "server_exception",
        error: e instanceof Error ? e.message : "Server error",
      },
      { status: 500 }
    );
  }
}