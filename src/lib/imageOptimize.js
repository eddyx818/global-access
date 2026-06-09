/** Resize/compress images in the browser before Supabase upload. */
const BRAND_BUCKET = 'brand-images';

export const DISPLAY_WIDTHS = {
  card: 480,
  hero: 960,
  product: 720,
  galleryThumb: 560,
  lightbox: 1600,
};

export function isSupabaseBrandImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\/storage\/v1\/object\/public\/brand-images\//.test(url);
}

/** Build a smaller Supabase render URL (Pro plan). Falls back to original on load error. */
export function getDisplayImageUrl(url, { width = 800, quality = 80 } = {}) {
  if (!url || !isSupabaseBrandImageUrl(url)) return url || '';
  const marker = `/storage/v1/object/public/${BRAND_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const path = url.slice(idx + marker.length).split('?')[0];
  const base = url.slice(0, idx);
  return `${base}/storage/v1/render/image/public/${BRAND_BUCKET}/${path}?width=${width}&quality=${quality}`;
}

export function handleDisplayImageError(event, originalUrl) {
  const el = event?.target;
  if (!el || !originalUrl) return;
  if (el.dataset.fallbackApplied === '1') {
    el.style.display = 'none';
    return;
  }
  if (el.src !== originalUrl) {
    el.dataset.fallbackApplied = '1';
    el.src = originalUrl;
    return;
  }
  el.style.display = 'none';
}

export function getStoragePathFromPublicUrl(url) {
  if (!isSupabaseBrandImageUrl(url)) return null;
  const marker = `/storage/v1/object/public/${BRAND_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Compress a photo for web (max ~1920px, WebP/JPEG).
 * Returns the original file when compression would not help.
 */
export async function compressImageFile(file, {
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.82,
  skipBelowBytes = 280 * 1024,
} = {}) {
  if (!file?.type?.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  if (file.size <= skipBelowBytes && (file.type === 'image/webp' || file.type === 'image/jpeg')) {
    return file;
  }

  let img;
  try {
    img = await loadImageFromFile(file);
  } catch (_) {
    return file;
  }

  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const preferWebp = file.type !== 'image/png' || !hasAlpha(ctx, width, height);
  const mimeType = preferWebp ? 'image/webp' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) return file;
  if (blob.size >= file.size * 0.97) return file;

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function hasAlpha(ctx, width, height) {
  try {
    const sample = ctx.getImageData(0, 0, Math.min(width, 8), Math.min(height, 8)).data;
    for (let i = 3; i < sample.length; i += 4) {
      if (sample[i] < 255) return true;
    }
  } catch (_) {}
  return false;
}

/** Re-upload existing Supabase brand-images files in a smaller format (same URL path). */
export async function optimizeAllBrandImages({ onProgress } = {}) {
  const { supabase } = await import('./supabase');

  const [{ data: galleries }, { data: products }] = await Promise.all([
    supabase.from('brand_gallery').select('id, image_url'),
    supabase.from('product_content').select('sku, image_url').not('image_url', 'is', null),
  ]);

  const seen = new Set();
  const jobs = [];
  (galleries || []).forEach((row) => {
    const path = getStoragePathFromPublicUrl(row.image_url);
    if (path && !seen.has(path)) {
      seen.add(path);
      jobs.push({ path, url: row.image_url, label: `Gallery ${row.id}` });
    }
  });
  (products || []).forEach((row) => {
    const path = getStoragePathFromPublicUrl(row.image_url);
    if (path && !seen.has(path)) {
      seen.add(path);
      jobs.push({ path, url: row.image_url, label: `SKU ${row.sku}` });
    }
  });

  let optimized = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    onProgress?.({ phase: 'running', current: i + 1, total: jobs.length, label: job.label });

    try {
      const res = await fetch(job.url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const file = new File([blob], job.path.split('/').pop() || 'photo.jpg', { type: blob.type || 'image/jpeg' });
      const compressed = await compressImageFile(file, { skipBelowBytes: 0 });

      if (compressed.size >= blob.size * 0.95) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase.storage
        .from(BRAND_BUCKET)
        .upload(job.path, compressed, { upsert: true, contentType: compressed.type });

      if (error) throw error;
      optimized += 1;
    } catch (_) {
      failed += 1;
    }
  }

  onProgress?.({ phase: 'done', optimized, skipped, failed, total: jobs.length });
  return { optimized, skipped, failed, total: jobs.length };
}
