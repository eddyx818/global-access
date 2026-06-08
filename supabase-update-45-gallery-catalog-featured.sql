-- Star placard photos for catalog hero / home cards (12h rotation when multiple starred)

ALTER TABLE brand_gallery
  ADD COLUMN IF NOT EXISTS catalog_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_brand_gallery_catalog_featured
  ON brand_gallery (brand_id, catalog_featured)
  WHERE catalog_featured = true;
