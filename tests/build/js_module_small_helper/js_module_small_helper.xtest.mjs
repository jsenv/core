// This test is a work in progress
// it reproduce a case where an helper is quite small
// and it would be great if rollup would inline that helper in the main chunk
// instead of generating it
// it would be great to ask rollup what could be done in that case
// see https://github.com/rollup/rollup/blob/900fae0ddb2fd28dc0328b58f88b856aa3c10a35/test/chunking-form/samples/minChunkSize/merge-two-small-chunks-a/_config.js

import { build } from "@jsenv/core";

const test = async ({ expectedFileCount, ...params }) => {
  console.log(expectedFileCount);
  await build({ ...params });
};

// await test({
//   expectedFileCount: 3,
// })
await test({
  minification: false,
});
