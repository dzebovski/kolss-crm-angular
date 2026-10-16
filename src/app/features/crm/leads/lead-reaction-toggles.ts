import { Component, computed, inject, input, model, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { LEAD_REACTION_KINDS, reactionOf, withUserReaction } from '@domain/lead-reactions';
import type { LeadReaction, LeadReactionKind } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';

const REACTION_EMOJI: Readonly<Record<LeadReactionKind, string>> = {
  like: '👍',
  star: '⭐',
  question: '❓',
};

/**
 * Personal like / star / question reactions, toggled like reactions on a post.
 * Saves on its own (optimistic, rolled back on failure) and reports the new
 * state through `reactions` so the host list or card stays in sync.
 */
@Component({
  selector: 'app-lead-reaction-toggles',
  template: `
    <div
      class="lead-reactions"
      [class.lead-reactions--compact]="compact()"
      role="group"
      [attr.aria-label]="i18n.t('leads.reaction.groupAria')"
    >
      @for (kind of kinds; track kind) {
        @let reaction = reactionFor(kind);
        @let mine = isMine(reaction);
        <button
          type="button"
          class="lead-reaction"
          [class.lead-reaction--mine]="mine"
          [class.lead-reaction--used]="!!reaction"
          [attr.aria-pressed]="mine"
          [attr.aria-label]="label(kind) + (reaction ? ': ' + reaction.count : '')"
          [attr.title]="tooltip(kind, reaction)"
          [disabled]="disabled() || pending() === kind"
          (click)="toggle($event, kind)"
          (keydown.enter)="$event.stopPropagation()"
        >
          <span aria-hidden="true">{{ emoji[kind] }}</span>
          @if (reaction) {
            <small>{{ reaction.count }}</small>
          }
        </button>
      }
      @if (error()) {
        <span class="lead-reactions__error" role="alert">{{ error() }}</span>
      }
    </div>
  `,
  styleUrl: './lead-reaction-toggles.scss',
})
export class LeadReactionToggles {
  private readonly leadsService = inject(LeadsService);
  protected readonly i18n = inject(I18nService);

  readonly leadId = input.required<string>();
  readonly reactions = model<readonly LeadReaction[]>([]);
  readonly disabled = input(false);
  readonly compact = input(false);

  protected readonly kinds = LEAD_REACTION_KINDS;
  protected readonly emoji = REACTION_EMOJI;
  protected readonly pending = signal<LeadReactionKind | null>(null);
  protected readonly error = signal('');
  private readonly userId = computed(() => {
    try {
      return this.leadsService.currentUserId();
    } catch {
      return '';
    }
  });

  protected reactionFor(kind: LeadReactionKind): LeadReaction | null {
    return reactionOf(this.reactions(), kind);
  }

  protected isMine(reaction: LeadReaction | null): boolean {
    return !!reaction && reaction.userIds.includes(this.userId());
  }

  protected label(kind: LeadReactionKind): string {
    return this.i18n.t(`leads.reaction.${kind}`);
  }

  protected tooltip(kind: LeadReactionKind, reaction: LeadReaction | null): string {
    return reaction ? `${this.label(kind)}: ${reaction.userNames.join(', ')}` : this.label(kind);
  }

  protected async toggle(event: Event, kind: LeadReactionKind): Promise<void> {
    // The list row opens the lead on click; a reaction must not.
    event.stopPropagation();
    const userId = this.userId();
    if (this.disabled() || this.pending() || !userId) return;

    const before = this.reactions();
    const on = !this.isMine(reactionOf(before, kind));
    const user = { id: userId, name: this.leadsService.currentUserName() };
    this.error.set('');
    this.pending.set(kind);
    this.reactions.set(withUserReaction(before, kind, user, on));
    try {
      const saved = await this.leadsService.setReaction(this.leadId(), kind, on);
      if (saved) {
        const others = this.reactions().filter((reaction) => reaction.kind !== kind);
        this.reactions.set(
          LEAD_REACTION_KINDS.flatMap((candidate) => {
            const entry = candidate === kind ? saved : others.find((r) => r.kind === candidate);
            return entry ? [entry] : [];
          }),
        );
      }
    } catch {
      this.reactions.set(before);
      this.error.set(this.i18n.t('leads.reaction.failed'));
    } finally {
      this.pending.set(null);
    }
  }
}
