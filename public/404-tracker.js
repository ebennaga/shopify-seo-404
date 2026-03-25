/**
 * SEO Redirect - 404 Tracker
 * Script ini diinject otomatis ke semua halaman toko via ScriptTag.
 * Mendeteksi halaman 404 dan melaporkan ke backend app.
 */
(function () {
  // Cek apakah halaman ini adalah 404
  // Shopify menambahkan class "template-404" ke body untuk halaman 404
  var is404 =
    document.body.classList.contains("template-404") ||
    document.title.toLowerCase().includes("page not found") ||
    document.title.toLowerCase().includes("404");

  // Kalau bukan halaman 404, stop di sini
  if (!is404) return;

  // Ambil domain toko dari Shopify global object
  var shopDomain =
    (window.Shopify && window.Shopify.shop) || window.location.hostname;

  // Data yang akan dikirim ke backend
  var payload = {
    shop: shopDomain,
    url: window.location.pathname,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent || null,
  };

  // Kirim laporan ke app backend
  fetch("https://shopify-seo-404-qck2.vercel.app/api/errors/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(function () {
    // Silent fail supaya tidak ganggu pengunjung toko
  });
})();
