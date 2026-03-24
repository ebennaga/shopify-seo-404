// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { upsertShop } from '@/lib/supabase';
import { installScriptTag } from '@/lib/shopify';
import { setShopCookie } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get('shop')!;
    const code = searchParams.get('code')!;
    const state = searchParams.get('state')!;
    const host = searchParams.get('host') ?? '';

    // Verifikasi state (anti CSRF)
    const savedState = req.cookies.get('shopify_oauth_state')?.value;
    if (!savedState || savedState !== state) {
      return NextResponse.json(
        { error: 'State tidak cocok. Coba install ulang.' },
        { status: 403 },
      );
    }

    // Tukar authorization code → access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY!,
        client_secret: process.env.SHOPIFY_API_SECRET!,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error('Gagal dapat token: ' + err);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    console.log(`✅ OAuth berhasil: ${shop}`);

    // Simpan ke Supabase
    await upsertShop(shop, accessToken, scope);

    // Pasang ScriptTag 404 tracker
    const appUrl = process.env.SHOPIFY_APP_URL!;
    await installScriptTag(accessToken, shop, appUrl);

    // Redirect ke dashboard
    const dashboardUrl = `${appUrl}/dashboard?shop=${shop}&host=${host}`;
    const res = NextResponse.redirect(dashboardUrl);

    // Set cookie session
    setShopCookie(res, shop);

    // Hapus state cookie yang sudah tidak diperlukan
    res.cookies.delete('shopify_oauth_state');

    // CSP header untuk embedded app
    res.headers.set(
      'Content-Security-Policy',
      `frame-ancestors https://${shop} https://admin.shopify.com;`,
    );

    return res;
  } catch (err: any) {
    console.error('❌ Callback error:', err.message);
    return NextResponse.json(
      { error: 'Autentikasi gagal: ' + err.message },
      { status: 500 },
    );
  }
}
