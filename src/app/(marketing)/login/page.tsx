import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/login-form";
import { getAdminUser, getUser } from "@/lib/auth";
import { postLoginPath, safeNext } from "@/lib/redirects";
import { BRAND_NAME } from "@/lib/site";

export const metadata = {
  title: { absolute: `Sign in | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  expired: "This link has expired or was already used. Request a new one.",
  link: "We couldn't sign you in with that link. Request a new one below.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  // Already signed in: same landing rule as after a fresh sign-in.
  if (await getUser()) redirect(postLoginPath(next, !!(await getAdminUser())));
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="mx-auto flex max-w-[440px] flex-col gap-8 px-4 py-12 md:py-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Sign in to manage your agency</h1>
        <p className="text-text-2">No password needed: we&apos;ll email you a sign-in link.</p>
        <p className="text-small">
          Businesses don&apos;t need an account. Just browse and send an inquiry.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      <LoginForm next={next ?? ""} />
    </div>
  );
}
