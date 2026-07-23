import { linkifySegments } from './linkify';

describe('linkifySegments', () => {
  it('returns a single text segment for empty input', () => {
    expect(linkifySegments('')).toEqual([{ type: 'text', value: '' }]);
    expect(linkifySegments(null)).toEqual([{ type: 'text', value: '' }]);
    expect(linkifySegments(undefined)).toEqual([{ type: 'text', value: '' }]);
  });

  it('returns plain text unchanged when there are no URLs', () => {
    expect(linkifySegments('Just a comment')).toEqual([
      { type: 'text', value: 'Just a comment' },
    ]);
  });

  it('linkifies a lone https URL', () => {
    const url =
      'https://tupwidget.com/f4c4ab5279494b8d441eaeedc68c134a/IMG_3056_tilda54808293.jpeg';
    expect(linkifySegments(url)).toEqual([{ type: 'link', value: url }]);
  });

  it('linkifies http and https URLs inside surrounding text', () => {
    expect(
      linkifySegments('See http://example.com/a and https://example.com/b please'),
    ).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'http://example.com/a' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'https://example.com/b' },
      { type: 'text', value: ' please' },
    ]);
  });

  it('strips trailing punctuation from URLs', () => {
    expect(linkifySegments('Open https://example.com/path.')).toEqual([
      { type: 'text', value: 'Open ' },
      { type: 'link', value: 'https://example.com/path' },
      { type: 'text', value: '.' },
    ]);
    expect(linkifySegments('(https://example.com)')).toEqual([
      { type: 'text', value: '(' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ')' },
    ]);
  });

  it('does not treat javascript: as a link', () => {
    expect(linkifySegments('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('preserves newlines around links', () => {
    expect(linkifySegments('note\nhttps://example.com\nok')).toEqual([
      { type: 'text', value: 'note\n' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: '\nok' },
    ]);
  });
});
