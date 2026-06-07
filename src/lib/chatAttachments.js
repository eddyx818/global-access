import { supabase } from './supabase';

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateChatFile(file) {
  if (!file) throw new Error('No file selected');
  if (file.size > MAX_BYTES) throw new Error('File must be under 10MB');
  const extOk = /\.(jpe?g|png|webp|gif|pdf|docx?|xlsx?|csv|txt)$/i.test(file.name);
  const typeOk = [...IMAGE_TYPES, ...DOC_TYPES].includes(file.type);
  if (!typeOk && !extOk) {
    throw new Error('Supported: photos (JPG, PNG, WebP, GIF) and documents (PDF, Word, Excel, CSV, TXT)');
  }
}

export function isChatImage(type, name = '') {
  return (type && type.startsWith('image/')) || /\.(jpe?g|png|webp|gif)$/i.test(name);
}

export async function uploadChatAttachment(file, { conversationId, userId }) {
  validateChatFile(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${conversationId}/${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
  return {
    url: urlData.publicUrl,
    type: file.type || ext,
    name: file.name,
    path,
  };
}
