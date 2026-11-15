import { GuideBlockView } from "@/components/guide-blocks";
import { BLOCK_TYPES, type BlockAttrs, type BlockType } from "@/lib/guide-blocks";

// Every guide block, filled in: the styleguide shows them in both themes, as on the page and in
// the editor canvas, and e2e/guide-blocks-contrast.spec.ts checks their contrast there.

const SAMPLE: Record<BlockType, BlockAttrs> = {
  comparisonTable: {
    rows: [
      {
        name: "YT Agencies",
        bestFor: "YouTube teams",
        price: "Free",
        difference: "Agencies only",
        anchor: "yt-agencies",
      },
      {
        name: "Upwork",
        bestFor: "Freelancers",
        price: "[price]",
        difference: "Marketplace",
        anchor: "upwork",
      },
    ],
    highlightFirst: true,
  },
  productCard: {
    badge: "BEST FOR YOUTUBE SPECIALISTS",
    title: "YT Agencies",
    description: "A sample product, to show the block.",
    points: [
      { kind: "good", text: "Free to compare" },
      { kind: "caveat", text: "Fees vary by plan" },
    ],
    image: "",
    imageAlt: "",
    caption: "",
    price: "Free",
    priceSource: "https://example.com/pricing",
    ctaLabel: "Read the guides",
    ctaHref: "/guides",
    chooseIf: "you want a team.",
    ours: true,
  },
  abTable: {
    aLabel: "Fiverr",
    bLabel: "YT Agencies",
    rows: [{ label: "Who", a: "Freelancers", b: "Agencies" }],
    bBetter: "Ongoing work.",
  },
  prosCons: { good: ["Fast"], watch: ["Quality varies"] },
  faq: { items: [{ q: "Is it free?", a: "Yes." }] },
  ctaBox: {
    variant: "box",
    heading: "Keep reading",
    lines: ["More guides like this one."],
    primaryLabel: "Browse",
    primaryHref: "/guides",
    secondaryLabel: "Ask",
    secondaryHref: "/request-proposals",
  },
  statRow: {
    items: [
      { value: "73%", label: "of viewers", source: "https://example.com" },
      { value: "2x", label: "watch time", source: "" },
    ],
  },
  button: { label: "Get proposals", href: "/request-proposals" },
  listLabel: { text: "In this order:" },
  quote: {
    text: "They doubled our views.",
    name: "Sam Lee",
    role: "Founder, Acme",
    cite: "https://example.com",
  },
};

export function GuideBlocksDemo({ editing = false }: { editing?: boolean }) {
  return (
    <div className="guide-content">
      {BLOCK_TYPES.map((type) => (
        <div key={type} className="guide-block" data-guide-block={type}>
          <GuideBlockView type={type} attrs={SAMPLE[type]} editing={editing} />
        </div>
      ))}
      <div className="guide-block" data-guide-block="ctaBox">
        <GuideBlockView type="ctaBox" attrs={{ ...SAMPLE.ctaBox, variant: "banner" }} />
      </div>
    </div>
  );
}
