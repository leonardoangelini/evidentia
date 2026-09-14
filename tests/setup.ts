import 'fake-indexeddb/auto';

// Minimal chrome stub for modules that touch the extension API at import/call time.
const g = globalThis as unknown as { chrome?: unknown };
if (!g.chrome) {
  g.chrome = {
    runtime: { getManifest: () => ({ version: '0.0.0-test' }), lastError: undefined },
  };
}
