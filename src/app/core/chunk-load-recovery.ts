/** sessionStorage key guarding against infinite reload loops after a stale deploy. */
export const CHUNK_RELOAD_SESSION_KEY = 'kolss-crm-chunk-reload';

const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /loading chunk [\w.-]+ failed/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /expected a javascript-or-wasm module script/i,
  /mime type .+text\/html/i,
];

/** True when the error looks like a missing/stale hashed chunk after a new deploy. */
export function isStaleChunkLoadError(error: unknown): boolean {
  for (const message of collectErrorMessages(error)) {
    if (STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message))) {
      return true;
    }
  }
  return false;
}

/**
 * Reloads once when a navigation fails because a hashed chunk is gone after deploy.
 * Returns true if a reload was triggered.
 */
export function tryReloadForStaleChunk(
  error: unknown,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultSessionStorage(),
  reload: () => void = () => globalThis.location.reload(),
): boolean {
  if (!isStaleChunkLoadError(error) || !storage) {
    return false;
  }

  if (storage.getItem(CHUNK_RELOAD_SESSION_KEY) === '1') {
    return false;
  }

  storage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
  reload();
  return true;
}

/** Clears the one-shot reload guard after a successful boot with fresh assets. */
export function clearChunkReloadGuard(
  storage: Pick<Storage, 'removeItem'> | null = defaultSessionStorage(),
): void {
  storage?.removeItem(CHUNK_RELOAD_SESSION_KEY);
}

function defaultSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();

  const visit = (value: unknown): void => {
    if (value == null || seen.has(value)) {
      return;
    }
    seen.add(value);

    if (typeof value === 'string') {
      messages.push(value);
      return;
    }

    if (value instanceof Error) {
      if (value.message) {
        messages.push(value.message);
      }
      visit((value as Error & { cause?: unknown }).cause);
      return;
    }

    if (typeof value === 'object') {
      const record = value as { message?: unknown; error?: unknown; reason?: unknown };
      visit(record.message);
      visit(record.error);
      visit(record.reason);
    }
  };

  visit(error);
  return messages;
}
