/**
 * Where can a source comment survive rollup bundling? We want an
 * AI-facing comment in dist/jsenv_navi.js (@jsenv/navi), so this checks
 * every plausible placement.
 *
 * Rollup renders a chunk by copying literal ranges of the original source
 * for declarations it keeps — comments survive only when caught inside
 * that copied range. Imports and re-exports (`export { x } from "..."`)
 * are never copied as-is: rollup resolves them through its module graph
 * and re-synthesizes the export list itself, so nothing placed around
 * them survives. This is structural, not a rollup option to flip.
 *
 * Result: only "attached to an export" (a comment directly above a real
 * `const`/`let`/`function` declaration) is preserved. Top of file, end of
 * file, and above a re-export are all dropped. Every case here imports a
 * binding from lib.js so rollup actually bundles across modules — a
 * single self-contained file wouldn't exercise the rewrite path and would
 * misleadingly look like everything survives.
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
