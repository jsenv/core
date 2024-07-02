import { assert } from "@jsenv/assert";
import { ANSI } from "@jsenv/humanize";

console.log({
  "process.env.GITHUB_WORKFLOW": process.env.GITHUB_WORKFLOW,
  "supported": ANSI.supported,
  "process.env.FORCE_COLOR": process.env.FORCE_COLOR,
});

assert({
  actual: true,
  expect: false,
});
