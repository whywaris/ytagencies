import "server-only";

/**
 * Whether Google sign-in is switched on in Supabase (Authentication → Providers). Read from the
 * public Auth settings endpoint and cached for 5 minutes; any failure counts as off, so the
 * button is hidden rather than leading to an error.
 */
export async function googleSignInEnabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const settings: { external?: { google?: boolean } } = await res.json();
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
