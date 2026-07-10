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

/** Result of JSMol.get_3d_geometry() (parsed from its JSON string). */
export interface RDKitGeometry3D {
  atoms: Array<{
    idx: number;
    x: number;
    y: number;
    z: number;
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
}

export interface JSMol {
  is_valid(): boolean;
  get_smiles(): string;
  get_smiles(details: string): string;
  get_smarts(): string;
  /** Folded Morgan fingerprint as a "0101…" bit string. details: { radius, nBits }. */
  get_morgan_fp(details: string): string;
  get_molblock(details?: string): string;
  /**
   * Fork addition — atom/bond positions and styles as a JSON string.
   * `details` accepts `width`, `height`, `fixedBondLength`, and optional
   * `alignMolBlock` (a MolBlock to orient the molecule against a reference).
   */
  get_2d_geometry(details?: string): string;
  /**
   * Fork addition — atom/bond data with 3D coordinates as a JSON string
   * (parse into {@link RDKitGeometry3D}). A 3D conformer is embedded (ETKDGv3)
   * when the molecule has none; a molecule parsed from a 3D molblock keeps its
   * coordinates. `details` accepts `addHs` (add + position hydrogens before
   * embedding) and any `EmbedMolecule` parameter (e.g. `randomSeed`,
   * `maxIterations`). Returns `{"error":"3D embedding failed"}` if embedding
   * fails.
   */
  get_3d_geometry(details?: string): string;
  /** Compute a 2D layout from scratch (CoordGen if preferred). Returns true on success. */
  set_new_coords(useCoordGen?: boolean): boolean;
  /**
   * Orient this molecule onto `template`'s conformer. Returns a JSON string
   * `{ "atoms": number[], "bonds": number[] }` of the matched atoms/bonds of this
   * molecule, or '' when no match was found.
   */
  generate_aligned_coords(template: JSMol, details: string): string;
  /**
   * Orient onto `template` and return a JSON string
   * `{ "molblock": string, "atoms": number[], "mcsAtoms": number[] }` in one call
   * (mcsAtoms = the kept skeleton shared with the template). Absent on older wasm;
   * callers should fall back to generate_aligned_coords.
   */
  get_aligned_molblock?(template: JSMol, details: string): string;
  delete(): void;
}

export interface RDKitModule {
  version(): string;
  get_mol(input: string, details?: string): JSMol | null;
  get_qmol(input: string): JSMol | null;
  prefer_coordgen(prefer: boolean): void;
}

/**
 * Load and initialise the RDKit WASM module (memoised).
 * @param opts extra Emscripten Module overrides.
 */
export function loadRDKit(opts?: Record<string, unknown>): Promise<RDKitModule>;
export default loadRDKit;
