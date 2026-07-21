# Fork changes vs upstream RDKit

This is a fork of RDKit. This document lists **what this fork changes relative to
upstream RDKit**, and how to build/publish its MinimalLib WebAssembly.

Summary of changes:

1. **New API** — `JSMol::get_2d_geometry()` returns atom/bond positions and styles
   (after layout and optional alignment) as JSON, so a consumer can draw the molecule
   itself (SVG, canvas…) with full interactivity, instead of relying on RDKit's own
   SVG text rendering. `JSMol::get_3d_geometry()` is the 3D counterpart: it returns
   enriched atom/bond data with 3D coordinates (embedding an ETKDGv3 conformer when
   the molecule has none), so a consumer can render the molecule in 3D (e.g. WebGL).
2. **Trimmed MinimalLib build** — InChI, URF, reactions and SubstructLibrary are
   disabled to keep the WASM small (2D drawing only).
3. **Buildable/publishable Dockerfile** — `Dockerfile_local` builds from the local
   tree and emits the WASM artifacts (see below).
4. **npm package** — the compiled WASM is published to the GitLab npm registry as
   `@spaya/rdkit`, so a frontend just `npm install`s it (no build client-side).
5. **Safari fix** — the link flags force `-s GROWABLE_ARRAYBUFFERS=0`. Recent
   Emscripten defaults this to `1` under `ALLOW_MEMORY_GROWTH`, which backs the
   heap with a resizable ArrayBuffer. WebKit's `TextDecoder.decode()` throws
   `TypeError: Resizable ArrayBuffer is not allowed` on a view over such a
   buffer, so every string returned from wasm (`get_2d_geometry`, `get_molblock`,
   …) fails and no molecule renders in Safari. Forcing `0` keeps the plain
   (still growable) buffer and is version-independent. Until a wasm rebuilt with
   this flag is published and installed, the frontend keeps a runtime shim
   (`delete WebAssembly.Memory.prototype.toResizableBuffer` in `rdkit-worker.ts`);
   that shim can be removed once the new `@spaya/rdkit` is in use.

## What the fork adds

- `JSMol::get_2d_geometry(details)` — `Code/MinimalLib/minilib.h` / `minilib.cpp`
- `JSMol::get_3d_geometry(details)` — `Code/MinimalLib/minilib.h` / `minilib.cpp`
- `mol_to_geometry(...)` / `mol_to_3d_geometry(...)` helpers — `Code/MinimalLib/common.h`
- Emscripten binding — `Code/MinimalLib/jswrapper.cpp`
- 3D embedding libraries (`DistGeomHelpers`, `DistGeometry`, `ForceFieldHelpers`,
  `ForceField`) added to the MinimalLib link set — `Code/MinimalLib/CMakeLists.txt`

## Bug fixes vs upstream

- **Aligned double bond drawn as an "X"** — `JSMolBase::get_aligned_molblock`,
  `Code/MinimalLib/minilib.cpp`. `get_aligned_molblock` returns the molecule as a
  molblock so a reactant can be redrawn oriented like the product. The molblock
  writer marks a potentially-stereogenic but UNSPECIFIED double bond (e.g. the C=N of
  an imine, `CC=NC`) as "crossed" (V2000 bond-stereo field = 3, cis-or-trans
  unknown); on redraw RDKit honours it and draws the double bond as an X instead of
  two parallel lines. The direct (non-aligned) render never round-trips through a
  molblock, so only aligned frames showed the X — inconsistent and unwanted in the
  schematic synthesis film. Fix: `clearDoubleBondStereoFlags` zeros the stereo field
  of every V2000 DOUBLE-bond line in the returned molblock (display-only flag here;
  single/wedge bonds untouched, no real stereochemistry lost).

`details` is a JSON string accepting `width`, `height`, `fixedBondLength`, and an optional
`alignMolBlock` (a MolBlock to orient the molecule like the matching sub-part of a reference,
partial match accepted). It returns:

```jsonc
{
  "atoms": [{ "idx", "x", "y", "symbol", "atomicNum", "charge", "numHs",
              "isAromatic", "chiralTag", "cipCode?" }],
  "bonds": [{ "idx", "begin", "end", "bondType", "isAromatic",
              "isConjugated", "bondDir", "stereo" }],
  "view":  { "width", "height" }
}
```

`x`/`y` are pixel coordinates in the `view` box (same layout as `get_svg_with_highlights`).
`bondType` follows RDKit `Bond::BondType` (SINGLE=1, DOUBLE=2, TRIPLE=3, AROMATIC=12).
`bondDir` follows `Bond::BondDir` (NONE=0, BEGINWEDGE=1, BEGINDASH=2) for pseudo-3D wedges.

`get_3d_geometry(details)` is the 3D counterpart. It returns enriched atom/bond data
with 3D coordinates (no `view` box — coordinates are in Ångström, in the conformer's
own frame):

```jsonc
{
  "atoms": [{ "idx", "x", "y", "z", "symbol", "atomicNum", "charge", "numHs",
              "isAromatic", "chiralTag", "cipCode?" }],
  "bonds": [{ "idx", "begin", "end", "bondType", "isAromatic",
              "isConjugated", "bondDir", "stereo" }]
}
```

