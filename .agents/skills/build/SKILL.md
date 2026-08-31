---
name: build
description: How the jsenv build decides what to transpile, what to keep and where files land — the browser target (shared with the dev server), tree-shaking and package.json sideEffects, per-stylesheet css transforms, chunk layout and isolation. Use when working on src/build, the bundling/transpilation/side-effect plugins or runtime-compat, and whenever a build produces something unexpected.
---

## What we want

A build hands the runtimes it targets exactly what they need: nothing lowered
that they already understand, nothing left that they cannot read. And when it
gets that wrong, it has to be _findable_ — which is the hard part, because
**every failure in this area is silent by construction**. A stylesheet that
never reaches the bundle, a file nobody transpiled, a module dropped whole:
no error, no warning, a build that reports success, and a symptom surfacing
somewhere else entirely, often in another repository.

So the discipline everything below serves: **conclude from the artifact, never
from the code just written**. A build bug is a fact about a file on disk; that
file is the only place it can be confirmed or dismissed.

## Verify through `dist/`, not through the sources

`--conditions=dev:jsenv` is the rule everywhere else (see
[.agents/instructions.md](../../instructions.md#running-jsenv-source--always-use---conditionsdevjsenv)),
and it is the wrong tool for one family of question: **what a consumer of the
published package receives**. Tree-shaking, `sideEffects`, chunking, module
isolation, packaging — none of it exists when running from source, so a bug
there can be neither reproduced nor disproved that way. A symptom reported by
an application that _consumes_ a jsenv package belongs to that family by
default.

Two things follow:

- Reproduce by building, then importing `dist/…` by absolute path from a
  throwaway fixture outside the repo. The dev server too:
  `startDevServer` imported from `dist/jsenv_core.js`.
- A package's own build script often resolves `@jsenv/core` to `dist/` rather
  than `src/`, having no `--conditions=dev:jsenv` of its own. Changing jsenv's
  source and rebuilding that package therefore changes nothing until
  `@jsenv/core`'s own `dist/` is rebuilt first. Build core, then the package.

## The browser target is one value

`build()` and `startDevServer()` resolve it identically: the explicit
`runtimeCompat` if given, else `browserslist` in the closest `package.json`
(`engines.node` for a node entry point), else the default in
[browser_default_runtime_compat.js](../../../packages/internal/runtime-compat/src/browser_default_runtime_compat.js).

**Keep it that way.** A divergence between the two does not read as a bug in
the target: it reads as "the same page renders correctly built and wrongly in
dev", and it is looked for in the component, in the css, in the browser —
anywhere but in a number neither side prints. The default floor is deliberately
recent so modern css ships unrewritten; what each step down costs is written
for users in
[docs/users/c_build/c_build.md](../../../docs/users/c_build/c_build.md#21-browser-support),
not here.

## An empty target means "transpile nothing", silently

`RUNTIME_COMPAT.isSupported` walks **the runtimes the target names**. A target
naming none therefore answers "supported" to every feature, and Lightning CSS
receives empty targets: everything is kept as written, nothing is lowered, no
fallback is generated, and the build succeeds.

So an object that is not a runtimeCompat — a Promise, `{}`, something typo'd —
degrades to a full pass-through instead of failing. **When a build transpiles
nothing it should have transpiled, suspect the target before the pipeline**,
and print it rather than reason about it.

## A runtime the feature table does not know is unsupported

The mirror image, in the same function: `featuresCompatMap[runtime]` missing
means `Infinity`, so a feature is judged unsupported as soon as the target names
one runtime the table says nothing about. The safe direction — but it makes the
default and
[features_compatibility.js](../../../packages/internal/runtime-compat/src/features_compatibility.js)
**one pair, never touched separately**: naming a runtime in a default that most
entries omit turns a modern target into a fully transpiled one (a chrome-125
build falling back to SystemJS because one entry lacked `ios_safari`).

When completing that table, take the versions from `caniuse-lite` — and check
the run is contiguous before trusting a minimum. Support that was shipped,
withdrawn and shipped again (SharedWorker in Safari) makes the lowest version
that "supports" a feature a wrong answer. An entry genuinely absent everywhere
(`import_type_css` outside Chrome) is data, not an omission: leave it.

## `sideEffects` decides whether a module survives at all

Once `package.json` declares a `sideEffects` array it is authoritative: a module
it does not name, imported for nothing but its effects, is dropped whole —
along with everything it installed. Nothing is logged, and the readers of what
it declared stay in the bundle, so the symptom appears far from the cause
(a css variable's declaration gone while every `var()` reading it remains).

A module-scope `import.meta.css` assignment is declared as a side effect by
[jsenv:import_meta_css](../../../src/plugins/import_meta_css/jsenv_plugin_import_meta_css.js)
itself, so a stylesheet module needs no entry in that array. Any _other_
pure-side-effect module does. The mechanism that reads the field lives in
[jsenv_plugin_package_side_effects.js](../../../src/plugins/package_side_effects/jsenv_plugin_package_side_effects.js).

## A stylesheet is transformed alone, so it must be valid alone

Every `import.meta.css` becomes its own stylesheet and goes through
[apply_css_transpilation.js](../../../packages/internal/plugin-transpilation/src/css/apply_css_transpilation.js)
on its own. A lowering that emits references to declarations it expects to find
in _another_ rule of the same document therefore produces an invalid
declaration — the property is simply not applied, which is a missing color, not
a degraded one.

Whenever a transform's output depends on something outside the sheet being
transformed, the sheet has to carry that something itself. Reference:
`light-dark()` lowers to a pair of custom properties Lightning CSS only defines
next to a `color-scheme` declaration, so the definitions are appended to any
sheet that needs them.

## Chunk layout

Three rules, none of them arbitrary:

- **What a group loads eagerly is duplicated on purpose.** Under
  `codeSplitting: "isolate"` (the default for node targets) each top-level
  dynamic import gets a self-contained bundle, so it carries only what it
  itself needs. Sharing those chunks would hand every group the union of
  everyone's needs — code loaded and executed for nothing. Two such chunks
  being byte-identical is a coincidence of needs, not a reason to merge them.
- **What a group reaches lazily may be shared.** A chunk behind a dynamic
  import is loaded on demand, by whoever asks; one copy serves all askers
  without making any of them load more. Reached from a single group it lives
  inside it; reached from several it belongs to none and sits beside them.
- **A bundler-produced shared chunk keeps the bundler's placement** — the build
  root — rather than the type-based directory (`js/`, `html/`, …) that files
  coming from sources get. It looks off when the entry points sharing it live
  in subdirectories, and it is not worth changing: that placement is what a
  chunk named through `bundling.js_module.chunks` relies on, and moving it
  moves every consumer's named chunks with it.

Both first rules live in
[bundle_js_modules.js](../../../packages/internal/plugin-bundling/src/js_module/bundle_js_modules.js)
(`assignDynamicImportId` — one id per module, so the counter only ever
separates two _different_ modules whose basename collides) and in
[build_urls_generator.js](../../../src/build/build_urls_generator.js)
(`determineDirectoryPath` — the ancestor chain read from every reference, not
just the first, so a shared chunk does not move the day another group asks for
it first).
