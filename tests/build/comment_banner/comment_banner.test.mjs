/**
 * comment_attachment.test.mjs showed a plain source comment above a
 * re-export statement gets dropped by rollup — rollup never copies
 * import/re-export statements as literal text, it resynthesizes them, so
 * nothing placed before them survives.
 *
 * Rollup does expose a dedicated mechanism for injecting arbitrary text
 * regardless of what the source contains: `output.banner` (and
 * `footer`/`intro`/`outro`). It is applied via `magicString.prepend(banner)`
 * directly on the chunk's already-rendered MagicString, so unlike a source
 * comment, it always survives — and rollup's own sourcemap for that chunk
 * stays correct (prepended text has no original position, so it's simply
 * unmapped).
 *
 * jsenv forwards `bundling.js_module.rollupOutput` straight into rollup's
 * `generate()` call, so `banner` can be set from the entryPoint config
 * without touching the source file at all.
 *
 * main.js here is a pure re-export (`export { value } from "./lib.js"`) —
 * exactly the shape that dropped its comment in comment_attachment — to
 * confirm banner works regardless.
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        mode: "package",
        bundling: {
          js_module: {
            rollupOutput: {
              banner: "/*!\n * injected via rollup banner\n */",
            },
          },
        },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("basic", () => run());
});
