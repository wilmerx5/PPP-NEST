/** Clasificación / límites de archivos salientes por WhatsApp Cloud API. */

export type OutboundMediaKind = 'image' | 'document' | 'video' | 'audio';

const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/3gpp']);
const AUDIO_MIME = new Set([
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'audio/ogg',
  'audio/opus',
]);
const DOC_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 16 * 1024 * 1024;
const MAX_AUDIO = 16 * 1024 * 1024;
const MAX_DOC = 20 * 1024 * 1024;

export function classifyOutboundMedia(
  mimeType: string,
  size: number,
): { kind: OutboundMediaKind; maxBytes: number } | { error: string } {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (IMAGE_MIME.has(mime) || mime === 'image/jpg') {
    if (size > MAX_IMAGE) return { error: 'La imagen no puede superar 5 MB' };
    return { kind: 'image', maxBytes: MAX_IMAGE };
  }
  if (VIDEO_MIME.has(mime)) {
    if (size > MAX_VIDEO) return { error: 'El video no puede superar 16 MB' };
    return { kind: 'video', maxBytes: MAX_VIDEO };
  }
  if (AUDIO_MIME.has(mime)) {
    if (size > MAX_AUDIO) return { error: 'El audio no puede superar 16 MB' };
    return { kind: 'audio', maxBytes: MAX_AUDIO };
  }
  if (DOC_MIME.has(mime) || mime.startsWith('application/')) {
    // Otros application/* razonables como documento
    if (
      DOC_MIME.has(mime) ||
      mime.includes('pdf') ||
      mime.includes('word') ||
      mime.includes('sheet') ||
      mime.includes('excel') ||
      mime.includes('powerpoint') ||
      mime.includes('presentation') ||
      mime === 'text/plain' ||
      mime === 'text/csv'
    ) {
      if (size > MAX_DOC) return { error: 'El documento no puede superar 20 MB' };
      return { kind: 'document', maxBytes: MAX_DOC };
    }
  }
  return {
    error:
      'Tipo no soportado. Usa imagen (JPG/PNG/WebP), PDF/Office, video MP4 o audio.',
  };
}

export function outboundMediaBodyLabel(params: {
  kind: OutboundMediaKind;
  caption?: string | null;
  filename?: string | null;
}): string {
  const caption = (params.caption || '').trim();
  if (caption) return caption;
  if (params.kind === 'image') return '🖼️ Imagen';
  if (params.kind === 'video') return '🎬 Video';
  if (params.kind === 'audio') return '🎵 Audio';
  return params.filename ? `📄 ${params.filename}` : '📄 Documento';
}

export const OUTBOUND_MEDIA_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,text/csv,video/mp4,audio/mpeg,audio/ogg,audio/aac';
