// Words that suggest an agency works in an industry, keyed by industry slug (the 21 live
// industries). Edit freely: one phrase per entry, lowercase. A phrase matches whole words, with an
// optional plural "s"/"es" ("dentist" also matches "dentists"). End it with "*" to match any
// ending ("orthodont*": orthodontist, orthodontics). Used by scripts/enrich-industries.mjs and to
// highlight the evidence in Admin → Industry review. No imports: tested (tests/enrich.test.mjs).
//
// Keep phrases specific: "app" is ambiguous on its own, so it only counts as weak evidence (see
// WEAK below), and a suggestion still needs an admin's approval.

export const INDUSTRY_SYNONYMS: Record<string, string[]> = {
  automotive: ["automotive", "car dealership", "car dealer", "auto dealer", "dealership*", "car brand", "auto repair", "motorsport*"],
  beauty: ["beauty brand", "beauty", "cosmetic*", "skincare", "skin care", "makeup", "salon", "haircare", "hair care"],
  coaches: ["coaches", "coaching", "life coach", "business coach", "consultant", "consultants", "course creator", "info product*"],
  creators: ["creators", "content creator", "youtuber", "youtubers", "influencer", "personal brand*", "streamer"],
  crypto: ["crypto*", "web3", "blockchain", "defi", "nft", "bitcoin", "token launch*"],
  dentists: ["dental", "dentist", "dentistry", "orthodont*", "dental practice*", "dental clinic*"],
  doctors: ["healthcare", "medical practice*", "clinic", "clinics", "doctor", "physician", "surgeon", "plastic surgery", "med spa", "medspa", "chiropract*"],
  ecommerce: ["ecommerce", "e-commerce", "shopify", "dtc", "d2c", "direct-to-consumer", "online store", "amazon seller*", "consumer brand"],
  education: ["education", "edtech", "online course*", "e-learning", "elearning", "university", "universities", "school", "schools", "tutoring"],
  finance: ["finance", "fintech", "financial services", "financial advisor*", "wealth management", "insurance", "banking", "investment firm*", "accounting firm*"],
  fitness: ["fitness", "gym", "gyms", "personal trainer", "workout", "supplement*", "yoga", "pilates", "wellness"],
  food: ["food brand", "restaurant", "restaurants", "food and beverage", "f&b", "beverage", "cooking", "recipe*", "chef"],
  gaming: ["gaming", "game studio*", "video game", "game developer*", "esports", "indie game*", "mobile game*"],
  kids: ["kids", "children's", "childrens", "family channel*", "toy brand*", "toys", "parenting"],
  "law-firms": ["law firm", "attorney", "lawyer", "legal services", "personal injury", "legal marketing"],
  music: ["music", "musician", "record label*", "artists and labels", "music video*", "band", "bands"],
  podcasts: ["podcast", "podcasters", "podcasting", "video podcast"],
  "real-estate": ["real estate", "realtor", "property", "properties", "mortgage", "brokerage", "home builder*", "property developer*"],
  saas: ["saas", "software company", "software companies", "b2b software", "b2b tech", "software startup*", "app", "apps"],
  tech: ["tech company", "tech companies", "technology company", "technology brand*", "tech startup*", "startups", "consumer tech", "hardware", "ai company", "ai companies"],
  travel: ["travel", "tourism", "hotel", "hotels", "hospitality", "resort", "resorts", "airline*", "travel agenc*"],
};

/** Phrases that are too common to count much on their own. */
export const WEAK = new Set(["app", "apps", "clinic", "school", "schools", "property", "properties", "band", "bands", "music", "travel", "kids", "beauty", "startups", "insurance"]);
