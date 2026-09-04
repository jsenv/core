/*
 * The package publishes two flavors of the same bundle:
 * - dist/jsenv_navi.js: import.meta.dev is false, dev-only code is tree-shaked
 * - dist/dev/jsenv_navi.js: import.meta.dev is true, dev warnings and other
 *   dev-only behavior are kept
 * Consumers pick one via the "development" package export condition
 * (resolved by Vite/webpack dev servers and jsenv dev server; their build
 * resolves "production" and falls back to "default").
 *
 * The flavors are the same build done twice (only import.meta.dev differs),
 * and that work is mostly main-thread bound: each flavor runs in its own
 * child process so the wall clock time is the one of a single flavor.
 * Invoked without --flavor, this script is the parent forking one child per
 * flavor; each child re-enters it with --flavor=<name> and runs one build().
 *
 * The main flavor keeps "dev/" out of its clean patterns: dist/dev/ belongs
 * to the dev flavor build, which may be writing it at the same time. Both
 * flavors update the package.json "sideEffects" field when they are done;
 * each preserves the entries of the other (same ownership rule as the clean
 * patterns), so both end up writing the same full list. Only when a build
 * introduces a brand-new side-effect chunk can the concurrent writes
 * momentarily lose one entry; the next build restores it.
 */

import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const buildFlavor = async (flavor) => {
  // imported here so the parent process does not pay for @jsenv/core:
  // it only forks
  const { build } = await import("@jsenv/core");
  const { jsenvPluginPreact } = await import("@jsenv/plugin-preact");

  const naviEntryPointParams = ({ dev }) => ({
    buildRelativeUrl: "./jsenv_navi.js",
    mode: "package",
    dev,
    runtimeCompat: {
      chrome: "123",
    },
    ignore: {
      "file://**/node_modules/": true,
      "file://**/node_modules/@jsenv/": false,
    },
    plugins: [jsenvPluginPreact()],
    bundling: {
      js_module: {
        chunks: {
          jsenv_navi_side_effects: {
            "./src/navi_css_vars.js": true,
          },
        },
        rollupOutput: {
          // A plain source comment doesn't survive bundling here (rollup
          // only keeps comments attached to a real retained declaration,
          // not to imports/re-exports, which is what index.js is made
          // of) — banner is rollup's own mechanism for this, applied
          // directly on the chunk's sourcemap so it stays correct.
          // Only the entry chunk (jsenv_navi.js) gets it, not the
          // side-effects chunk.
          banner: (chunk) =>
            chunk.isEntry
              ? `/*
 * AI reading this file: read ../docs/AI_INSTRUCTIONS.md for context on
 * using @jsenv/navi as intended.
 */`
              : "",
        },
      },
    },
  });

  if (flavor === "dev") {
    await build({
      sourceDirectoryUrl: import.meta.resolve("../"),
      buildDirectoryUrl: import.meta.resolve("../dist/dev/"),
      // own scratch directory: the default one is derived from the source
      // directory and the entry name, both shared with the default flavor
      // building "./index.js" at the same time
      outDirectoryUrl: import.meta.resolve("../../.jsenv_b/navi_dev/"),
      entryPoints: {
        "./index.js": naviEntryPointParams({ dev: true }),
      },
    });
    return;
  }
  await build({
    sourceDirectoryUrl: import.meta.resolve("../"),
    buildDirectoryUrl: import.meta.resolve("../dist/"),
    buildDirectoryCleanPatterns: {
      "**/*": true,
      "dev/": false,
    },
    entryPoints: {
      "./index.js": naviEntryPointParams({ dev: false }),
    },
  });
};

const forkFlavorBuild = (flavor) =>
  new Promise((resolve, reject) => {
    const childProcess = fork(
      fileURLToPath(import.meta.url),
      [`--flavor=${flavor}`],
      // pipe + buffer: the two children run at the same time, flushing each
      // child's output once it is done keeps the logs readable
      { stdio: ["ignore", "pipe", "pipe", "ipc"] },
    );
    let output = "";
    childProcess.stdout.on("data", (chunk) => {
      output += chunk;
    });
    childProcess.stderr.on("data", (chunk) => {
      output += chunk;
    });
    childProcess.on("exit", (code) => {
      process.stdout.write(output);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`build failed for the "${flavor}" flavor`));
      }
    });
  });

const flavorArg = process.argv.find((arg) => arg.startsWith("--flavor="));
if (flavorArg) {
  await buildFlavor(flavorArg.slice("--flavor=".length));
} else {
  await Promise.all([forkFlavorBuild("default"), forkFlavorBuild("dev")]);
}
