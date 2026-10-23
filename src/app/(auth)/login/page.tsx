import { Check } from "lucide-react";
import Link from "next/link";
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

const POINTS = [
  { title: "Free listing", body: "Create your profile at no cost." },
  { title: "Inquiries to your inbox", body: "Businesses contact you directly." },
  {
    title: "Show your real work",
    body: "Add the channels you've grown and your starting price.",
  },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  // Already signed in: same landing rule as after a fresh sign-in.
  if (await getUser()) redirect(postLoginPath(next, !!(await getAdminUser())));
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1080px] items-center gap-[72px] px-4 py-10 min-[900px]:grid-cols-[minmax(0,1fr)_440px] md:px-6 md:py-16">
      {/* Under 900px only screen readers get this column (it holds the page h1). */}
      <div className="rise-sm flex flex-col gap-6 max-[899px]:sr-only">
        <span className="self-start rounded-full bg-(--accent-soft) px-3 py-1 text-[13px] font-semibold text-(--accent-on-soft)">
          For agencies
        </span>
        <h1 className="text-[clamp(32px,3.6vw,44px)] leading-[1.1] font-[650] tracking-[-0.035em] text-balance">
          Get found by businesses looking for YouTube help
        </h1>
        <p className="max-w-[46ch] text-[17px] text-text-2">
          Manage your listing, show the channels you&apos;ve worked on and answer inquiries from one
          place.
        </p>
        <ul className="flex flex-col gap-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-(--mint-soft) text-(--mint)"
              >
                <Check className="size-3.5 [stroke-width:2.75]" />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{p.title}</span>
                <span className="text-[15px] text-text-2">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line pt-6 text-[15px] text-text-2">
          Comparing agencies? You don&apos;t need an account.{" "}
          <Link href="/agencies" className="font-medium text-accent hover:underline">
            Browse agencies
          </Link>
        </p>
      </div>

      <LoginCard
        next={next ?? ""}
        initialMode={params.mode === "signup" ? "signup" : "signin"}
        initialError={error ?? null}
        google={await googleSignInEnabled()}
      />
    </div>
  );
}
