import type { LeadDocumentTag } from '@core/api/generated/kolss-api.types';

export const V2_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const V2_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'dwg'] as const;

export type V2DocumentState = 'ready' | 'uploading' | 'uploaded' | 'error';

export interface V2PendingDocument {
  readonly id: string;
  readonly file: File;
  readonly tag: LeadDocumentTag;
  readonly state: V2DocumentState;
  readonly progress: number;
  readonly error: 'type' | 'size' | 'upload' | null;
}

export function v2DocumentExtension(fileName: string): string {
  return (fileName.split('.').at(-1) ?? '').toLowerCase();
}

export function v2DocumentError(file: Pick<File, 'name' | 'size'>): 'type' | 'size' | null {
  if (
    !V2_DOCUMENT_EXTENSIONS.includes(
      v2DocumentExtension(file.name) as (typeof V2_DOCUMENT_EXTENSIONS)[number],
    )
  ) {
    return 'type';
  }
  return file.size > V2_DOCUMENT_MAX_BYTES ? 'size' : null;
}

export function v2DefaultDocumentTag(fileName: string): LeadDocumentTag {
  const extension = v2DocumentExtension(fileName);
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'heic') {
    return 'photo';
  }
  if (extension === 'dwg') return 'drawing';
  return 'plan';
}

export function v2PendingDocument(file: File): V2PendingDocument {
  const error = v2DocumentError(file);
  return {
    id: crypto.randomUUID(),
    file,
    tag: v2DefaultDocumentTag(file.name),
    state: error ? 'error' : 'ready',
    progress: 0,
    error,
  };
}

export function v2FormatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function v2DocumentLocalErrorCount(documents: readonly V2PendingDocument[]): number {
  return documents.filter((document) => document.error === 'type' || document.error === 'size')
    .length;
}

export function v2UpdatePendingDocument(
  documents: readonly V2PendingDocument[],
  id: string,
  change: Partial<V2PendingDocument>,
): readonly V2PendingDocument[] {
  return documents.map((document) => (document.id === id ? { ...document, ...change } : document));
}
