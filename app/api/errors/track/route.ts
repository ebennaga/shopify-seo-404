import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, suggestTargetUrl, getShop } from "@/lib/supabase";

// POST /api/errors/track
// Dipanggil oleh 404-tracker.js dari storefront merchant
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop, url, referrer, userAgent } = body;

    if (!shop || !url) {
      return NextResponse.json(
        { error: "Missing shop or url" },
        { status: 400 },
      );
    }

    // Pastikan toko terdaftar di database kita
    const shopData = await getShop(shop);
    if (!shopData) {
      return NextResponse.json(
        { error: "Shop not registered" },
        { status: 401 },
      );
    }

    // Bersihkan URL dari query string dan hash
    // Contoh: /products/baju?color=red#top → /products/baju
    const cleanUrl = url.split("?")[0].split("#")[0];

    // Cek apakah URL ini sudah pernah dicatat
    const { data: existing } = await supabaseAdmin
      .from("errors_404")
      .select("id, hits, status")
      .eq("shop_domain", shop)
      .eq("url", cleanUrl)
      .single();

    if (existing) {
      // Kalau sudah ada dan sudah di-fix, abaikan
      if (existing.status === "fixed") {
        return NextResponse.json({ skipped: true });
      }

      // Update jumlah hits dan waktu terakhir dilihat
      await supabaseAdmin
        .from("errors_404")
        .update({
          hits: existing.hits + 1,
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // URL baru — insert ke database dengan auto-suggestion
      const suggested = suggestTargetUrl(cleanUrl);

      await supabaseAdmin.from("errors_404").insert({
        shop_domain: shop,
        url: cleanUrl,
        referrer: referrer || null,
        user_agent: userAgent || null,
        hits: 1,
        suggested_target: suggested,
        status: "pending",
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      });

      // Cek apakah ada auto-pattern yang cocok
      await checkAutoPattern(shop, cleanUrl, shopData.access_token);
    }

    // CORS header wajib karena request dari domain lain (toko merchant)
    return new NextResponse(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Track error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Wajib untuk CORS preflight request
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Cek auto-pattern dan buat redirect otomatis kalau cocok
async function checkAutoPattern(
  shopDomain: string,
  brokenUrl: string,
  accessToken: string,
) {
  // Ambil semua pattern yang aktif untuk toko ini
  const { data: patterns } = await supabaseAdmin
    .from("auto_patterns")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("is_active", true);

  if (!patterns?.length) return;

  for (const pattern of patterns) {
    // Konversi wildcard ke regex
    // Contoh: /products/old-* → ^/products/old-.+$
    const regexStr = pattern.match_pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".+");

    const regex = new RegExp(`^${regexStr}$`);
    if (!regex.test(brokenUrl)) continue;

    // Cocok! Buat redirect otomatis di Shopify
    try {
      const res = await fetch(
        `https://${shopDomain}/admin/api/2026-01/url_redirects.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            redirect: { path: brokenUrl, target: pattern.target_url },
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();

        // Update status error jadi fixed
        await supabaseAdmin
          .from("errors_404")
          .update({
            status: "fixed",
            shopify_redirect_id: data.url_redirect.id,
            suggested_target: pattern.target_url,
          })
          .eq("shop_domain", shopDomain)
          .eq("url", brokenUrl);

        // Tambah matched_count di pattern
        await supabaseAdmin
          .from("auto_patterns")
          .update({ matched_count: pattern.matched_count + 1 })
          .eq("id", pattern.id);

        console.log(
          `⚡ Auto-pattern applied: ${brokenUrl} → ${pattern.target_url}`,
        );
      }
    } catch (e) {
      console.error("Auto-pattern error:", e);
    }
    break;
  }
}
