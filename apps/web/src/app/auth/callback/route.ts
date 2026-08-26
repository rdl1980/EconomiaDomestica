import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Atterraggio del link magico: scambia il codice con una sessione e reindirizza.
 *
 * `next` arriva dalla query string, quindi è input non fidato: si accettano solo
 * percorsi relativi, altrimenti diventa un open redirect verso un sito esterno.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link-non-valido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link-scaduto`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
