import {
  CHUNK_RELOAD_SESSION_KEY,
  clearChunkReloadGuard,
  isStaleChunkLoadError,
  tryReloadForStaleChunk,
} from './chunk-load-recovery';

describe('isStaleChunkLoadError', () => {
  it('detects failed dynamic import messages', () => {
    expect(
      isStaleChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://crm.kolss.eu/chunk-pSsznlBG.js',
        ),
      ),
    ).toBe(true);
  });

  it('detects MIME module-script failures nested on NavigationError-like objects', () => {
    expect(
      isStaleChunkLoadError({
        error: new Error(
          'Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".',
        ),
      }),
    ).toBe(true);
  });

  it('detects classic webpack-style chunk load failures', () => {
    expect(isStaleChunkLoadError(new Error('Loading chunk chunk-abc failed'))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isStaleChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isStaleChunkLoadError(null)).toBe(false);
    expect(isStaleChunkLoadError(undefined)).toBe(false);
  });
});

describe('tryReloadForStaleChunk', () => {
  it('reloads once and sets the session guard', () => {
    const storage = createMemoryStorage();
    const reload = vi.fn();

    expect(
      tryReloadForStaleChunk(
        new TypeError('Failed to fetch dynamically imported module: /chunk-x.js'),
        storage,
        reload,
      ),
    ).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_SESSION_KEY)).toBe('1');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again when the guard is already set', () => {
    const storage = createMemoryStorage();
    storage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
    const reload = vi.fn();

    expect(
      tryReloadForStaleChunk(
        new TypeError('Failed to fetch dynamically imported module: /chunk-x.js'),
        storage,
        reload,
      ),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload for unrelated errors', () => {
    const storage = createMemoryStorage();
    const reload = vi.fn();

    expect(tryReloadForStaleChunk(new Error('boom'), storage, reload)).toBe(false);
    expect(storage.getItem(CHUNK_RELOAD_SESSION_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('clearChunkReloadGuard', () => {
  it('removes the session guard', () => {
    const storage = createMemoryStorage();
    storage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');

    clearChunkReloadGuard(storage);

    expect(storage.getItem(CHUNK_RELOAD_SESSION_KEY)).toBeNull();
  });
});

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}
