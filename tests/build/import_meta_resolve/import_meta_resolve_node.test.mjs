import { build } from "@jsenv/core";

const test = async ({ runtimeCompat }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./node_client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./index.js": "index.js",
    },
    runtimeCompat,
  });
};

// await test('node_not_supported', {
//   runtimeCompat: { node: "20" },
// });
await test("node_supported", {
  runtimeCompat: { node: "19" },
});
