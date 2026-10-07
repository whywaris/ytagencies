import { COMPANY } from "@/lib/company";
import { absoluteUrl as absolute, BRAND_NAME, CONTACT_EMAIL, SITE_URL } from "@/lib/site";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
  };
}

/** The site's organization, with company facts from lib/company.ts once they're filled in. */
export function organizationJsonLd() {
  const { founder, legalName, city, country } = COMPANY;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    // Google wants a raster logo of at least 112×112 (src/app/logo.png/route.tsx renders 512×512).
    logo: absolute("/logo.png"),
    email: CONTACT_EMAIL,
    ...(legalName ? { legalName } : {}),
    ...(city || country
      ? {
          address: {
            "@type": "PostalAddress",
            ...(city ? { addressLocality: city } : {}),
            ...(country ? { addressCountry: country } : {}),
          },
        }
      : {}),
    ...(founder.name && founder.role
      ? {
          founder: {
            "@type": "Person",
            name: founder.name,
            jobTitle: founder.role,
            ...(founder.linkedinUrl ? { sameAs: [founder.linkedinUrl] } : {}),
          },
        }
      : {}),
  };
}

/** Company and legal pages: WebPage (or AboutPage / ContactPage) with its last update. */
export function webPageJsonLd(p: {
  type?: "WebPage" | "AboutPage" | "ContactPage";
  name: string;
  description: string;
  path: string;
  /** yyyy-mm-dd */
  updated?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": p.type ?? "WebPage",
    name: p.name,
    description: p.description,
    url: absolute(p.path),
    ...(p.updated ? { dateModified: p.updated } : {}),
    isPartOf: { "@type": "WebSite", name: BRAND_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
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
  /** The guide's author (a Person with their author page), else the site itself. */
  author: { name: string; slug: string } | null;
  image: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.published,
    dateModified: a.updated,
    author: a.author
      ? { "@type": "Person", name: a.author.name, url: absolute(`/authors/${a.author.slug}`) }
      : { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
    mainEntityOfPage: absolute(a.path),
    image: absolute(a.image),
  };
}

/** /authors/[slug]: the author, their photo and profiles elsewhere. */
export function personJsonLd(p: {
  slug: string;
  name: string;
  role: string | null;
  bio: string | null;
  image: string | null;
  sameAs: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: absolute(`/authors/${p.slug}`),
    ...(p.role ? { jobTitle: p.role } : {}),
    ...(p.bio ? { description: p.bio } : {}),
    ...(p.image ? { image: p.image } : {}),
    ...(p.sameAs.length ? { sameAs: p.sameAs } : {}),
    worksFor: { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
  };
}

/** /guides: the collection page and the guides on it, in order. */
export function collectionPageJsonLd(c: {
  path: string;
  name: string;
  description: string;
  items: { path: string; name: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.name,
    description: c.description,
    url: absolute(c.path),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: c.items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absolute(item.path),
        name: item.name,
      })),
    },
  };
}
