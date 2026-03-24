// app/page.tsx
import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ shop?: string; host?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;

  if (params.shop) {
    redirect(`/api/auth?shop=${params.shop}`);
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 560,
        margin: '80px auto',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>↩</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        SEO Redirect Manager
      </h1>
      <p
        style={{
          fontSize: 16,
          color: '#6b7280',
          lineHeight: 1.7,
          marginBottom: 32,
        }}
      >
        Auto-detect 404 errors dan buat 301 redirects otomatis untuk toko
        Shopify kamu.
      </p>
      <div
        style={{
          background: '#f3f4f6',
          borderRadius: 12,
          padding: '20px 24px',
          textAlign: 'left',
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
          Cara install ke toko kamu:
        </p>
        <code
          style={{ fontSize: 12, color: '#2563eb', wordBreak: 'break-all' }}
        >
          NGROK_URL/api/auth?shop=NAMA-TOKO.myshopify.com
        </code>
      </div>
    </div>
  );
}
