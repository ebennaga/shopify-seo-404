// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { upsertShop } from "@/lib/supabase";
import { installScriptTag } from "@/lib/shopify";
import { setShopCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");
    const host = searchParams.get("host") ?? "";

    if (!shop || !code) {
      return NextResponse.json(
        { error: "Missing shop or code" },
        { status: 400 },
      );
    }

    console.log(`🔄 OAuth callback untuk: ${shop}`);

    // Tukar code → access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY!,
        client_secret: process.env.SHOPIFY_API_SECRET!,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error("Gagal dapat token: " + err);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    console.log(`✅ Token didapat untuk: ${shop}`);

    // Simpan ke Supabase
    await upsertShop(shop, accessToken, scope);
    console.log(`✅ Shop tersimpan di Supabase`);

    // Pasang ScriptTag 404 tracker
    const appUrl = process.env.SHOPIFY_APP_URL!;
    try {
      await installScriptTag(accessToken, shop, appUrl);
      console.log(`✅ ScriptTag terpasang`);
    } catch (e) {
      // ScriptTag gagal tidak fatal, lanjut saja
      console.log(`⚠️ ScriptTag gagal tapi lanjut:`, e);
    }

    // Redirect ke dashboard
    const dashboardUrl = `${appUrl}/dashboard?shop=${shop}&host=${host}`;

    const res = NextResponse.redirect(dashboardUrl);

    // Set cookie session
    setShopCookie(res, shop);

    // CSP header untuk embedded app
    res.headers.set(
      "Content-Security-Policy",
      `frame-ancestors https://${shop} https://admin.shopify.com;`,
    );

    return res;
  } catch (err: any) {
    console.error("❌ Callback error:", err.message);
    return NextResponse.json(
      { error: "Auth gagal: " + err.message },
      { status: 500 },
    );
  }
}
