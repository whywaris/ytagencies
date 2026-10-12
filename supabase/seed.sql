-- Seed data for development. Safe to re-run.
--
-- Part 1: taxonomy (services, industries, locations). Real data, keep for launch.
-- Part 2: SAMPLE AGENCIES. Fictional, development only. Delete before launch:
--
--   delete from agencies where id::text like '00000000-0000-4000-8000-%';
--
--   Cascades to agency_services, agency_industries, agency_locations, case_studies and reviews.

-- ───────── Part 1: taxonomy ─────────

insert into services (slug, name, sort_order) values
  ('youtube-ads-agencies', 'YouTube Ads', 1),
  ('youtube-seo-agencies', 'YouTube SEO', 2),
  ('youtube-channel-management-agencies', 'Channel Management', 3),
  ('youtube-video-production-agencies', 'Video Production', 4),
  ('youtube-shorts-agencies', 'YouTube Shorts', 5),
  ('youtube-influencer-marketing-agencies', 'Influencer Marketing', 6),
  ('youtube-thumbnail-agencies', 'Thumbnails & Packaging', 7),
  ('youtube-channel-audit-agencies', 'Channel Audits', 8)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into industries (slug, name, sort_order, intro) values
  ('crypto', 'Crypto & Web3', 1, $$Crypto projects use YouTube to explain products that are hard to understand from a landing page alone. A good video can walk a viewer through a wallet setup, a protocol, or a trading tool in a few minutes, and that builds the trust a new project needs. The challenge is that YouTube and Google Ads have strict rules for financial and crypto content. Ads for exchanges, wallets and tokens often need certification, and some formats are not allowed in certain countries. Organic channels also face demonetization and age restrictions if videos look like financial advice. Agencies that work in this space know these policies, write scripts that educate without making promises about returns, and plan campaigns country by country. Look for teams that can show compliant ad accounts, real audience growth, and a clear process for handling policy reviews before a launch or token event.$$),
  ('doctors', 'Doctors & clinics', 2, $$Patients now search YouTube before they book an appointment. They want to see who the doctor is, how a procedure works, and what recovery looks like. Clinics that answer these questions on video tend to get better-informed patients and fewer no-shows. YouTube marketing for healthcare has its own rules, though. Ads that mention health conditions face restricted targeting, and privacy laws limit how patient stories and data can be used. Content has to be accurate and reviewed, because medical misinformation policies are strict. The best agencies for doctors understand these limits. They help you plan explainer videos, procedure walkthroughs and short answers to common questions, then run local ads to people near your practice. Ask for examples from other clinics, how they handle medical review and consent, and how they measure booked appointments rather than just views.$$),
  ('dentists', 'Dentists', 3, $$Most dental patients choose a practice close to home, so YouTube works best for dentists when it is local and practical. Short videos that show the office, introduce the team, and explain treatments like implants, aligners or whitening help nervous patients feel comfortable before they call. High-value treatments are where video pays off most, because people research them for weeks before deciding. A good agency will build a library of answers to the questions your front desk hears every day, optimise those videos for search, and run geo-targeted ads to people within driving distance. They should also know the advertising rules for health services and before-and-after images. When you compare agencies, ask how they track calls and bookings from YouTube, what they charge per video, and whether they have grown channels for other dental practices.$$),
  ('real-estate', 'Real estate', 4, $$Video sells property. Buyers expect walkthroughs, neighbourhood guides and market updates before they agree to a viewing, and sellers choose agents who can show their home well. YouTube gives real estate agents and developers a place to publish this content and keep it working for years, because people keep searching for areas, prices and buying advice. Agencies in this field handle property tours, drone footage, agent personal-brand channels and ads aimed at people who are actively looking to move. Housing ads also fall under special rules in some countries, which limit targeting by age, gender or postcode, so the agency needs to know how to reach buyers within those limits. Ask to see listing videos they have produced, how fast they can turn a shoot around, and how they connect views to enquiries and signed listings.$$),
  ('saas', 'SaaS', 5, $$Software buyers want to see the product before they talk to sales. YouTube lets SaaS companies show the product in action through demos, tutorials, comparisons and customer stories, and it captures people searching for how to solve a specific problem. A strong channel can lower the cost of acquiring customers and cut support tickets at the same time. YouTube ads for SaaS usually target by intent, retargeting site visitors and reaching people who watch competitor or category content. Agencies that specialise in software understand trial and demo funnels, long sales cycles and how to tie a view to pipeline in your CRM. They also know the difference between top-of-funnel education and bottom-of-funnel product videos. When comparing agencies, ask how they measure trials, demos and revenue, not just views, and whether they have worked with products at your price point.$$),
  ('ecommerce', 'E-commerce', 6, $$Online stores use YouTube to show products in use, answer sizing and quality questions, and reach shoppers who are ready to buy. Product reviews, unboxings and how-to videos often rank for months and keep sending traffic to your store. On the paid side, shoppable video ads and campaigns linked to your product feed let viewers move from a video to checkout in a few clicks. E-commerce agencies focus on return on ad spend. They test many creative versions quickly, build campaigns around your best sellers and seasonal peaks, and work with creators who already have your target audience. They should be comfortable with your store platform, product feeds and conversion tracking. Ask agencies for results in revenue and return on ad spend, how many ad variations they produce each month, and how they decide when to scale or cut a campaign.$$),
  ('coaches', 'Coaches & consultants', 7, $$For coaches and consultants, YouTube is often the main source of new clients. People rarely pay for coaching from someone they have never seen, and video lets a viewer get to know your style, your methods and your results before booking a call. A steady channel builds that trust at scale. Agencies that work with coaches usually take on the whole workflow: planning topics around your offer, editing long videos from your recordings, cutting Shorts, writing titles and thumbnails, and building a path from video to email list to discovery call. Some also run ads to promote webinars or lead magnets. Ask how much of your time they need each month, what results their other coaching clients have seen in booked calls or sales, and whether they can keep your voice rather than making every channel look the same.$$),
  ('law-firms', 'Law firms', 8, $$People facing a legal problem often search YouTube for plain answers first. A lawyer who explains how a process works, what it costs and what to do next earns trust before the first consultation. Law firms that publish helpful video tend to receive better-qualified enquiries and rank well for local legal searches. Legal marketing comes with rules. Bar associations and regulators limit claims about results, testimonials and how fees are described, and these rules differ by country and state. Agencies that understand law firms write scripts that inform without giving specific legal advice, include the right disclaimers, and target ads to the regions where you are licensed. When comparing agencies, ask about their experience with your practice area, how they handle compliance review, and how they track consultations booked from video.$$),
  ('fitness', 'Fitness', 9, $$Fitness is one of the most crowded categories on YouTube, which makes a clear position important. Gyms, studios, personal trainers, apps and supplement brands all compete for the same viewers, and the channels that win usually have a recognisable face, a consistent format, and a reason to come back every week. Workout videos, transformation stories, form tips and nutrition advice are the core formats. Agencies in this space help with filming and editing, Shorts strategy, creator partnerships and ads for memberships, programs or products. Health claims are regulated, so before-and-after content and supplement promises need care. Ask agencies how they grew other fitness channels, how they turn viewers into members or app subscribers, and how they keep a channel going without burning out the person on camera.$$),
  ('finance', 'Finance', 10, $$Banks, fintech apps, advisers and financial educators use YouTube to explain money topics that people find confusing. Clear videos about saving, investing, taxes, loans or insurance attract viewers who are making real decisions, and that audience is valuable to advertisers. Finance is also a category where YouTube applies extra scrutiny. Ads for financial services often require verification, and content must avoid misleading claims or personal advice that breaches local regulations. Agencies with finance experience know how to work with compliance teams, add the right disclosures, and still make content that people want to watch. Ask about their approval workflow, which regulators their past clients answered to, and how they measure results such as account sign-ups, applications or booked adviser calls instead of views alone.$$),
  ('education', 'Education', 11, $$Universities, online course creators, tutoring companies and edtech platforms all use YouTube to reach learners. It is the place people go to learn almost anything, which makes it a natural fit for education brands. Free lessons and explainers show your teaching quality, and they bring in students who are already motivated. Education agencies help plan course-style playlists, produce lecture and tutorial videos, and run ads for enrolment periods and open days. Some focus on student recruitment for schools; others focus on selling online courses. Ads aimed at younger audiences come with stricter targeting rules, so the agency should know them. When comparing agencies, ask how they measure enquiries, applications or course sales, and whether they can work with your teaching staff without taking too much of their time.$$),
  ('gaming', 'Gaming', 12, $$Gaming is one of the largest categories on YouTube. Game studios, publishers, hardware brands and gaming apps use it to launch titles, build communities and keep players engaged after release. Trailers, gameplay previews, developer updates and creator partnerships all play a part, and timing around launches and updates matters a lot. Agencies in gaming usually split into two types: those that run creator and influencer campaigns, and those that produce trailers and channel content. Many do both. They should know which creators fit your genre, how to brief them without scripting every word, and how to track wishlists, downloads or sales from each campaign. Ask agencies for examples of launches they have worked on, how they pick creators, and how they report results beyond views and likes.$$)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, intro = excluded.intro;

