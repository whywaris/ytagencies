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
  const { founder, legalName, city, countryCode, foundedYear } = COMPANY;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    // Google wants a raster logo of at least 112×112 (src/app/logo.png/route.tsx renders 512×512).
    logo: absolute("/logo.png"),
    email: CONTACT_EMAIL,
    sameAs: Object.values(COMPANY.social),
    ...(legalName ? { legalName } : {}),
    foundingDate: String(foundedYear),
    ...(city || countryCode
      ? {
          address: {
            "@type": "PostalAddress",
            ...(city ? { addressLocality: city } : {}),
            ...(countryCode ? { addressCountry: countryCode } : {}),
          },
        }
      : {}),
    ...(founder.name
      ? {
          founder: {
            "@type": "Person",
            name: founder.name,
            ...(founder.role ? { jobTitle: founder.role } : {}),
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
  /** The profile's "At a glance" paragraph. */
  description: string | null;
  logoUrl: string | null;
  areaServed: string[];
  hq: { city: string | null; country: string | null } | null;
  foundingYear: number | null;
  /** "11-50", "200+" */
  teamSize: string | null;
  /** "$3,000+/month" */
  priceRange: string | null;
  knowsAbout: string[];
  /** Website (Pro only), LinkedIn, YouTube channel. */
  sameAs: string[];
  rating: { average: number; count: number } | null;
  /** Published, moderated reviews only. */
  reviews: { author: string; rating: number; body: string; date: string }[];
}) {
  const [min, max] = agency.teamSize?.split("-").map(Number) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: agency.name,
    url: absolute(`/agency/${agency.slug}`),
    ...(agency.description && { description: agency.description }),
    ...(agency.logoUrl && { logo: agency.logoUrl, image: agency.logoUrl }),
    ...(agency.areaServed.length > 0 && { areaServed: agency.areaServed }),
    ...(agency.hq &&
      (agency.hq.city || agency.hq.country) && {
        address: {
          "@type": "PostalAddress",
          ...(agency.hq.city && { addressLocality: agency.hq.city }),
          ...(agency.hq.country && { addressCountry: agency.hq.country }),
        },
      }),
    ...(agency.foundingYear && { foundingDate: String(agency.foundingYear) }),
    ...(agency.teamSize && {
      numberOfEmployees: {
        "@type": "QuantitativeValue",
        ...(agency.teamSize.endsWith("+")
          ? { minValue: Number.parseInt(agency.teamSize, 10) }
          : { minValue: min, maxValue: max }),
      },
    }),
    ...(agency.priceRange && { priceRange: agency.priceRange }),
    ...(agency.knowsAbout.length > 0 && { knowsAbout: agency.knowsAbout }),
    ...(agency.sameAs.length > 0 && { sameAs: agency.sameAs }),
    ...(agency.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: agency.rating.average,
        reviewCount: agency.rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(agency.reviews.length > 0 && {
      review: agency.reviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        datePublished: r.date.slice(0, 10),
        reviewBody: r.body,
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
      })),
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

/** The options a comparison guide compares, in order (Alternatives guides). */
export function comparisonListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absolute(item.path),
    })),
  };
}
