import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main.js": {
      buildRelativeUrl: "./jsenv_test.js",
      runtimeCompat: { node: "20.0" },
      directoryReferenceEffect: (reference) => {
        if (
          reference.subtype === "import_meta_resolve" &&
          reference.ownerUrlInfo.url.endsWith("/exception.js")
        ) {
          return "preserve";
        }
        return "error";
      },
      scenarioPlaceholders: false,
    },
  },
});
