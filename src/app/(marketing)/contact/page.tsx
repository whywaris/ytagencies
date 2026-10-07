import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContactForm } from "@/components/forms/contact-form";
import { JsonLd } from "@/components/json-ld";
import { COMPANY } from "@/lib/company";
import { CONTACT_TOPICS, TOPIC_IDS, type ContactTopic } from "@/lib/contact-topics";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, BRAND_NAME } from "@/lib/site";

// /contact (?topic=… preselects a topic; ?agency=<slug> pre-fills "Report a listing").
// Reading the query makes this page render on request; the canonical is always /contact.

const TITLE = "Contact us";
const DESCRIPTION =
  "Contact YT Agencies about a question, your agency or billing, a listing to report, press or a privacy request. Each topic goes straight to the right inbox.";

export const metadata = buildMetadata({
  title: `Contact | ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/contact",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Contact", path: "/contact" },
];

// One row per inbox, with the topics it handles and its reply time.
const inboxes = [...new Set(CONTACT_TOPICS.map((t) => t.inbox))].map((inbox) => {
  const topics = CONTACT_TOPICS.filter((t) => t.inbox === inbox);
  return { inbox, topics: topics.map((t) => t.label), response: topics[0].response };
});

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const sp = await searchParams;
  const topicParam = typeof sp.topic === "string" ? sp.topic : "";
  const topic = (TOPIC_IDS as readonly string[]).includes(topicParam)
    ? (topicParam as ContactTopic)
    : "general";
  const agency =
    typeof sp.agency === "string" && /^[a-z0-9-]{1,80}$/.test(sp.agency) ? sp.agency : "";

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={webPageJsonLd({
          type: "ContactPage",
          name: TITLE,
          description: DESCRIPTION,
          path: "/contact",
        })}
      />
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-10 pb-20 md:px-6 md:pt-16">
        <header className="flex max-w-reading flex-col gap-4">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-h1">{TITLE}</h1>
          <p className="text-[19px] text-text-2">
            Pick a topic so your message reaches the right inbox.
          </p>
        </header>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="max-w-reading">
            <ContactForm
              initialTopic={agency ? "report" : topic}
              initialAgencyUrl={agency ? absoluteUrl(`/agency/${agency}`) : ""}
            />
          </div>

          <aside
            aria-labelledby="by-email"
            className="flex flex-col gap-6 lg:border-l lg:border-line lg:pl-10"
          >
            <h2 id="by-email" className="text-[17px] font-semibold">
              Or email us
            </h2>
            <ul className="flex flex-col gap-6">
              {inboxes.map((i) => (
                <li key={i.inbox} className="flex flex-col gap-1">
                  <a
                    href={`mailto:${i.inbox}`}
                    className="font-medium break-all text-accent hover:underline"
                  >
                    {i.inbox}
                  </a>
                  <span className="text-[15px] text-text-2">{i.topics.join(", ")}</span>
                  {i.response && <span className="text-small">We reply {i.response}</span>}
                </li>
              ))}
            </ul>
            {COMPANY.address && <p className="text-small whitespace-pre-line">{COMPANY.address}</p>}
          </aside>
        </div>
      </div>
    </>
  );
}
