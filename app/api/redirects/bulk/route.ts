import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getShop } from "@/lib/supabase";
import { createShopifyRedirect } from "@/lib/shopify";

// POST /api/redirects/bulk
// Fix semua 404 pending sekaligus dengan 1 klik
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shop, mode, pairs } = body;

  if (!shop) {
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });
  }

  const shopData = await getShop(shop);
  if (!shopData) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let redirectPairs: { from: string; to: string; error_id?: string }[] = [];

  if (mode === "fix_all") {
    // Ambil semua 404 pending yang punya suggested_target
    const { data: errors } = await supabaseAdmin
      .from("errors_404")
      .select("id, url, suggested_target")
      .eq("shop_domain", shop)
      .eq("status", "pending")
      .not("suggested_target", "is", null);

    redirectPairs = (errors || []).map((e) => ({
      from: e.url,
      to: e.suggested_target!,
      error_id: e.id,
    }));
  } else if (mode === "import" && pairs?.length) {
    redirectPairs = pairs;
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  if (!redirectPairs.length) {
    return NextResponse.json({
      message: "Tidak ada yang perlu diproses",
      created: 0,
    });
  }

  let created = 0;
  let failed = 0;

  // Proses satu per satu
  for (const pair of redirectPairs) {
    try {
      // Buat di Shopify
      const shopifyRedirect = await createShopifyRedirect(
        shopData.access_token,
        shop,
        pair.from,
        pair.to,
      );

      // Simpan ke Supabase
      await supabaseAdmin.from("redirect_rules").upsert(
        {
          shop_domain: shop,
          from_path: pair.from,
          to_path: pair.to,
          type: "301",
          shopify_redirect_id: shopifyRedirect.id,
        },
        { onConflict: "shop_domain,from_path" },
      );

      // Update status error kalau ada
      if (pair.error_id) {
        await supabaseAdmin
          .from("errors_404")
          .update({
            status: "fixed",
            shopify_redirect_id: shopifyRedirect.id,
          })
          .eq("id", pair.error_id);
      }

      created++;
    } catch (err: any) {
      console.error(`Failed: ${pair.from}`, err.message);
      failed++;
    }
  }

  return NextResponse.json({
    message: "Bulk selesai",
    created,
    failed,
    total: redirectPairs.length,
  });
}
