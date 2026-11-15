import { redirect } from "next/navigation";

import { LoginCard } from "@/components/forms/login-card";
import { getAdminUser, getUser } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { postLoginPath, safeNext } from "@/lib/redirects";
import { BRAND_NAME } from "@/lib/site";

export const metadata = {
  title: { absolute: `Sign in | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

// ?error= from /auth/confirm, /auth/callback and /auth/google.
const ERRORS: Record<string, string> = {
  expired: "That link has expired. Enter your email to get a new one.",
  link: "We couldn't sign you in with that link. Enter your email to get a new one.",
  google: "Google sign-in didn't work. Try again, or use an email link.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  // Already signed in: same landing rule as after a fresh sign-in.
  if (await getUser()) redirect(postLoginPath(next, !!(await getAdminUser())));
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-4 py-10 md:py-16">
      <h1 className="sr-only">Sign in to {BRAND_NAME}</h1>
      <LoginCard
        next={next ?? ""}
        initialError={error ?? null}
        google={await googleSignInEnabled()}
      />
    </div>
  );
}
