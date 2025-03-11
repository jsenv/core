import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { copyFileSync } from "@jsenv/filesystem";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: {
      "./a.js": "a.js",
      "./b.js": "b.js",
    },
    bundling: false,
    minification: false,
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
    buildDirectoryUrl: new URL("./build/", import.meta.url),
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
