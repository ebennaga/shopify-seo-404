import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEO Redirect Manager',
  description: 'Auto-detect 404 errors dan kelola redirects untuk toko Shopify',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f5f6fa' }}>
        {children}
      </body>
    </html>
  );
}
