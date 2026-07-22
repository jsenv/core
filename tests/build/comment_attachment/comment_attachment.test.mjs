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
 * Three cases below:
 * - attached to nothing: comment is the last thing in the file, no
 *   statement follows it at all.
 * - attached to an export: comment directly above a real declaration
 *   (`export const value = 2`) that rollup keeps and copies verbatim.
 * - attached to a re-export: comment directly above
 *   `export { value } from "./lib.js"`, which rollup rewrites rather than
 *   copies.
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
  test("attached to nothing", () => runOn("./attached_to_nothing.js"));
  test("attached to an export", () => runOn("./attached_to_export.js"));
  test("attached to a re-export", () => runOn("./attached_to_reexport.js"));
});