A 3D conformer is embedded (ETKDGv3) when the molecule has none; a molecule parsed
from a 3D molblock keeps its supplied coordinates. `details` accepts `addHs` (add and
position hydrogens before embedding) and any `EmbedMolecule` parameter (e.g.
`randomSeed`, `maxIterations`; see `updateEmbedParametersFromJSON`). On failure it
returns `{"error":"3D embedding failed"}`.

## Build the WASM (`RDKit_minimal.js` + `RDKit_minimal.wasm`)

Requires Docker. The build compiles the **local** source tree (including uncommitted
changes) via `Code/MinimalLib/docker/Dockerfile_local`. Run from this repository root
(the build context must be the repo root).

```sh
DOCKER_BUILDKIT=1 docker build \
  -f Code/MinimalLib/docker/Dockerfile_local \
  --target export-stage \
  -o Code/MinimalLib/dist .
```

Output: `Code/MinimalLib/dist/RDKit_minimal.js` and `RDKit_minimal.wasm`.

> First build is long (compiles Boost + RDKit under Emscripten). Subsequent builds
> reuse Docker layer cache; only the MinimalLib recompiles when you change `minilib.*`,
> `common.h`, or `jswrapper.cpp`. InChI, URF, reactions and SubstructLibrary are
> disabled to keep the WASM smaller.

### Rebuild from the pushed fork (reproducible / CI)

Point Docker at the remote as the build context instead of the local tree:

```sh
DOCKER_BUILDKIT=1 docker build \
  -f Code/MinimalLib/docker/Dockerfile_local \
  --target export-stage \
  -o Code/MinimalLib/dist \
  https://gitlab.dc.corp.iktos.ai/spaya/rdkit.git#<branch>
```

## Publish the WASM as an npm package (GitLab)

The compiled WASM is shipped as the npm package `@spaya/rdkit` on the GitLab
Package Registry. **Compilation happens once, in CI** — the published package
contains the already-built `RDKit_minimal.js` + `RDKit_minimal.wasm`, so consumers
only download them (`npm install`), never compile.

- Package sources live in `Code/MinimalLib/npm/` (`package.json`, `index.js`,
  `index.d.ts`). The package has **no install/postinstall scripts**, guaranteeing
  the client never runs a build.
- `.gitlab-ci.yml` (job `publish-wasm`) builds the WASM into `Code/MinimalLib/npm/`
  via `Dockerfile_local`, syncs the version to the tag, and runs `npm publish`.
  It runs **on git tags** and authenticates with `CI_JOB_TOKEN` (no AWS/OIDC creds).

Publish a new version:

```sh
git tag v2024.3.1 && git push origin v2024.3.1
```

The package name (`@spaya/…`) must match the GitLab root namespace so it resolves
via the instance-wide npm endpoint. The `docker-in-docker` runner tag is required.

## How `Dockerfile_local` differs from upstream

Changes needed to build this fork today:

- **`COPY` of the local tree** instead of `git clone` — so uncommitted changes are built.
- **Debian Bookworm** base (upstream Buster is EOL: dead apt repos, Python too old for the
  current emsdk). Adds `make` + `xz-utils` (absent from the minimal Bookworm image).
- **Boost** fetched from `archives.boost.io` (the old `boostorg.jfrog.io` host was retired).
- **`emsdk` pinned to `latest`** — it is the only release with prebuilt arm64 binaries
  (Apple Silicon); older pinned versions 404 on arm64.
- **FreeType disabled** (`-DRDK_BUILD_FREETYPE_SUPPORT=OFF`) — it only affects RDKit's own
  SVG text rendering, which is unused here (labels are drawn by the consumer from
  `get_2d_geometry`). This also avoids the broken Comic Neue font download (Google Fonts
  md5 drift).
- **Unused subsystems disabled** — InChI, URF, reactions and SubstructLibrary are turned off
  to shrink the WASM; the corresponding code is guarded by `#ifdef` in `minilib.*` /
  `jswrapper.cpp`.
- **rapidjson 1.1.0 patch** — `GenericStringRef::operator=` assigns to a `const` member and
  lacks a `return`, which recent Clang rejects; a `sed` rewrites it to a no-op.

## Loading the WASM (frontend)

The build emits an ES6 Emscripten module (`EXPORT_NAME=initRDKitModule`,
`MODULARIZE=1`, `EXPORT_ES6=1`, `ENVIRONMENT=web`, `ALLOW_MEMORY_GROWTH=1`).
`Code/MinimalLib/npm/index.js` wraps it in a memoised `loadRDKit()` that resolves
the sibling `.wasm` via `import … ?url` (Vite/Rollup rewrite it to the hashed asset
URL — no `locateFile` config needed).

Consumer setup — a two-line `.npmrc` at the repo root maps the `@spaya` scope to the
private registry (token from an env var, so nothing secret is committed):

```
@spaya:registry=https://gitlab.dc.corp.iktos.ai/api/v4/packages/npm/
//gitlab.dc.corp.iktos.ai/api/v4/packages/npm/:_authToken=${GITLAB_TOKEN}
```

`GITLAB_TOKEN` = a PAT/Deploy Token with scope `read_package_registry`. Then:

```sh
npm install @spaya/rdkit
```

```ts
import { loadRDKit } from "@spaya/rdkit";

const rdkit = await loadRDKit();
const mol = rdkit.get_mol("c1ccccc1");
const geom = JSON.parse(mol.get_2d_geometry(JSON.stringify({ width: 300, height: 300 })));
mol.delete();   // free WASM memory
```
