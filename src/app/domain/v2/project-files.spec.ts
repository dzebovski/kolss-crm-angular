import { v2CanDeleteProjectDocument, v2ProjectFileError } from './project-files';

describe('project files', () => {
  it('accepts PDF and images up to 25 MB only', () => {
    expect(v2ProjectFileError({ name: 'umowa.PDF', size: 1024 })).toBeNull();
    expect(v2ProjectFileError({ name: 'plan.dwg', size: 1024 })).toBe('type');
    expect(v2ProjectFileError({ name: 'scan.jpg', size: 0 })).toBe('size');
    expect(v2ProjectFileError({ name: 'scan.jpg', size: 26 * 1024 * 1024 })).toBe('size');
  });

  it('lets the manager and the uploader delete, and nobody on a closed project', () => {
    const document = { uploadedBy: { id: 'u1', name: 'Ola' } };
    const open = { canUploadDocument: true, canEdit: false };
    expect(v2CanDeleteProjectDocument(document, open, 'u1')).toBe(true);
    expect(v2CanDeleteProjectDocument(document, open, 'u2')).toBe(false);
    expect(v2CanDeleteProjectDocument({ uploadedBy: null }, open, null)).toBe(false);
    expect(v2CanDeleteProjectDocument(document, { ...open, canEdit: true }, 'u2')).toBe(true);
    expect(
      v2CanDeleteProjectDocument(document, { canUploadDocument: false, canEdit: true }, 'u1'),
    ).toBe(false);
  });
});
