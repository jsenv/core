// This test is a work in progress
// it reproduce a case where an helper is quite small
// and it would be great if rollup would inline that helper in the main chunk
// instead of generating it
// it would be great to ask rollup what could be done in that case
// see https://github.com/rollup/rollup/blob/900fae0ddb2fd28dc0328b58f88b856aa3c10a35/test/chunking-form/samples/minChunkSize/merge-two-small-chunks-a/_config.js

import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const test = async ({ expectedFileCount, ...params }) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const actual = Object.keys(buildFileContents).length;
  const expected = expectedFileCount;
  assert({ actual, expected });
};

// await test({
//   expectedFileCount: 3,
// })
await test({
  expectedFileCount: 2,
  bundling: {
    js_module: {
      rollupOutput: {
        experimentalMinChunkSize: 1000,
      },
    },
  },
  minification: false,
  versioning: false,
});
