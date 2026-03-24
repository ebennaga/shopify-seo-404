import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

// ── Inisialisasi Shopify API client ──
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES!.split(','),
  hostName: process.env.SHOPIFY_APP_URL!.replace(/https?:\/\//, ''),
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: true,
});

// ── Buat 301 redirect di toko Shopify ──
export async function createShopifyRedirect(
  accessToken: string,
  shopDomain: string,
  fromPath: string,
  toPath: string,
) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/2023-10/redirects.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        redirect: { path: fromPath, target: toPath },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }

  const data = await res.json();
  return data.redirect; // { id, path, target }
}

// ── Hapus redirect dari toko Shopify ──
export async function deleteShopifyRedirect(
  accessToken: string,
  shopDomain: string,
  redirectId: number,
) {
  await fetch(
    `https://${shopDomain}/admin/api/2023-10/redirects/${redirectId}.json`,
    {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': accessToken },
    },
  );
}

// ── Install ScriptTag ──
// ScriptTag = script JS yang diinject otomatis ke semua halaman toko
// Kita pakai ini untuk deteksi 404 secara real-time
export async function installScriptTag(
  accessToken: string,
  shopDomain: string,
  appUrl: string,
) {
  // Cek apakah sudah terpasang
  const checkRes = await fetch(
    `https://${shopDomain}/admin/api/2023-10/script_tags.json`,
    {
      headers: { 'X-Shopify-Access-Token': accessToken },
    },
  );
  const checkData = await checkRes.json();
  const tags = checkData.script_tags ?? [];

  const alreadyInstalled = tags.some((t: any) =>
    t.src.includes('404-tracker.js'),
  );

  if (alreadyInstalled) {
    console.log('ScriptTag sudah terpasang, skip.');
    return;
  }

  // Install ScriptTag baru
  await fetch(`https://${shopDomain}/admin/api/2023-10/script_tags.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script_tag: {
        event: 'onload',
        src: `${appUrl}/404-tracker.js`,
      },
    }),
  });

  console.log('ScriptTag berhasil dipasang!');
}
