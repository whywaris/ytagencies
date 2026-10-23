import {
  AgenciesSection,
  ClosingBand,
  FaqSection,
  GuidesSection,
  HomeHero,
  HowItWorksSection,
  IndustriesSection,
  ServicesSection,
  WhySection,
} from "@/components/home/sections";
import { JsonLd } from "@/components/json-ld";
import { getAgencyCount } from "@/lib/data/agencies";
import { breadcrumbJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { BRAND_NAME } from "@/lib/site";

export const revalidate = 3600;

export async function generateMetadata() {
  const count = await getAgencyCount();
  return buildMetadata({
    title: `${BRAND_NAME}: Compare YouTube agencies that know your niche`,
    description: `Compare ${count} YouTube agencies for ads, SEO, channel management and Shorts. Filter by industry and location, then contact agencies directly. Free for businesses and creators.`,
    path: "/",
  });
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }])} />

      <HomeHero />
      <ServicesSection />
      <AgenciesSection />
      <HowItWorksSection />
      <WhySection />
      <IndustriesSection />
      <GuidesSection />
      <FaqSection />
      <ClosingBand />
    </>
  );
}
