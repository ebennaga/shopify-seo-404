// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '@/lib/shopify';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');

  if (!shop) {
    return NextResponse.json(
      { error: "Parameter 'shop' tidak ditemukan" },
      { status: 400 },
    );
  }

  const isValidShop = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
  if (!isValidShop) {
    return NextResponse.json(
      { error: 'Format domain tidak valid' },
      { status: 400 },
    );
  }

  // Buat OAuth URL langsung tanpa rawResponse
  const apiKey = process.env.SHOPIFY_API_KEY!;
  const scopes = process.env.SHOPIFY_SCOPES!;
  const appUrl = process.env.SHOPIFY_APP_URL!;
  const redirectUri = `${appUrl}/api/auth/callback`;

  // Generate random state untuk keamanan (anti CSRF)
  const state = Math.random().toString(36).substring(2, 15);

  // Simpan state ke cookie sementara untuk diverifikasi di callback
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=value`;

  const res = NextResponse.redirect(authUrl);

  // Simpan state di cookie untuk verifikasi nanti
  res.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 menit
    path: '/',
  });

  return res;
}