insert into locations (slug, name, type) values
  ('usa', 'United States', 'country'),
  ('uk', 'United Kingdom', 'country'),
  ('uae', 'United Arab Emirates', 'country'),
  ('canada', 'Canada', 'country'),
  ('australia', 'Australia', 'country'),
  ('india', 'India', 'country'),
  ('pakistan', 'Pakistan', 'country')
on conflict (slug) do update set name = excluded.name, type = excluded.type;

insert into locations (slug, name, type, parent_id)
select v.slug, v.name, 'city', p.id
from (values
  ('new-york', 'New York', 'usa'),
  ('los-angeles', 'Los Angeles', 'usa'),
  ('austin', 'Austin', 'usa'),
  ('london', 'London', 'uk'),
  ('manchester', 'Manchester', 'uk'),
  ('dubai', 'Dubai', 'uae'),
  ('abu-dhabi', 'Abu Dhabi', 'uae'),
  ('toronto', 'Toronto', 'canada'),
  ('vancouver', 'Vancouver', 'canada'),
  ('sydney', 'Sydney', 'australia'),
  ('melbourne', 'Melbourne', 'australia'),
  ('mumbai', 'Mumbai', 'india'),
  ('bangalore', 'Bangalore', 'india'),
  ('delhi', 'Delhi', 'india'),
  ('karachi', 'Karachi', 'pakistan'),
  ('lahore', 'Lahore', 'pakistan'),
  ('islamabad', 'Islamabad', 'pakistan')
) as v(slug, name, country)
join locations p on p.slug = v.country
on conflict (slug) do update set name = excluded.name, type = excluded.type, parent_id = excluded.parent_id;

