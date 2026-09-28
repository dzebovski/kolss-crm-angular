import {
  V2_DOCUMENT_MAX_BYTES,
  v2DefaultDocumentTag,
  v2DocumentError,
  v2DocumentExtension,
} from './lead-documents';

describe('lead documents', () => {
  it('accepts the W11 extensions case-insensitively', () => {
    expect(v2DocumentError({ name: 'room.HEIC', size: 12 })).toBeNull();
    expect(v2DocumentExtension('plan.final.DWG')).toBe('dwg');
    expect(v2DocumentError({ name: 'notes.docx', size: 12 })).toBe('type');
  });

  it('rejects a file over 25 MiB', () => {
    expect(v2DocumentError({ name: 'plan.pdf', size: V2_DOCUMENT_MAX_BYTES })).toBeNull();
    expect(v2DocumentError({ name: 'plan.pdf', size: V2_DOCUMENT_MAX_BYTES + 1 })).toBe('size');
  });

  it('chooses the board tag from the file kind', () => {
    expect(v2DefaultDocumentTag('kitchen.pdf')).toBe('plan');
    expect(v2DefaultDocumentTag('room.jpeg')).toBe('photo');
    expect(v2DefaultDocumentTag('drawing.dwg')).toBe('drawing');
  });
});
