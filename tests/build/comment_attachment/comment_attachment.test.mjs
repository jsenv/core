/**
 * We want an AI reading a built/bundled file (e.g. dist/jsenv_navi.js in
 * @jsenv/navi) to see a top-level comment pointing it to usage instructions.
 * A plain source comment only survives bundling if rollup happens to keep
 * it, so this test explores which placements rollup actually preserves.
 *
 * Rollup does not model comments as part of its AST at all: its exposed
 * node types explicitly omit `leadingComments`/`trailingComments`/
 * `innerComments`/`comments` (see rollup's `RollupAstNode` type). Instead,
 * rollup renders a chunk by copying literal ranges of the original source
 * text for whichever declarations it decides to keep — a comment survives
 * only when it happens to sit inside the source range copied for a kept
 * declaration. Import statements and re-export ("export { x } from ...")
 * statements are never copied as literal text: rollup resolves them through
 * its module graph and re-synthesizes an export list itself, so nothing
 * before them (including a comment) is ever carried over. There is no
 * rollup option to change this — it is structural, not configurable.
 *
 * Each case imports a binding from lib.js so rollup actually has to bundle
 * across modules — a single self-contained file (no cross-module import)
 * doesn't exercise the rewrite path at all, and can misleadingly look like
 * "everything survives" since rollup then has little to resolve/rewrite.
 *
 * Four cases below (this is the layout of navi's real index.js: a
 * top-of-file comment, then a bare side-effect `import`, then re-exports —
 * comment_top_of_file and comment_end_of_file are the two positions we'd
 * actually consider putting an AI-facing comment):
 * - comment at the top of the file: comment directly above `import { value }
 *   from "./lib.js"`. The import is resynthesized, not copied as literal
 *   text, so the comment is dropped.
 * - comment at the end of the file: `import` + bare `export { value };`,
 *   no local declaration at all, comment trailing after both. Neither
 *   preceding statement is ever copied as literal text, so the comment is
 *   dropped too.
 * - attached to an export: comment directly above a real declaration
 *   (`export const value = importedValue * 2`) that rollup keeps and
 *   copies verbatim — survives even though the file also imports another
 *   module and goes through real bundling.
 * - attached to a re-export: comment directly above
 *   `export { value } from "./lib.js"`, which rollup rewrites rather than
 *   copies. Dropped.
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const runOn = (entryPointRelativeUrl) => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      [entryPointRelativeUrl]: {
        mode: "package",
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("comment at the top of the file", () => runOn("./comment_top_of_file.js"));
  test("comment at the end of the file", () => runOn("./comment_end_of_file.js"));
  test("attached to an export", () => runOn("./attached_to_export.js"));
  test("attached to a re-export", () => runOn("./attached_to_reexport.js"));
});
