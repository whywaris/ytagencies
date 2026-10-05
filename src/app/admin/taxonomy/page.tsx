import Link from "next/link";

import { IntroForm } from "@/components/admin/intro-form";
import { Pill, Table } from "@/components/admin/ui";
import { selectClasses } from "@/components/forms/field";
import { requireAdmin } from "@/lib/auth";
import { MIN_AGENCIES_TO_INDEX } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Taxonomy" };

export default async function AdminTaxonomyPage() {
  await requireAdmin("/admin/taxonomy");
  const db = createAdminClient();
  const [services, industries, counts, content] = await Promise.all([
    db.from("services").select("id, slug, name, intro").order("sort_order"),
    db.from("industries").select("id, slug, name, intro").order("sort_order"),
    db.from("combo_counts").select("service_slug, industry_slug, agency_count"),
    db.from("service_industry_content").select("service_id, industry_id"),
  ]);
  if (services.error || industries.error || counts.error || content.error) {
    throw new Error("Couldn't load taxonomy");
  }

  const count = new Map(
    counts.data.map((c) => [`${c.service_slug}|${c.industry_slug}`, c.agency_count ?? 0]),
  );
  const written = new Set(content.data.map((c) => `${c.service_id}|${c.industry_id}`));
  // Combos worth writing for: they have agencies or already have copy. Most-populated first.
  const combos = services.data
    .flatMap((s) =>
      industries.data.map((i) => ({
        s,
        i,
        n: count.get(`${s.slug}|${i.slug}`) ?? 0,
        hasCopy: written.has(`${s.id}|${i.id}`),
      })),
    )
    .filter((c) => c.n > 0 || c.hasCopy)
    .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name));

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="combos" className="flex flex-col gap-4">
        <h1 id="combos" className="text-h2">
          Combination pages
        </h1>
        <p className="max-w-reading text-text-2">
          docs/SEO.md asks for unique copy on every indexed service × industry page. Pages without
          their own copy fall back to the industry intro and generic text.
        </p>
        <form
          action="/admin/taxonomy/combo"
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-col gap-1 text-[14px] font-medium">
            Service
            <select name="service" className={`${selectClasses} sm:w-64`}>
              {services.data.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-medium">
            Industry
            <select name="industry" className={`${selectClasses} sm:w-64`}>
              {industries.data.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 self-start text-accent hover:underline sm:self-auto"
          >
            Edit copy
          </button>
        </form>
        <Table>
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Agencies</th>
              <th scope="col">Indexed</th>
              <th scope="col">Own copy</th>
              <th scope="col">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {combos.map(({ s, i, n, hasCopy }) => (
              <tr key={`${s.id}-${i.id}`}>
                <td>
                  {s.name} for {i.name}
                  <div className="text-small">
                    /{s.slug}/for-{i.slug}
                  </div>
                </td>
                <td>{n}</td>
                <td>
                  <Pill on={n >= MIN_AGENCIES_TO_INDEX}>
                    {n >= MIN_AGENCIES_TO_INDEX ? "Yes" : "No"}
                  </Pill>
                </td>
                <td>
                  {hasCopy ? (
                    "Yes"
                  ) : n >= MIN_AGENCIES_TO_INDEX ? (
                    <span className="text-destructive">Missing</span>
                  ) : (
                    "No"
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/taxonomy/combo?service=${s.slug}&industry=${i.slug}`}
                    className="flex min-h-11 items-center whitespace-nowrap text-accent hover:underline"
                  >
                    Edit
                    <span className="sr-only">
                      {" "}
                      {s.name} for {i.name}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section aria-labelledby="service-intros" className="flex flex-col gap-4">
        <h2 id="service-intros" className="text-h2">
          Service intros
        </h2>
        <p className="max-w-reading text-text-2">Shown at the top of each service hub page.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {services.data.map((s) => (
            <IntroForm key={s.id} kind="services" id={s.id} name={s.name} intro={s.intro ?? ""} />
          ))}
        </div>
      </section>

      <section aria-labelledby="industry-intros" className="flex flex-col gap-4">
        <h2 id="industry-intros" className="text-h2">
          Industry intros
        </h2>
        <p className="max-w-reading text-text-2">
          120–200 words, plain language. Used on combination pages that don&apos;t have their own
          intro yet.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {industries.data.map((i) => (
            <IntroForm key={i.id} kind="industries" id={i.id} name={i.name} intro={i.intro ?? ""} />
          ))}
        </div>
      </section>
    </div>
  );
}
