import { supabase } from './supabase';

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES = [
  'text/plain', 'text/csv', 'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateAdminFile(file) {
  if (!file) throw new Error('No file selected');
  if (file.size > MAX_BYTES) throw new Error('File must be under 10MB');
  const allowed = [...IMAGE_TYPES, ...DOC_TYPES];
  if (!allowed.includes(file.type) && !file.name.match(/\.(csv|txt|json)$/i)) {
    throw new Error('Supported: JPG, PNG, WebP, CSV, TXT, JSON (max 10MB)');
  }
}

export async function uploadAdminFile(file, { brandId, sku, userId } = {}) {
  validateAdminFile(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('admin-uploads')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('admin-uploads').getPublicUrl(path);
  const fileUrl = urlData.publicUrl;

  const { data: record, error: dbError } = await supabase
    .from('uploaded_files')
    .insert({
      file_url: fileUrl,
      file_name: file.name,
      file_type: file.type || ext,
      file_size: file.size,
      uploaded_by: userId || null,
      associated_brand: brandId || null,
      associated_sku: sku || null,
      metadata: { storage_path: path },
    })
    .select()
    .single();

  if (dbError) throw new Error(dbError.message);
  return record;
}

export function parseCsvText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || [];
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function isImageFile(file) {
  return IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export async function callAdminAnalyze(payload) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}
