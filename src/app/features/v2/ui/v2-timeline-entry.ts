import { Component, computed, input } from '@angular/core';

import { v2ToneColor, type V2Tone } from './v2-tone';

/** Dot colour: a status or rating tone, `ink` (first message, comment) or `faint` (system). */
export type V2TimelineTone = V2Tone | 'ink' | 'faint';

export interface V2TimelineChangeSide {
  readonly label: string;
  /** `null` = no previous value (e.g. "No rating"): the dot is `line-strong`. */
  readonly tone: V2Tone | null;
}

/** Status or rating change: from-pill → arrow → to-pill. */
export interface V2TimelineChange {
  readonly from: V2TimelineChangeSide;
  readonly to: V2TimelineChangeSide;
}

export interface V2TimelineRow {
  readonly key: string;
  readonly value: string;
}

// TimelineEntry (design system components/TimelineEntry; values from lead card v1.3,
// Timeline): date column, dot on a rail, then title + author, an optional change, the client
// quote, Key: value rows and the comment text. Labels and dates arrive formatted (D2 rules).
// `last` = the oldest entry: no rail below and no separator. Projected content goes at the end
// of the entry (the card adds the translation and the edit / delete / translate actions).
@Component({
  selector: 'app-v2-timeline-entry',
  templateUrl: './v2-timeline-entry.html',
  styleUrl: './v2-timeline-entry.scss',
  host: { '[class.v2-timeline-entry--last]': 'last()' },
})
export class V2TimelineEntry {
  readonly date = input.required<string>();
  readonly time = input.required<string>();
  readonly title = input.required<string>();
  readonly author = input('');
  readonly tone = input.required<V2TimelineTone>();
  readonly last = input(false);
  readonly change = input<V2TimelineChange | null>(null);
  readonly quote = input<string | null>(null);
  readonly rows = input<readonly V2TimelineRow[]>([]);
  readonly text = input<string | null>(null);

  protected readonly dotColor = computed(() => timelineColor(this.tone()));
  protected readonly fromColor = computed(() => sideColor(this.change()?.from.tone ?? null));
  protected readonly toColor = computed(() => sideColor(this.change()?.to.tone ?? null));
}

function timelineColor(tone: V2TimelineTone): string {
  if (tone === 'ink') return 'var(--v2-ink)';
  if (tone === 'faint') return 'var(--v2-faint)';
  return v2ToneColor(tone);
}

function sideColor(tone: V2Tone | null): string {
  return tone === null ? 'var(--v2-line-strong)' : v2ToneColor(tone);
}