-- ───────── Part 2: SAMPLE AGENCIES (fictional, dev only) ─────────
-- Every sample row uses an id starting with 00000000-0000-4000-8000-. Websites use the reserved .example TLD.
-- Combos with 3+ agencies (indexable): ads × doctors, ads × saas, ads × ecommerce, seo × dentists,
-- channel management × coaches, ads in usa / uk / uae. Everything else stays under 3 (noindex).

delete from agencies where id::text like '00000000-0000-4000-8000-%';

insert into agencies
  (id, slug, name, tagline, description, website, founded_year, team_size, min_budget_usd, pricing_model,
   languages, hq_location_id, status, is_claimed, is_verified)
select v.id::uuid, v.slug, v.name, v.tagline, v.description, v.website, v.founded_year, v.team_size,
  v.min_budget_usd, v.pricing_model, v.languages::text[], l.id, 'published', v.is_claimed, v.is_verified
from (values
  ('00000000-0000-4000-8000-000000000001', 'quillfern-media', 'Quillfern Media',
   'YouTube ads and search for medical and dental practices',
   $$Quillfern Media runs YouTube ad campaigns and search-optimised channels for clinics, dental groups and private practices across the US and Canada. The team plans patient-education videos, films on site, and runs geo-targeted campaigns that send viewers to a booking page. Every script goes through a medical review step before it is published, and reporting focuses on booked appointments rather than views.$$,
   'https://quillfern.example', 2016, '11-50', 3000, 'retainer', '{English}', 'austin', true, true),
  ('00000000-0000-4000-8000-000000000002', 'brightmarrow-studio', 'Brightmarrow Studio',
   'Video ads and product films for healthcare and software',
   $$Brightmarrow Studio is a New York production and paid media team. It makes product demos, explainer films and short ad cuts for software companies and healthcare providers, then runs the YouTube campaigns that distribute them. Clients usually start with a single launch video and a three-month ad test.$$,
   'https://brightmarrow.example', 2018, '11-50', 5000, 'project', '{English}', 'new-york', true, false),
  ('00000000-0000-4000-8000-000000000003', 'tallowcrest-digital', 'Tallowcrest Digital',
   'Performance YouTube ads for regulated industries',
   $$Tallowcrest Digital manages YouTube and Google video campaigns for clinics, law firms and financial services companies in the UK and the Gulf. The team handles ad account verification, compliance review and creative testing, and reports on cost per qualified enquiry.$$,
   'https://tallowcrest.example', 2014, '51-200', 4000, 'retainer', '{English,Arabic}', 'london', true, true),
  ('00000000-0000-4000-8000-000000000004', 'pinecask-creative', 'Pinecask Creative',
   'YouTube SEO and channel management for dental and medical practices',
   $$Pinecask Creative builds and runs YouTube channels for dental practices and clinics in Canada and the US. It researches the questions patients search for, produces short answer videos from monthly filming days, and handles titles, descriptions and playlists.$$,
   'https://pinecask.example', 2019, '1-10', 1500, 'retainer', '{English,French}', 'toronto', false, false),
  ('00000000-0000-4000-8000-000000000005', 'velloway-media', 'Velloway Media',
   'YouTube search growth and channel audits',
   $$Velloway Media is a Manchester team focused on YouTube search. It audits existing channels, rewrites metadata, restructures playlists and plans new videos around search demand, mainly for dental groups and estate agents.$$,
   'https://velloway.example', 2020, '1-10', 1000, 'project', '{English}', 'manchester', false, false),
  ('00000000-0000-4000-8000-000000000006', 'orchardline-video', 'Orchardline Video',
   'Property films and Shorts for real estate and fitness brands',
   $$Orchardline Video shoots property walkthroughs, drone footage and vertical Shorts in Los Angeles. Its clients are real estate agents, developers and fitness studios that want a steady flow of short and long videos each month.$$,
   'https://orchardline.example', 2017, '11-50', 2500, 'per_video', '{English,Spanish}', 'los-angeles', true, true),
  ('00000000-0000-4000-8000-000000000007', 'saltmere-studios', 'Saltmere Studios',
   'YouTube ads and Shorts for software and online stores',
   $$Saltmere Studios produces ad creative and Shorts for SaaS companies and e-commerce brands in Australia and the US. It tests many short variations each month and scales the ones with the best return on ad spend.$$,
   'https://saltmere.example', 2019, '11-50', 3500, 'performance', '{English}', 'sydney', false, false),
  ('00000000-0000-4000-8000-000000000008', 'copperwick-media', 'Copperwick Media',
   'YouTube ads and creator campaigns for apps, stores and games',
   $$Copperwick Media runs YouTube ad campaigns and creator partnerships for software products, online stores and mobile games across India, the Gulf and the US. It manages creator outreach, contracts and tracking links in one dashboard.$$,
   'https://copperwick.example', 2015, '51-200', 2000, 'retainer', '{English,Hindi}', 'bangalore', true, true),
  ('00000000-0000-4000-8000-000000000009', 'fernhollow-digital', 'Fernhollow Digital',
   'Done-for-you channels for coaches and course creators',
   $$Fernhollow Digital manages YouTube channels for coaches, consultants and online educators. Clients record once a week; the team edits long videos, cuts Shorts, designs thumbnails and handles publishing.$$,
   'https://fernhollow.example', 2021, '1-10', 1800, 'retainer', '{English}', 'melbourne', false, false),
  ('00000000-0000-4000-8000-000000000010', 'marigold-lantern-media', 'Marigold Lantern Media',
   'Channel management and production for coaches and fitness brands',
   $$Marigold Lantern Media is a Dubai studio that films and manages YouTube channels for coaches, personal trainers and wellness brands in the UAE and India. It offers studio filming days and full post-production.$$,
   'https://marigoldlantern.example', 2018, '11-50', 2500, 'retainer', '{English,Arabic,Hindi}', 'dubai', true, false),
  ('00000000-0000-4000-8000-000000000011', 'driftpeak-video', 'Driftpeak Video',
   'Channel management, SEO and audits for coaches and finance creators',
   $$Driftpeak Video is a Lahore team that manages channels for coaches and finance educators in the US, UK and Pakistan. It covers topic research, editing, SEO and quarterly channel audits at a lower monthly cost than most Western agencies.$$,
   'https://driftpeak.example', 2020, '11-50', 800, 'retainer', '{English,Urdu}', 'lahore', false, false),
  ('00000000-0000-4000-8000-000000000012', 'hazelrun-creative', 'Hazelrun Creative',
   'Creator campaigns and Shorts for crypto and gaming',
   $$Hazelrun Creative connects crypto projects and game studios with YouTube creators, and produces Shorts for launches. It screens creators for audience quality and handles disclosure requirements for sponsored content.$$,
   'https://hazelrun.example', 2021, '1-10', 5000, 'project', '{English}', 'vancouver', false, false),
  ('00000000-0000-4000-8000-000000000013', 'ambergate-media-lab', 'Ambergate Media Lab',
   'YouTube ads and SEO for online stores and crypto products',
   $$Ambergate Media Lab is a Karachi agency running YouTube ads and search optimisation for e-commerce brands and crypto products in Pakistan and the UAE. It handles certification for crypto advertising where it is required.$$,
   'https://ambergate.example', 2019, '11-50', 1000, 'retainer', '{English,Urdu}', 'karachi', false, false),
  ('00000000-0000-4000-8000-000000000014', 'kestrelbay-studio', 'Kestrelbay Studio',
   'Thumbnails, audits and SEO for education and software channels',
   $$Kestrelbay Studio designs thumbnails, rewrites titles and audits channels for edtech companies, course creators and software brands in India. Most clients buy a one-off audit followed by monthly packaging work.$$,
   'https://kestrelbay.example', 2022, '1-10', 500, 'per_video', '{English,Hindi}', 'mumbai', false, false),
  ('00000000-0000-4000-8000-000000000015', 'mossgrove-digital', 'Mossgrove Digital',
   'Video production and YouTube ads for law firms and property',
   $$Mossgrove Digital produces explainer videos and runs YouTube ads for law firms and property developers in Pakistan and the UK. Scripts for legal clients are written with practice-area disclaimers from the start.$$,
   'https://mossgrove.example', 2017, '11-50', 1200, 'project', '{English,Urdu}', 'islamabad', false, false)
) as v(id, slug, name, tagline, description, website, founded_year, team_size, min_budget_usd, pricing_model,
       languages, hq, is_claimed, is_verified)
