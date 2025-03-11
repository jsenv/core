import { build } from "@jsenv/core";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./source/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.js": "main_build.js" },
    runtimeCompat: {
      node: "20",
    },
    // bundling: false,
  });
};

await run();
