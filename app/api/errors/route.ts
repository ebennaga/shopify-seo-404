import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, suggestTargetUrl } from "@/lib/supabase";

// GET /api/errors?shop=xxx
// Ambil semua 404 errors untuk satu toko
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  const status = req.nextUrl.searchParams.get("status"); // pending | fixed | all

  if (!shop) {
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("errors_404")
    .select("*")
    .eq("shop_domain", shop)
    .order("hits", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-suggest target kalau belum ada
  const enriched = (data || []).map((e) => ({
    ...e,
    suggested_target: e.suggested_target || suggestTargetUrl(e.url),
  }));

  return NextResponse.json({ data: enriched });
}

// PATCH /api/errors
// Update status error (ignored/fixed) atau update suggested_target
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, suggested_target } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates: any = {};
  if (status) updates.status = status;
  if (suggested_target) updates.suggested_target = suggested_target;

  const { data, error } = await supabaseAdmin
    .from("errors_404")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE /api/errors
// Hapus error dari database
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { ids } = body;

  if (!ids?.length) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("errors_404")
    .delete()
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
