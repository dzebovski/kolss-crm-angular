import { V2_DOCUMENT_MAX_BYTES, v2DocumentExtension } from './lead-documents';
import type { V2ProjectDocument } from './project.types';

/** Project document and payment receipt: PDF (also JPG, PNG, HEIC), up to 25 MB. */
export const V2_PROJECT_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic'] as const;

export function v2ProjectFileError(file: Pick<File, 'name' | 'size'>): 'type' | 'size' | null {
  const extension = v2DocumentExtension(file.name);
  if (!(V2_PROJECT_FILE_EXTENSIONS as readonly string[]).includes(extension)) return 'type';
  return file.size > V2_DOCUMENT_MAX_BYTES || file.size < 1 ? 'size' : null;
}

/**
 * Delete in the Documents tab (mirrors the API): the uploader, the project manager and admins
 * (`canEdit`), only while documents can be added at all (not on a closed or finished project).
 */
export function v2CanDeleteProjectDocument(
  document: Pick<V2ProjectDocument, 'uploadedBy'>,
  access: { readonly canUploadDocument: boolean; readonly canEdit: boolean },
  userId: string | null,
): boolean {
  if (!access.canUploadDocument) return false;
  return access.canEdit || (!!userId && document.uploadedBy?.id === userId);
}
