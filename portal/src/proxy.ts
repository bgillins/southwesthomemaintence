// ------- Runs before every page -------
// 1. Refreshes the Supabase session cookie so a tech is not logged out mid-visit.
// 2. Sends anyone who is not signed in to /login.
// It only checks "is there a session". Whether that person is actually staff is
// checked again by the page (lib/auth.ts) and by the database (row-level security).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

export async function proxy(request: NextRequest) {
  // A fresh deployment with no database connected yet: say so plainly instead
  // of showing a crash page.
  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse('Portal setup is not finished: Supabase is not connected to this deployment yet.', { status: 503 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isSignInPage = path.startsWith('/login') || path.startsWith('/auth');

  if (!data.user && !isSignInPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Skip static files and the customer report pages (/r/...), which need no login.
  matcher: ['/((?!_next/static|_next/image|r/|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
