import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { copyFileSync } from "@jsenv/filesystem";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./a.js": {
        bundling: false,
        minification: false,
        runtimeCompat: { chrome: "90" },
      },
      "./b.js": {
        bundling: false,
        minification: false,
        runtimeCompat: { chrome: "90" },
      },
    },
  });
  copyFileSync({
    from: new URL("./client/a.html", import.meta.url),
    to: new URL("./build/a.html", import.meta.url),
  });
  copyFileSync({
    from: new URL("./client/b.html", import.meta.url),
    to: new URL("./build/b.html", import.meta.url),
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  const a = await executeHtml(`${buildServer.origin}/a.html`);
  const b = await executeHtml(`${buildServer.origin}/b.html`);
  return { a, b };
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