join locations l on l.slug = v.hq;

-- Services (first listed = primary)
insert into agency_services (agency_id, service_id, is_primary)
select v.agency_id::uuid, s.id, v.is_primary
from (values
  ('00000000-0000-4000-8000-000000000001', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000001', 'youtube-seo-agencies', false),
  ('00000000-0000-4000-8000-000000000002', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000002', 'youtube-video-production-agencies', false),
  ('00000000-0000-4000-8000-000000000003', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000004', 'youtube-seo-agencies', true),
  ('00000000-0000-4000-8000-000000000004', 'youtube-channel-management-agencies', false),
  ('00000000-0000-4000-8000-000000000005', 'youtube-seo-agencies', true),
  ('00000000-0000-4000-8000-000000000005', 'youtube-channel-audit-agencies', false),
  ('00000000-0000-4000-8000-000000000006', 'youtube-video-production-agencies', true),
  ('00000000-0000-4000-8000-000000000006', 'youtube-shorts-agencies', false),
  ('00000000-0000-4000-8000-000000000007', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000007', 'youtube-shorts-agencies', false),
  ('00000000-0000-4000-8000-000000000008', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000008', 'youtube-influencer-marketing-agencies', false),
  ('00000000-0000-4000-8000-000000000009', 'youtube-channel-management-agencies', true),
  ('00000000-0000-4000-8000-000000000009', 'youtube-thumbnail-agencies', false),
  ('00000000-0000-4000-8000-000000000010', 'youtube-channel-management-agencies', true),
  ('00000000-0000-4000-8000-000000000010', 'youtube-video-production-agencies', false),
  ('00000000-0000-4000-8000-000000000011', 'youtube-channel-management-agencies', true),
  ('00000000-0000-4000-8000-000000000011', 'youtube-seo-agencies', false),
  ('00000000-0000-4000-8000-000000000011', 'youtube-channel-audit-agencies', false),
  ('00000000-0000-4000-8000-000000000012', 'youtube-influencer-marketing-agencies', true),
  ('00000000-0000-4000-8000-000000000012', 'youtube-shorts-agencies', false),
  ('00000000-0000-4000-8000-000000000013', 'youtube-ads-agencies', true),
  ('00000000-0000-4000-8000-000000000013', 'youtube-seo-agencies', false),
  ('00000000-0000-4000-8000-000000000014', 'youtube-thumbnail-agencies', true),
  ('00000000-0000-4000-8000-000000000014', 'youtube-channel-audit-agencies', false),
  ('00000000-0000-4000-8000-000000000014', 'youtube-seo-agencies', false),
  ('00000000-0000-4000-8000-000000000015', 'youtube-video-production-agencies', true),
  ('00000000-0000-4000-8000-000000000015', 'youtube-ads-agencies', false)
) as v(agency_id, service, is_primary)
join services s on s.slug = v.service;

-- Industries (first listed = primary)
insert into agency_industries (agency_id, industry_id, is_primary)
select v.agency_id::uuid, i.id, v.is_primary
from (values
  ('00000000-0000-4000-8000-000000000001', 'doctors', true),
  ('00000000-0000-4000-8000-000000000001', 'dentists', false),
  ('00000000-0000-4000-8000-000000000002', 'saas', true),
  ('00000000-0000-4000-8000-000000000002', 'doctors', false),
  ('00000000-0000-4000-8000-000000000003', 'doctors', true),
  ('00000000-0000-4000-8000-000000000003', 'law-firms', false),
  ('00000000-0000-4000-8000-000000000003', 'finance', false),
  ('00000000-0000-4000-8000-000000000004', 'dentists', true),
  ('00000000-0000-4000-8000-000000000004', 'doctors', false),
  ('00000000-0000-4000-8000-000000000005', 'dentists', true),
  ('00000000-0000-4000-8000-000000000005', 'real-estate', false),
  ('00000000-0000-4000-8000-000000000006', 'real-estate', true),
  ('00000000-0000-4000-8000-000000000006', 'fitness', false),
  ('00000000-0000-4000-8000-000000000007', 'saas', true),
  ('00000000-0000-4000-8000-000000000007', 'ecommerce', false),
  ('00000000-0000-4000-8000-000000000008', 'ecommerce', true),
  ('00000000-0000-4000-8000-000000000008', 'saas', false),
  ('00000000-0000-4000-8000-000000000008', 'gaming', false),
  ('00000000-0000-4000-8000-000000000009', 'coaches', true),
  ('00000000-0000-4000-8000-000000000009', 'education', false),
  ('00000000-0000-4000-8000-000000000010', 'coaches', true),
  ('00000000-0000-4000-8000-000000000010', 'fitness', false),
  ('00000000-0000-4000-8000-000000000011', 'coaches', true),
  ('00000000-0000-4000-8000-000000000011', 'finance', false),
  ('00000000-0000-4000-8000-000000000012', 'crypto', true),
  ('00000000-0000-4000-8000-000000000012', 'gaming', false),
  ('00000000-0000-4000-8000-000000000013', 'ecommerce', true),
  ('00000000-0000-4000-8000-000000000013', 'crypto', false),
  ('00000000-0000-4000-8000-000000000014', 'education', true),
  ('00000000-0000-4000-8000-000000000014', 'saas', false),
  ('00000000-0000-4000-8000-000000000015', 'law-firms', true),
  ('00000000-0000-4000-8000-000000000015', 'real-estate', false)
) as v(agency_id, industry, is_primary)
join industries i on i.slug = v.industry;

-- Locations served: HQ city plus other countries. "in-<country>" pages also count agencies in its cities.
insert into agency_locations (agency_id, location_id)
select v.agency_id::uuid, l.id
from (values
  ('00000000-0000-4000-8000-000000000001', 'austin'), ('00000000-0000-4000-8000-000000000001', 'canada'),
  ('00000000-0000-4000-8000-000000000002', 'new-york'), ('00000000-0000-4000-8000-000000000002', 'uk'),
  ('00000000-0000-4000-8000-000000000003', 'london'), ('00000000-0000-4000-8000-000000000003', 'uae'),
  ('00000000-0000-4000-8000-000000000004', 'toronto'), ('00000000-0000-4000-8000-000000000004', 'usa'),
  ('00000000-0000-4000-8000-000000000005', 'manchester'),
  ('00000000-0000-4000-8000-000000000006', 'los-angeles'),
  ('00000000-0000-4000-8000-000000000007', 'sydney'), ('00000000-0000-4000-8000-000000000007', 'usa'),
  ('00000000-0000-4000-8000-000000000008', 'bangalore'), ('00000000-0000-4000-8000-000000000008', 'uae'),
  ('00000000-0000-4000-8000-000000000008', 'usa'),
  ('00000000-0000-4000-8000-000000000009', 'melbourne'), ('00000000-0000-4000-8000-000000000009', 'uk'),
  ('00000000-0000-4000-8000-000000000010', 'dubai'), ('00000000-0000-4000-8000-000000000010', 'india'),
  ('00000000-0000-4000-8000-000000000011', 'lahore'), ('00000000-0000-4000-8000-000000000011', 'usa'),
  ('00000000-0000-4000-8000-000000000011', 'uk'),
  ('00000000-0000-4000-8000-000000000012', 'vancouver'), ('00000000-0000-4000-8000-000000000012', 'usa'),
  ('00000000-0000-4000-8000-000000000013', 'karachi'), ('00000000-0000-4000-8000-000000000013', 'uae'),
  ('00000000-0000-4000-8000-000000000014', 'mumbai'),
  ('00000000-0000-4000-8000-000000000015', 'islamabad'), ('00000000-0000-4000-8000-000000000015', 'uk')
) as v(agency_id, location)
join locations l on l.slug = v.location;

-- Case studies (fictional clients and numbers)
-- Metrics are written below as {key: number} for readability; stored as up to 3 {value, label}
-- (same conversion as migration 20261019000100).
create function pg_temp.metrics_list(m jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('value', v, 'label', l) order by k), '[]'::jsonb)
  from (
    select e.key as k,
      left(case
        when e.key ~ '_pct$' then n || '%'
        when e.key ~ '_usd$' then '$' || n
        when e.key ~ '_gbp$' then '£' || n
        when e.key ~ '^roas' then n || '×'
        else n end, 12) as v,
      left(upper(left(lbl, 1)) || substr(lbl, 2), 40) as l
    from jsonb_each_text(m) e,
      -- "45000" → "45,000"; ROAS, CTR, CPA, CPM, CPV and ROI in capitals.
      lateral (select
        case when e.value ~ '^\d{4,}$' then to_char(e.value::bigint, 'FM999,999,999,999') else e.value end as n,
        trim(replace(replace(replace(replace(replace(replace(
          ' ' || regexp_replace(regexp_replace(e.key, '_(pct|usd|gbp)$', ''), '_', ' ', 'g') || ' ',
          ' roas ', ' ROAS '), ' ctr ', ' CTR '), ' cpa ', ' CPA '), ' cpm ', ' CPM '), ' cpv ', ' CPV '),
          ' roi ', ' ROI ')) as lbl) x
    order by e.key
    limit 3
  ) t
$$;
insert into case_studies (agency_id, title, client_industry_id, summary, metrics)
select v.agency_id::uuid, v.title, i.id, v.summary, pg_temp.metrics_list(v.metrics::jsonb)
from (values
  ('00000000-0000-4000-8000-000000000001', 'Booked consultations for a three-location dermatology clinic', 'doctors',
   'Procedure explainer videos plus local in-stream ads within 15 miles of each clinic.',
   '{"monthly_bookings_before": 22, "monthly_bookings_after": 71, "cost_per_booking_usd": 48}'),
  ('00000000-0000-4000-8000-000000000001', 'Implant enquiries for a family dental group', 'dentists',
   'A 12-video FAQ series optimised for local search, promoted with geo-targeted ads.',
   '{"implant_enquiries_per_month": 34, "views": 210000, "months": 6}'),
  ('00000000-0000-4000-8000-000000000002', 'Launch campaign for a scheduling app', 'saas',
   'One 90-second product film cut into six ad versions for a trial campaign.',
   '{"trials": 4100, "cost_per_trial_usd": 19, "roas": 2.6}'),
  ('00000000-0000-4000-8000-000000000003', 'Lead generation for a personal injury firm', 'law-firms',
   'Compliance-reviewed explainer ads targeted to the regions where the firm is licensed.',
   '{"qualified_enquiries": 380, "cost_per_enquiry_gbp": 41, "months": 4}'),
  ('00000000-0000-4000-8000-000000000004', 'Growing a dental practice channel from zero', 'dentists',
   'Monthly filming days producing short answers to common patient questions.',
   '{"subs_before": 0, "subs_after": 8400, "new_patients_attributed": 96}'),
  ('00000000-0000-4000-8000-000000000005', 'Search audit for an estate agency channel', 'real-estate',
   'Rewrote metadata for 140 videos and restructured playlists by neighbourhood.',
   '{"search_views_increase_pct": 162, "videos_updated": 140}'),
  ('00000000-0000-4000-8000-000000000006', 'Listing videos for a luxury property team', 'real-estate',
   'Walkthroughs and Shorts for every listing, delivered within 72 hours of the shoot.',
   '{"listings_filmed": 58, "avg_days_on_market_before": 41, "avg_days_on_market_after": 29}'),
  ('00000000-0000-4000-8000-000000000007', 'Scaling ads for a skincare store', 'ecommerce',
   'Weekly creative tests across 30 short ad variations, scaling the top three.',
   '{"roas_before": 1.4, "roas_after": 3.2, "monthly_spend_usd": 45000}'),
  ('00000000-0000-4000-8000-000000000008', 'Creator launch for a puzzle game', 'gaming',
   '24 mid-size creators briefed for a launch week, tracked with unique links.',
   '{"installs": 182000, "creators": 24, "cost_per_install_usd": 0.62}'),
  ('00000000-0000-4000-8000-000000000008', 'Ad campaign for a D2C fashion brand', 'ecommerce',
   'Product feed campaigns plus creator-made ads for seasonal sales.',
   '{"roas": 4.1, "revenue_usd": 640000}'),
  ('00000000-0000-4000-8000-000000000009', 'Channel for a leadership coach', 'coaches',
   'Weekly long videos and four Shorts per week from one recording session.',
   '{"subs_before": 1200, "subs_after": 45000, "discovery_calls_per_month": 38}'),
  ('00000000-0000-4000-8000-000000000010', 'Studio channel for a personal trainer', 'fitness',
   'Monthly studio filming days producing workout series and Shorts.',
   '{"subs_after": 120000, "app_signups": 9800}'),
  ('00000000-0000-4000-8000-000000000011', 'Finance educator channel turnaround', 'finance',
   'Audit, new title and thumbnail system, and SEO for back-catalogue videos.',
   '{"monthly_views_before": 90000, "monthly_views_after": 410000}'),
  ('00000000-0000-4000-8000-000000000012', 'Wallet launch with crypto creators', 'crypto',
   'Twelve vetted creators with full sponsorship disclosure and tracked sign-up links.',
   '{"wallet_signups": 26000, "creators": 12}'),
  ('00000000-0000-4000-8000-000000000013', 'YouTube ads for a home goods store', 'ecommerce',
   'Shopping-linked video ads and search-optimised product reviews.',
   '{"roas": 3.4, "monthly_orders": 2100}'),
  ('00000000-0000-4000-8000-000000000014', 'Thumbnail refresh for a coding course channel', 'education',
   'Redesigned thumbnails and titles for the top 60 videos.',
   '{"ctr_before_pct": 3.1, "ctr_after_pct": 6.8, "course_sales_increase_pct": 44}'),
  ('00000000-0000-4000-8000-000000000015', 'Explainer series for a family law firm', 'law-firms',
   'Ten explainer videos with practice-area disclaimers, promoted to local audiences.',
   '{"consultations_booked": 140, "months": 5}')
) as v(agency_id, title, industry, summary, metrics)
join industries i on i.slug = v.industry;

-- Reviews (fictional people). One pending to exercise moderation.
insert into reviews (agency_id, author_name, author_company, rating, body, status)
select v.agency_id::uuid, v.author_name, v.author_company, v.rating, v.body, v.status
from (values
  ('00000000-0000-4000-8000-000000000001', 'Dana Whitfield', 'Lakeshore Skin Clinic', 5,
   'They understood medical ad rules from day one and our consultation bookings tripled within six months.', 'published'),
  ('00000000-0000-4000-8000-000000000001', 'Marcus Ilori', 'Bright Arch Dental', 4,
   'Good videos and clear reporting. Filming days took more of our time than we expected, but the results were worth it.', 'published'),
  ('00000000-0000-4000-8000-000000000003', 'Priya Ramaswamy', 'Ramaswamy & Cole Solicitors', 5,
   'Every script went through compliance review before launch. We now get steady, qualified enquiries every week.', 'published'),
  ('00000000-0000-4000-8000-000000000006', 'Tom Alvarez', 'Alvarez Home Group', 5,
   'Listing videos arrive within three days of the shoot and sellers love them. It has helped us win new listings.', 'published'),
  ('00000000-0000-4000-8000-000000000008', 'Helen Park', 'Tiny Tiles Games', 4,
   'Creator selection was spot on for our genre. Reporting could be more frequent during launch week.', 'published'),
  ('00000000-0000-4000-8000-000000000009', 'Jordan Mbeki', 'Mbeki Leadership', 5,
   'I record once a week and they handle everything else. The channel is now my main source of discovery calls.', 'published'),
  ('00000000-0000-4000-8000-000000000009', 'Sophie Laurent', 'Course Atelier', 4,
   'Reliable editing and thoughtful thumbnails. Turnaround slipped once around a holiday but they told us early.', 'published'),
  ('00000000-0000-4000-8000-000000000011', 'Bilal Chaudhry', 'Money Made Plain', 5,
   'Their audit found problems we had missed for years. Views more than quadrupled after the changes.', 'published'),
  ('00000000-0000-4000-8000-000000000011', 'Anonymous', null, 2,
   'Pending review used to test moderation. It should never appear on the public site.', 'pending')
) as v(agency_id, author_name, author_company, rating, body, status);

-- Verified badges come from approved verifications (a trigger keeps agencies.is_verified in sync).
-- The sample rows above set the flag directly, so record the matching approvals.
insert into verifications (agency_id, status, checklist, reviewed_at)
select a.id, 'approved', '{"seeded": true}', now()
from agencies a
where a.is_verified
  and a.id::text like '00000000-0000-4000-8000-%'
  and not exists (select 1 from verifications v where v.agency_id = a.id and v.status = 'approved');

-- Plans (ADMIN_V2_SPEC §6). The two samples that used to be "Featured" are Founding agencies,
-- so ranking has paid agencies to order above Free ones.
insert into agency_subscriptions (agency_id, plan_id, status, starts_at, ends_at, source)
select a.id, 'founding', 'active', now(), now() + interval '6 months', 'founding'
from agencies a
where a.slug in ('quillfern-media', 'marigold-lantern-media')
  and not exists (select 1 from agency_subscriptions s where s.agency_id = a.id and s.status = 'active');

-- Default guide author; rename it (name, slug, photo, bio) in Admin → Authors.
insert into authors (slug, name, role) values ('editorial-team', 'Editorial team', 'YT Agencies')
on conflict (slug) do nothing;

-- The first guide, moved from MDX (src/content/guides) into the CMS. Real content: keep for launch.
insert into guides (slug, title, excerpt, body_md, seo_description, author_id, status,
  published_at, related_combos, created_at, updated_at)
select 'youtube-ads-agency-cost',
  'How much does a YouTube ads agency cost?',
  'What YouTube ads agencies charge, how fees and production add up, and how to budget your first three months.',
  $md$Hiring a YouTube ads agency usually means paying for two separate things: the agency's fee for running your campaigns, and the ad spend that goes to Google. Many first quotes are confusing because they mix the two. This guide breaks down how agencies price their work, what you're actually paying for, and how to set a budget you can stick to.

{{budget-range youtube-ads-agencies}}

## Ad spend and agency fees are separate

Your **ad spend** is the money Google charges when people watch or click your ads. You pay it to Google, usually on your own card or invoice, and it scales with how many people you want to reach.

The **agency fee** pays for the people planning, building and improving your campaigns. Ask every agency to quote these separately. If a quote is one number, ask how much of it reaches Google.

## The four common pricing models

### Percentage of ad spend

The agency takes a share of what you spend on ads. For example, a 15% fee on $10,000 of monthly spend is $1,500 a month. This is simple and grows with your account, but it gives the agency a reason to recommend spending more. Most agencies that use it also set a monthly minimum.

### Flat monthly retainer

You pay the same fee each month regardless of spend. It's predictable and easy to budget. Check exactly what's included: the number of campaigns, how often they report, and whether new ad creative costs extra.

### Per video or per project

Some agencies charge for producing ad videos separately, either per finished video or per campaign launch. This is common when the agency both makes the creative and runs the ads. Ask how many versions and edits each video includes, because testing several cuts is how YouTube ads improve.

### Performance-based

The fee is tied to results, such as a price per lead or a share of revenue. It sounds safe, but read the definitions closely. Agree in writing what counts as a lead or a sale, how it's tracked, and what happens if tracking breaks.

## What drives the price up or down

- **Creative needs.** If you already have good videos, management alone costs less. If you need new ads every month, expect production costs on top.
- **Regulated industries.** Healthcare, finance, crypto and legal ads need extra policy knowledge and review time. Specialist agencies often charge more, and they're usually worth it.
- **Number of markets.** Running campaigns in several countries or languages multiplies setup and reporting work.
- **Reporting depth.** Connecting YouTube to your CRM or store so you can see booked calls or revenue, not just views, takes more setup.

## How to budget your first three months

YouTube campaigns need time to learn. The first weeks are for testing audiences and ad versions, so judge results over about three months rather than three weeks.

1. **Set a test ad budget you can afford to spend without a guaranteed return.** It should be large enough for each ad version to get a fair number of views.
2. **Add the agency fee and any production costs.** Multiply the monthly total by three.
3. **Agree on one or two numbers that matter** before you start, such as cost per booked call or return on ad spend, and review them monthly.
4. **Check the contract length.** A three-month minimum is normal. Long lock-ins before you've seen results are a warning sign.

## Questions to ask before you sign

- Which part of the quote is the agency fee, and which part is ad spend?
- Who owns the ad account and the videos if we stop working together?
- How many new ad versions will you test each month?
- Can you show results from a business like ours, with real numbers?
- What happens if the first three months don't hit the agreed numbers?

An agency that answers these clearly, in writing, is usually one that will be straightforward to work with.
$md$,
  'What YouTube ads agencies charge, how management fees, retainers and video production add up, and how to budget your first three months without overspending.',
  (select id from authors where slug = 'editorial-team'),
  'published',
  '2026-10-04T09:00:00Z',
  jsonb_build_array(
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-ads-agencies')),
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-ads-agencies'),
                       'industry_id', (select id from industries where slug = 'doctors')),
    jsonb_build_object('service_id', (select id from services where slug = 'youtube-video-production-agencies'))
  ),
  '2026-10-04T09:00:00Z',
  '2026-10-04T09:00:00Z'
where exists (select 1 from services where slug = 'youtube-ads-agencies')
on conflict (slug) do nothing;
