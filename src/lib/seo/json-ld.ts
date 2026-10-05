import { BRAND_NAME, SITE_URL } from "@/lib/site";

const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
  };
}

/** Items in order from Home; the last one is the current page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

/** Directory pages: agency profile URLs in display order. */
export function itemListJsonLd(paths: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: paths.map((path, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absolute(path),
    })),
  };
}

/** docs/SEO.md: allowed, but don't expect rich results from it. */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * Agency profile. aggregateRating only when there are published (moderated) reviews (docs/SEO.md);
 * address only from public HQ fields.
 */
export function professionalServiceJsonLd(agency: {
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  areaServed: string[];
  hq: { city: string; country: string | null } | null;
  rating: { average: number; count: number } | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: agency.name,
    url: absolute(`/agency/${agency.slug}`),
    ...(agency.website && { sameAs: [agency.website] }),
    ...(agency.description && { description: agency.description }),
    ...(agency.logoUrl && { logo: agency.logoUrl, image: agency.logoUrl }),
    ...(agency.areaServed.length > 0 && { areaServed: agency.areaServed }),
    ...(agency.hq && {
      address: {
        "@type": "PostalAddress",
        addressLocality: agency.hq.city,
        ...(agency.hq.country && { addressCountry: agency.hq.country }),
      },
    }),
    ...(agency.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: agency.rating.average,
        reviewCount: agency.rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

/** Guides (docs/SEO.md): Article with author and dates. */
export function articleJsonLd(a: {
  path: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  author: string;
  image: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.published,
    dateModified: a.updated,
    author: { "@type": "Organization", name: a.author },
    publisher: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
    mainEntityOfPage: absolute(a.path),
    image: absolute(a.image),
  };
}
