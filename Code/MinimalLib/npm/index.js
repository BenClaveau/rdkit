// ESM entry point for @spaya/rdkit.
//
// RDKit_minimal.js is an Emscripten MODULARIZE + EXPORT_ES6 module: its default
// export is the factory `initRDKitModule(opts)`. We resolve the sibling .wasm via
// Vite's `?url` so the consumer never has to configure `locateFile` — any bundler
// that understands `import ... ?url` (Vite, Rollup w/ url plugin) rewrites it to
// the correct hashed asset URL at build time.
import initRDKitModule from "./RDKit_minimal.js";
import wasmUrl from "./RDKit_minimal.wasm?url";

let modulePromise = null;

/**
 * Load and initialise the RDKit WASM module (memoised — safe to call repeatedly).
 * @param {object} [opts] extra Emscripten Module overrides (merged last).
 * @returns {Promise<any>} the initialised RDKit module (get_mol, get_qmol, ...).
 */
export function loadRDKit(opts = {}) {
  if (!modulePromise) {
    modulePromise = initRDKitModule({
      locateFile: (path) => (path.endsWith(".wasm") ? wasmUrl : path),
      ...opts,
    });
  }
  return modulePromise;
}

export default loadRDKit;
