/**
 * Email format check (Popup-rules.dc.html "Masks and formats": "Email: checked for
 * name@domain.tld; optional everywhere"), the exact pattern from the Create-lead.dc.html
 * script's `validate()`. Kept separate from the ad-hoc pattern in `V2EditContactDialog`
 * (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, pre-dating this spec) rather than changing that dialog,
 * which is out of scope here (C7–C13 will unify the popups on the new controls).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Empty is valid (email is optional everywhere); non-empty must look like `name@example.com`. */
export function v2IsValidEmailInput(value: string): boolean {
  const text = (value ?? '').trim();
  return text === '' || EMAIL_PATTERN.test(text);
}
