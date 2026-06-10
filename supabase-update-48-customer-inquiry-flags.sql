-- Customer inquiry flags: ready to order + pricing questions
-- Run after update 47

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS ready_to_order BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_questions BOOLEAN NOT NULL DEFAULT false;
