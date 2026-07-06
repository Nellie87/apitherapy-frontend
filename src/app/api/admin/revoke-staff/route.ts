import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { org_id, user_id } = await request.json();

    if (!org_id || !user_id) {
      return NextResponse.json(
        { error: "Missing org_id or user_id" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.id === user_id) {
      return NextResponse.json(
        { error: "You cannot revoke your own access." },
        { status: 400 }
      );
    }

    const { data: actor, error: actorError } = await supabase
      .from("org_members")
      .select("role, active")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (actorError) {
      return NextResponse.json({ error: actorError.message }, { status: 400 });
    }

    if (!actor || actor.role !== "owner" || actor.active === false) {
      return NextResponse.json(
        { error: "Only active owners can revoke staff access." },
        { status: 403 }
      );
    }

    const { data: target, error: targetError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json(
        { error: "Staff member not found." },
        { status: 404 }
      );
    }

    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Owner access cannot be revoked here." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("org_members")
      .update({ active: false })
      .eq("org_id", org_id)
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Staff access revoked.",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not revoke staff access." },
      { status: 500 }
    );
  }
}