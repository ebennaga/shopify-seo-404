import { createClient } from '@supabase/supabase-js';

// ── Client untuk server-side (pakai service role = akses penuh) ──
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Ambil data satu toko berdasarkan domain ──
export async function getShop(domain: string) {
  const { data } = await supabaseAdmin
    .from('shops')
    .select('*')
    .eq('shop_domain', domain)
    .single();
  return data;
}

// ── Simpan/update toko setelah OAuth berhasil ──
export async function upsertShop(
  domain: string,
  accessToken: string,
  scope: string,
) {
  const { data, error } = await supabaseAdmin
    .from('shops')
    .upsert(
      {
        shop_domain: domain,
        access_token: accessToken,
        scope: scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_domain' },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Auto-suggest URL target berdasarkan URL yang error ──
// Contoh: /products/old-baju → /collections/all
export function suggestTargetUrl(brokenUrl: string): string {
  const path = brokenUrl.split('?')[0]; // buang query string
  const segments = path.split('/').filter(Boolean);
  const first = segments[0];

  if (first === 'products') return '/collections/all';
  if (first === 'collections') return '/collections';
  if (first === 'blogs') return '/blogs';
  if (first === 'pages') return '/';
  if (first === 'discount') return '/collections/sale';

  return '/'; // fallback ke homepage
}
