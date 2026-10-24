import {
  LocationHub,
  liveLocationParams,
  locationHubMetadata,
} from "@/components/directory/location-hub";

// /locations/<country> (components/directory/location-hub.tsx).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await liveLocationParams()).filter((p) => p.length === 1).map(([country]) => ({ country }));
}

export async function generateMetadata({ params }: PageProps<"/locations/[country]">) {
  return locationHubMetadata((await params).country);
}

export default async function CountryPage({ params }: PageProps<"/locations/[country]">) {
  return <LocationHub country={(await params).country} />;
}
