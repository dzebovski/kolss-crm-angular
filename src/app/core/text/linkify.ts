export type LinkifySegment =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'link'; readonly value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

/**
 * Splits plain text into text/link segments so URLs can be rendered as anchors
 * without trusting user HTML.
 */
export function linkifySegments(text: string | null | undefined): LinkifySegment[] {
  const value = text ?? '';
  if (!value) {
    return [{ type: 'text', value }];
  }

  const segments: LinkifySegment[] = [];
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const raw = match[0];
    const { url, trailing } = splitTrailingPunctuation(raw);

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }

    if (url) {
      segments.push({ type: 'link', value: url });
    }
    if (trailing) {
      segments.push({ type: 'text', value: trailing });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value }];
}

function splitTrailingPunctuation(raw: string): { url: string; trailing: string } {
  const punctMatch = raw.match(TRAILING_PUNCTUATION);
  if (!punctMatch) {
    return { url: raw, trailing: '' };
  }

  const trailing = punctMatch[0];
  return {
    url: raw.slice(0, -trailing.length),
    trailing,
  };
}
