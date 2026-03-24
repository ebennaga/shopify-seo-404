import { NextRequest, NextResponse } from 'next/server';
import { getShop } from './supabase';

// Nama cookie yang kita pakai untuk simpan session
const COOKIE_NAME = 'seo_redirect_shop';

// ── Simpan domain toko ke cookie ──
export function setShopCookie(res: NextResponse, shopDomain: string) {
  res.cookies.set(COOKIE_NAME, shopDomain, {
    httpOnly: true, // tidak bisa diakses JavaScript
    secure: true, // hanya HTTPS
    sameSite: 'none', // wajib "none" untuk embedded Shopify app
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 hari
  });
}

// ── Ambil domain toko dari cookie ──
export function getShopFromCookie(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

// ── Middleware: pastikan request punya session valid ──
// Dipakai di semua API route yang butuh autentikasi
export async function requireSession(req: NextRequest) {
  const shopDomain = getShopFromCookie(req);

  if (!shopDomain) {
    return { shop: null, error: 'No session cookie' };
  }

  const shop = await getShop(shopDomain);

  if (!shop) {
    return { shop: null, error: 'Shop not found in database' };
  }

  return { shop, error: null };
}
