import { redirect } from "next/navigation";

import { LoginForm } from "@/components/forms/login-form";
import { getUser, safeNext } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/site";

export const metadata = {
  title: { absolute: `Sign in | ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one below.",
  google: "Google sign-in didn't work. Try again, or use an email link.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await getUser()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="mx-auto flex max-w-[440px] flex-col gap-8 px-4 py-12 md:py-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">Sign in</h1>
        <p className="text-text-2">For agencies managing a listing. No password needed.</p>
      </header>
      {error && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      {/* Plain link: a GET to our route, which redirects to Google. */}
      <a
        href={`/auth/google?next=${encodeURIComponent(next)}`}
        className="flex h-11 items-center justify-center rounded-full border border-line font-medium transition-colors duration-150 hover:border-text-2"
      >
        Continue with Google
      </a>
      <div className="flex items-center gap-4 text-small" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <LoginForm next={next} />
    </div>
  );
}
