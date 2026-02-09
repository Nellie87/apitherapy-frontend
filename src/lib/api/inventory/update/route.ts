import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server only
);

export async function POST(req: Request) {
  try {
    const { orgId, productId, qty_on_hand, reorder_level } = await req.json();

    const { data, error } = await supabase
      .from("inventory")
      .update({
        qty_on_hand,
        reorder_level,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("product_id", productId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
