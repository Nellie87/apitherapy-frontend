import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { org_id } = await request.json();

    if (!org_id) {
      return NextResponse.json({ error: "Missing org_id" }, { status: 400 });
    }

    const { data: members, error: membersError } = await supabase
      .from("org_members")
      .select("user_id, role, created_at")
      .eq("org_id", org_id)
      .order("created_at", { ascending: false });

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 400 });
    }

    const userIds = (members ?? []).map((m) => m.user_id);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 });
    }

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name])
    );

    const result = (members ?? []).map((member) => ({
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      full_name: profileMap.get(member.user_id) ?? null,
    }));

    return NextResponse.json({ members: result });
  } catch {
    return NextResponse.json(
      { error: "Could not load team members." },
      { status: 500 }
    );
  }
}