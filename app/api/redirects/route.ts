import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getShop } from "@/lib/supabase";
import { createShopifyRedirect, deleteShopifyRedirect } from "@/lib/shopify";

// GET /api/redirects?shop=xxx
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("redirect_rules")
    .select("*")
    .eq("shop_domain", shop)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/redirects
// Buat redirect baru — simpan ke Supabase DAN Shopify sekaligus
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shop, from_path, to_path, error_id } = body;

  if (!shop || !from_path || !to_path) {
    return NextResponse.json(
      { error: "Missing shop, from_path, or to_path" },
      { status: 400 },
    );
  }

  if (!from_path.startsWith("/") || !to_path.startsWith("/")) {
    return NextResponse.json(
      { error: "Path harus diawali dengan /" },
      { status: 400 },
    );
  }

  // Ambil access token toko
  const shopData = await getShop(shop);
  if (!shopData) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let shopifyRedirectId: number | null = null;

  // Buat redirect di Shopify
  try {
    const shopifyRedirect = await createShopifyRedirect(
      shopData.access_token,
      shop,
      from_path,
      to_path,
    );
    shopifyRedirectId = shopifyRedirect.id;
    console.log(`✅ Redirect dibuat di Shopify: ${from_path} → ${to_path}`);
  } catch (err: any) {
    // Error 422 = redirect sudah ada di Shopify, lanjut saja
    if (!err.message?.includes("422")) {
      return NextResponse.json(
        { error: "Shopify error: " + err.message },
        { status: 500 },
      );
    }
  }

  // Simpan ke Supabase
  const { data, error } = await supabaseAdmin
    .from("redirect_rules")
    .upsert(
      {
        shop_domain: shop,
        from_path,
        to_path,
        type: "301",
        shopify_redirect_id: shopifyRedirectId,
      },
      { onConflict: "shop_domain,from_path" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Kalau ada error_id, update status error jadi fixed
  if (error_id) {
    await supabaseAdmin
      .from("errors_404")
      .update({
        status: "fixed",
        shopify_redirect_id: shopifyRedirectId,
      })
      .eq("id", error_id);
  }

  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/redirects
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id, shop } = body;

  if (!id || !shop) {
    return NextResponse.json({ error: "Missing id or shop" }, { status: 400 });
  }

  // Ambil data redirect
  const { data: rule } = await supabaseAdmin
    .from("redirect_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  // Hapus dari Shopify kalau ada ID-nya
  if (rule.shopify_redirect_id) {
    const shopData = await getShop(shop);
    if (shopData) {
      try {
        await deleteShopifyRedirect(
          shopData.access_token,
          shop,
          rule.shopify_redirect_id,
        );
      } catch (e) {
        // Abaikan kalau sudah tidak ada di Shopify
      }
    }
  }

  // Hapus dari Supabase
  await supabaseAdmin.from("redirect_rules").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
