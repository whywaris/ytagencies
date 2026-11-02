-- Pro goes from $29/month and $279/year to $49/month and $470/year (20% off twelve months:
-- 49 × 12 = 588, less 20% = 470.40, rounded down). The site shows these numbers; what Lemon
-- Squeezy charges comes from the product's variants, which are changed in its dashboard.

begin;

update plans set price_monthly = 49, price_yearly = 470 where id = 'pro';

commit;
