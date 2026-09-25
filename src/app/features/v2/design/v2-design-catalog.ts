import type { MessageKey } from '@core/i18n/messages';

/**
 * Token catalog for the v2 design system page (`/v2/design`).
 *
 * Names and usage notes are the design system's own text (design system "KOLSS CRM",
 * project/tokens.json), kept in English as the source; the page reads each value from the
 * `--v2-<name>` custom property (`src/styles/v2/_tokens.scss`), so values have one source.
 * The `states` group is not in the design system: it documents the derived interaction
 * tokens of `_interactive.scss`.
 */
export interface V2DesignToken {
  readonly name: string;
  readonly usage: string;
}

export interface V2DesignTokenGroup {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly tokens: readonly V2DesignToken[];
}

export const V2_COLOR_GROUPS: readonly V2DesignTokenGroup[] = [
  {
    id: 'neutrals',
    titleKey: 'v2.design.group.neutrals',
    tokens: [
      {
        name: 'ground',
        usage:
          'Page background behind cards. Also the fill of quotes, comment boxes and segmented-control tracks.',
      },
      { name: 'surface', usage: 'Cards, panels, modals, inputs and secondary buttons.' },
      {
        name: 'surface-sunk',
        usage: 'Avatar circle, code chip (W0142), product tags, date tiles of future tasks.',
      },
      { name: 'line', usage: 'Card borders, timeline rail, menu borders.' },
      {
        name: 'line-strong',
        usage: 'Input and secondary-button borders; the divider inside the action panel.',
      },
      { name: 'line-soft', usage: 'Row dividers inside cards (header info grid, task list).' },
      {
        name: 'ink',
        usage:
          'Primary text, the one filled primary button per screen, focus rings, selected chips.',
      },
      { name: 'ink-2', usage: 'Body text inside comments, quotes and timeline notes.' },
      { name: 'muted', usage: 'Labels, captions, meta rows, timestamps. 5.3:1 on surface.' },
      {
        name: 'subtle',
        usage: 'Empty values ("Not set"), lost/new status dot. Not for body text.',
      },
      {
        name: 'faint',
        usage: 'System timeline dots, breadcrumb separators, dashed upload borders.',
      },
      { name: 'on-ink', usage: 'Text and icons on ink fills.' },
    ],
  },
  {
    id: 'status',
    titleKey: 'v2.design.group.status',
    tokens: [
      { name: 'status-new', usage: 'Dot for New lead.' },
      { name: 'status-later', usage: 'Dot for Call later.' },
      { name: 'status-noanswer', usage: 'Dot for No answer. Also overdue dates and warnings.' },
      { name: 'status-success', usage: 'Dot for Successful call and done tasks.' },
      { name: 'status-thinking', usage: 'Dot for Client thinking.' },
      { name: 'status-invited', usage: 'Dot for Invited to showroom.' },
      { name: 'status-lost', usage: 'Dot for Lost.' },
      { name: 'status-project', usage: 'Dot and filled badge for Project (lead converted).' },
    ],
  },
  {
    id: 'rating',
    titleKey: 'v2.design.group.rating',
    tokens: [
      { name: 'rating-cold', usage: 'Cold rating text and dot, on rating-cold-bg.' },
      { name: 'rating-cold-bg', usage: 'Cold rating pill fill.' },
      { name: 'rating-medium', usage: 'Medium rating text and dot, on rating-medium-bg.' },
      { name: 'rating-medium-bg', usage: 'Medium rating pill fill.' },
      { name: 'rating-hot', usage: 'Hot rating text and dot, on rating-hot-bg.' },
      { name: 'rating-hot-bg', usage: 'Hot rating pill fill.' },
    ],
  },
  {
    id: 'feedback',
    titleKey: 'v2.design.group.feedback',
    tokens: [
      { name: 'danger', usage: 'Overdue dates, "No next step planned" warning text.' },
      { name: 'danger-bg', usage: 'Warning callout fill and overdue date tiles.' },
      { name: 'success-bg', usage: 'Positive tag fill (e.g. Plan tag on a document).' },
      { name: 'success-ink', usage: 'Text on success-bg.' },
      { name: 'calendar-bg', usage: 'Calendar-event note inside the showroom invite popup.' },
      { name: 'calendar-ink', usage: 'Text on calendar-bg.' },
      { name: 'scrim', usage: 'Overlay behind modals.' },
    ],
  },
  {
    id: 'states',
    titleKey: 'v2.design.group.states',
    tokens: [
      {
        name: 'hover-overlay',
        usage: 'Tint over any control fill on hover (secondary buttons, chips, tabs, menu rows).',
      },
      { name: 'pressed-overlay', usage: 'Tint over any control fill while pressed.' },
      { name: 'line-hover', usage: 'Border of bordered controls and inputs on hover.' },
      { name: 'ink-hover', usage: 'Primary button and selected chips on hover.' },
      { name: 'ink-pressed', usage: 'Primary button and selected chips while pressed.' },
    ],
  },
];

