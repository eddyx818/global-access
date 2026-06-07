-- Replace waiting-room game with admin-managed industry facts.
-- Run in Supabase SQL Editor after prior lobby migrations.

DROP FUNCTION IF EXISTS public.reset_lobby_game_scores();
DROP TABLE IF EXISTS lobby_game_scores;

CREATE TABLE IF NOT EXISTS access_waiting_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'tobacco', 'hemp_thc', 'vape', 'beverages', 'functional',
    'compliance', 'law_federal', 'law_state', 'market', 'distribution'
  )),
  title TEXT,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 10 AND 1200),
  state_code TEXT CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  source_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_waiting_facts_active
  ON access_waiting_facts (is_active, sort_order DESC, created_at DESC);

ALTER TABLE access_waiting_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_waiting_facts" ON access_waiting_facts;
CREATE POLICY "public_read_active_waiting_facts" ON access_waiting_facts
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_all_waiting_facts" ON access_waiting_facts;
CREATE POLICY "admin_all_waiting_facts" ON access_waiting_facts
  FOR ALL TO authenticated
  USING (auth_is_portal_admin())
  WITH CHECK (auth_is_portal_admin());

-- Starter facts (edit or add more in Admin → Content → Industry facts)
INSERT INTO access_waiting_facts (category, title, body, state_code, sort_order) VALUES
(
  'compliance',
  'Age verification at wholesale',
  'Most states require documented age verification for tobacco and alternative product wholesale accounts. Keep licenses and resale certificates current before placing orders.',
  NULL,
  100
),
(
  'law_federal',
  'FDA tobacco & ENDS oversight',
  'FDA Center for Tobacco Products regulates cigarettes, smokeless, and many ENDS marketing claims. PMTA and labeling rules continue to shape which SKUs distributors can legally move interstate.',
  NULL,
  95
),
(
  'hemp_thc',
  '7-OH & hemp patchwork',
  'Rules on 7-hydroxymitragynine and certain hemp-derived products vary widely by state — some ban, some restrict sales channels, others allow with labeling rules. Verify destination state law before shipping.',
  NULL,
  90
),
(
  'law_state',
  'State flavor & vape restrictions',
  'Multiple states restrict flavored vapor products, online sales, or nicotine concentration. A SKU legal in one state may be prohibited in the next — compliance is a routing problem, not just a catalog problem.',
  NULL,
  85
),
(
  'tobacco',
  'OTP & excise complexity',
  'Other tobacco products (OTP) — wraps, leaf, accessories — often carry separate excise and registration requirements from cigarettes. Distributors track stamps, licenses, and reporting by jurisdiction.',
  NULL,
  80
),
(
  'vape',
  'Disposable supply chain',
  'Disposable vape demand shifts quickly when enforcement targets unauthorized devices. Legitimate distributors prioritize traceable supply, COAs, and brand-authorized SKUs over gray-market lookalikes.',
  NULL,
  75
),
(
  'beverages',
  'Functional & RTD beverages',
  'Functional beverages (kava, adaptogens, hemp-free formulations) sit in a different regulatory lane than THC drinks — but state attorney general scrutiny on claims and age gates is increasing nationwide.',
  NULL,
  70
),
(
  'functional',
  'Label claims matter',
  'Structure/function claims on supplements and functional products draw FTC and state AG attention. Wholesale buyers should confirm marketing copy matches registered formulations and state allowances.',
  NULL,
  65
),
(
  'market',
  'Trade show ≠ long-term supply',
  'Products hyped on the show floor may lack stable replenishment or compliant labeling. Retailers and distributors who survive enforcement cycles prioritize partners with consistent COAs and authorized brand relationships.',
  NULL,
  60
),
(
  'distribution',
  'Licensed wholesale only',
  'Global Access works with verified retailers and distributors — resale certificates, business licenses, and account review help keep product in legitimate channels and off unauthorized marketplaces.',
  NULL,
  55
);
