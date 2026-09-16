/** Extension version as declared in the generated manifest. */
export function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Version to show in the interface. Sul canale testing il manifest porta un
 * `version_name` leggibile ("0.1.1 testing 42"), che dice anche quale build è
 * installata; in produzione non c'è e vale la version di package.json. Vedi
 * `versionFields()` in wxt.config.ts.
 *
 * Diversa da getExtensionVersion(), che finisce nei metadati dell'export e
 * resta quindi una version e nient'altro.
 */
export function getVersionLabel(): string {
  try {
    const manifest = chrome.runtime.getManifest() as { version: string; version_name?: string };
    return manifest.version_name?.trim() || manifest.version;
  } catch {
    return getExtensionVersion();
  }
}
