// we'll test with a dynamic improt in the end

import { build } from "@jsenv/core";
// import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: import.meta.resolve("./source/"),
  buildDirectoryUrl: import.meta.resolve("./build/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"), // for debug
  entryPoints: {
    "./index.js": {
      runtimeCompat: { node: "20.0" },
    },
  },
});
