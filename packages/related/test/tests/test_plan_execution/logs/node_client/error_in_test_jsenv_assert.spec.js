import { assert } from "@jsenv/assert";
import { ANSI } from "@jsenv/humanize";

console.log({
  env: process.env.GITHUB_WORKFLOW,
  supported: ANSI.supported,
});

assert({
  actual: true,
  expect: false,
});
