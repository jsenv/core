import { build } from "@jsenv/core";

const jsenvCoreDirectoryUrl = import.meta.resolve("../../../../");

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
          reference.ownerUrlInfo.url.endsWith("/exception.js") &&
          reference.url === jsenvCoreDirectoryUrl
        ) {
          return "preserve";
        }
        return "error";
      },
      scenarioPlaceholders: false,
    },
  },
});
