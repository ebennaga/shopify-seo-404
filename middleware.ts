// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Izinkan semua request lewat tanpa modifikasi
  // Ini mencegah Next.js melakukan redirect otomatis
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Terapkan ke semua route kecuali static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
