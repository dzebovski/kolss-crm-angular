import { V2_DOCUMENT_MAX_BYTES, v2DocumentExtension } from './lead-documents';

/** Contract file and payment receipt: at most one each, PDF (also JPG, PNG, HEIC), up to 25 MB. */
export const V2_PROJECT_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic'] as const;

export function v2ProjectFileError(file: Pick<File, 'name' | 'size'>): 'type' | 'size' | null {
  const extension = v2DocumentExtension(file.name);
  if (!(V2_PROJECT_FILE_EXTENSIONS as readonly string[]).includes(extension)) return 'type';
  return file.size > V2_DOCUMENT_MAX_BYTES || file.size < 1 ? 'size' : null;
}
