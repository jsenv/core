/**
 * comment_banner.test.mjs showed rollup's `output.banner` reliably injects
 * a top-level comment with a correct sourcemap. But navi's real build also
 * splits a side-effect-only import into its own chunk via jsenv's `chunks`
 * option (bundling.js_module.chunks) — this reproduces banner + chunks
 * together and decodes the resulting sourcemap to check it.
 *
 * Expected if correct: banner lines (1-3) map to nothing (null), and
 * `const value = 42;` maps back to lib.js. What we actually get: every
 * banner line falsely maps 1:1 to client/main.js by line number, and the
 * mapping for the real code is wrong too — the whole map looks like it was
 * generated as if there were no banner and no chunk split, then had the
 * banner text pasted on top without adjustment.
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { readFileSync } from "node:fs";
import { SourceMapConsumer } from "source-map";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        mode: "package",
        // the repo's root package.json restricts "sideEffects" to a fixed
        // list of files that doesn't include this test's side_effect.js;
        // without this it would get tree-shaken away, and there would be
        // no second chunk to reproduce the bug with.
        packageSideEffects: false,
        bundling: {
          js_module: {
            chunks: {
              side_effects_chunk: {
                "./side_effect.js": true,
              },
            },
            rollupOutput: {
              banner: "/*!\n * banner text\n */",
            },
          },
        },
      },
    },
  });

  const codeUrl = import.meta.resolve("./build/main.js");
  const mapUrl = import.meta.resolve("./build/main.js.map");
  const code = readFileSync(new URL(codeUrl), "utf8");
  const map = JSON.parse(readFileSync(new URL(mapUrl), "utf8"));
  const consumer = await new SourceMapConsumer(map);
  const lines = code.split("\n");
  return lines.map((lineContent, index) => {
    const line = index + 1;
    return {
      line,
      code: lineContent,
      mapsTo: consumer.originalPositionFor({ line, column: 0 }),
    };
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("basic", () => run());
});
