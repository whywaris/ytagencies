import {
  LocationHub,
  liveLocationParams,
  locationHubMetadata,
} from "@/components/directory/location-hub";

// /locations/<country>/<city> (components/directory/location-hub.tsx).
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await liveLocationParams())
    .filter((p) => p.length === 2)
    .map(([country, city]) => ({ country, city }));
}

export async function generateMetadata({ params }: PageProps<"/locations/[country]/[city]">) {
  const { country, city } = await params;
  return locationHubMetadata(country, city);
}

export default async function CityPage({ params }: PageProps<"/locations/[country]/[city]">) {
  const { country, city } = await params;
  return <LocationHub country={country} city={city} />;
}
