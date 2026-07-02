// Type declarations for @spaya/rdkit.
//
// Only the subset of MinimalLib enabled in this fork is declared. `get_2d_geometry`
// is the fork-specific addition (see FORK_CHANGES.md).

/** Result of JSMol.get_2d_geometry() (parsed from its JSON string). */
export interface RDKitGeometry {
  atoms: Array<{
    idx: number;
    x: number;
    y: number;
    symbol: string;
    atomicNum: number;
    charge: number;
    numHs: number;
    isAromatic: boolean;
    chiralTag: number;
    cipCode?: string;
  }>;
  bonds: Array<{
    idx: number;
    begin: number;
    end: number;
    /** RDKit Bond::BondType — SINGLE=1, DOUBLE=2, TRIPLE=3, AROMATIC=12. */
    bondType: number;
    isAromatic: boolean;
    isConjugated: boolean;
    /** RDKit Bond::BondDir — NONE=0, BEGINWEDGE=1, BEGINDASH=2. */
    bondDir: number;
    stereo: number;
  }>;
  view: { width: number; height: number };
}

export interface JSMol {
  is_valid(): boolean;
  get_smiles(): string;
  get_molblock(details?: string): string;
  get_svg(): string;
  get_svg_with_highlights(details: string): string;
  /**
   * Fork addition — atom/bond positions and styles as a JSON string.
   * `details` accepts `width`, `height`, `fixedBondLength`, and optional
   * `alignMolBlock` (a MolBlock to orient the molecule against a reference).
   */
  get_2d_geometry(details?: string): string;
  delete(): void;
}

export interface RDKitModule {
  version(): string;
  get_mol(input: string, details?: string): JSMol;
  get_qmol(input: string): JSMol;
  prefer_coordgen(prefer: boolean): void;
}

/**
 * Load and initialise the RDKit WASM module (memoised).
 * @param opts extra Emscripten Module overrides.
 */
export function loadRDKit(opts?: Record<string, unknown>): Promise<RDKitModule>;
export default loadRDKit;