export const V2_SPACING_TOKENS: readonly V2DesignToken[] = [
  { name: 'space-1', usage: 'Label to value inside tight groups; segmented-control padding.' },
  { name: 'space-2', usage: 'Gap between buttons and chips in a row; label to field.' },
  { name: 'space-3', usage: 'Field-to-field gap in popups; icon to text in list rows.' },
  { name: 'space-4', usage: 'Gap between page blocks; timeline column gap.' },
  { name: 'space-5', usage: 'Card side padding; gap between groups in the action panel.' },
  { name: 'space-6', usage: 'Header card side padding; columns of the header info grid.' },
  { name: 'space-7', usage: 'Page side gutter at desktop width (1440).' },
];

export const V2_RADIUS_TOKENS: readonly V2DesignToken[] = [
  { name: 'radius-xs', usage: 'Code chip, product tags, tabs inside a segmented control.' },
  { name: 'radius-sm', usage: 'Buttons, inputs, selects, menu items.' },
  { name: 'radius-md', usage: 'Large (48px) buttons, date tiles, quotes, callouts.' },
  { name: 'radius-lg', usage: 'Cards, panels, modals.' },
  { name: 'radius-pill', usage: 'Status and rating pills, filter chips, dots.' },
];

export const V2_SHADOW_TOKENS: readonly V2DesignToken[] = [
  { name: 'shadow-control', usage: 'Call-result buttons; selected segment.' },
  { name: 'shadow-menu', usage: 'Dropdown menus.' },
  { name: 'shadow-modal', usage: 'Popups.' },
];

export const V2_SIZE_TOKENS: readonly V2DesignToken[] = [
  { name: 'control-sm', usage: 'Chips, filter tabs, small secondary buttons.' },
  { name: 'control-md', usage: 'Default buttons, inputs, selects.' },
  { name: 'control-lg', usage: 'Call-result buttons — the most frequent action.' },
  { name: 'page-width', usage: 'Desktop design width.' },
];

/** Type styles; each renders with `type.text(<name>)` (`src/styles/v2/_type.scss`). */
export interface V2DesignTypeStyle {
  readonly name: string;
  readonly sample: string;
  readonly usage: string;
}

export interface V2DesignTypeGroup {
  readonly name: string;
  readonly styles: readonly V2DesignTypeStyle[];
}

export const V2_TYPE_GROUPS: readonly V2DesignTypeGroup[] = [
  {
    name: 'Headings',
    styles: [
      { name: 'lead-name', sample: 'Olena Kowal', usage: "Person's name in the card header." },
      {
        name: 'suggestion',
        sample: 'Call again',
        usage: 'Action suggestion title in the action panel. One per screen.',
      },
      { name: 'modal-title', sample: 'Invited to showroom', usage: 'Popup titles.' },
      { name: 'section-title', sample: 'Timeline', usage: 'Titles of full-width blocks.' },
      {
        name: 'card-label',
        sample: 'Reminders & tasks',
        usage: 'Small titles of the three info cards, in muted.',
      },
      { name: 'eyebrow', sample: 'Lead', usage: 'Entity type above the name. Uppercase.' },
    ],
  },
  {
    name: 'Text',
    styles: [
      {
        name: 'body',
        sample: 'Wants to see veneer fronts and island samples.',
        usage: 'Default text, comments, table cells.',
      },
      {
        name: 'body-strong',
        sample: 'Sat 26 Sep, 12:00–13:00',
        usage: 'Values next to labels, button labels.',
      },
      { name: 'value', sample: '22 000 – 25 000 zł', usage: 'Key facts in the header info grid.' },
      {
        name: 'quote',
        sample: "Hi! I'd like a quote for a kitchen with an island.",
        usage: "Client's first message in the timeline.",
      },
      { name: 'caption', sample: 'Last call: 1 day ago', usage: 'Meta rows, hints under fields.' },
      {
        name: 'label',
        sample: 'Estimated budget',
        usage: 'Field and group labels, always in muted.',
      },
    ],
  },
  {
    name: 'Data',
    styles: [
      {
        name: 'code',
        sample: 'W0142',
        usage: 'Client codes (W0000 Warsaw, K0000 Kyiv), file-type tiles.',
      },
    ],
  },
];

/** Link to the design system in Claude Design (the source of this page). */
export const V2_DESIGN_SYSTEM_URL = 'https://claude.ai/artifact/XUQ71ExuXaUUJw3kPGkeUb';
