import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop)
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("auto_patterns")
    .select("*")
    .eq("shop_domain", shop)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shop, name, match_pattern, target_url } = body;

  if (!shop || !name || !match_pattern || !target_url) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("auto_patterns")
    .insert({ shop_domain: shop, name, match_pattern, target_url })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, is_active, name, match_pattern, target_url } = body;

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updates: any = {};
  if (typeof is_active === "boolean") updates.is_active = is_active;
  if (name) updates.name = name;
  if (match_pattern) updates.match_pattern = match_pattern;
  if (target_url) updates.target_url = target_url;

  const { data, error } = await supabaseAdmin
    .from("auto_patterns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("auto_patterns")
    .delete()
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
