const KYIV_USER_AVATARS = new Map<string, string>([
  ['8f1200f4-650d-438c-93dc-f2bd25c6c575', '/avatars/sveta-tg.jpg'],
  ['d1f94ab6-9a02-4c56-a552-5384f5b77133', '/avatars/ira-tg.jpg'],
  ['9b797d11-3918-464f-ba91-c8010675d72a', '/avatars/inna-tg.jpg'],
  ['cf00a836-0609-48ce-885e-4b8fa5b3468a', '/avatars/nick-tg.jpg'],
]);

export function getAvatarUrl(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return KYIV_USER_AVATARS.get(userId) ?? null;
}

