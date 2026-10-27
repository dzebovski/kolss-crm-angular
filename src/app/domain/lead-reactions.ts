import type { Lead, LeadReaction, LeadReactionKind } from './lead.types';

export const LEAD_REACTION_KINDS: readonly LeadReactionKind[] = [
  'like',
  'star',
  'question',
  'cross',
];

export function isLeadReactionKind(value: unknown): value is LeadReactionKind {
  return value === 'like' || value === 'star' || value === 'question' || value === 'cross';
}

export function reactionOf(
  reactions: readonly LeadReaction[],
  kind: LeadReactionKind,
): LeadReaction | null {
  return reactions.find((reaction) => reaction.kind === kind) ?? null;
}

/** Returns `reactions` with `userId` added to / removed from `kind`, kinds kept in canonical order. */
export function withUserReaction(
  reactions: readonly LeadReaction[],
  kind: LeadReactionKind,
  user: { readonly id: string; readonly name: string },
  on: boolean,
): readonly LeadReaction[] {
  const current = reactionOf(reactions, kind);
  const userIds = (current?.userIds ?? []).filter((id) => id !== user.id);
  const userNames = (current?.userNames ?? []).filter(
    (_, index) => current?.userIds[index] !== user.id,
  );
  if (on) {
    userIds.push(user.id);
    userNames.push(user.name);
  }
  const others = reactions.filter((reaction) => reaction.kind !== kind);
  const next = userIds.length
    ? [...others, { kind, count: userIds.length, userIds, userNames }]
    : others;
  return LEAD_REACTION_KINDS.flatMap((candidate) => {
    const reaction = next.find((entry) => entry.kind === candidate);
    return reaction ? [reaction] : [];
  });
}

/** Empty `kinds` = no filter. Otherwise the lead needs anyone's reaction of at least one kind. */
export function leadHasAnyReaction(lead: Lead, kinds: readonly LeadReactionKind[]): boolean {
  if (!kinds.length) return true;
  return lead.reactions.some((reaction) => reaction.count > 0 && kinds.includes(reaction.kind));
}

/** Most recently active first; ties fall back to id for a stable order. */
export function sortLeadsByActivity(leads: readonly Lead[]): readonly Lead[] {
  return [...leads].sort(
    (a, b) =>
      Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) || a.id.localeCompare(b.id),
  );
}
