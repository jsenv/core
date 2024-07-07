import { assert } from "@jsenv/assert";

import { executeTestPlan, inlineRuntime } from "@jsenv/test";

const test = async (inlineExec, expectCallOrder) => {
  const callOrder = [];
  const inlineExecutions = {};
  for (const key of Object.keys(inlineExec)) {
    const desc = inlineExec[key];
    inlineExecutions[key] = {
      uses: desc.uses,
      runtime: inlineRuntime(async () => {
        callOrder.push(`${key}_start`);
        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
        callOrder.push(`${key}_end`);
      }),
    };
  }
  await executeTestPlan({
    logs: {
      level: "warn",
    },
    rootDirectoryUrl: new URL("./", import.meta.url),
    testPlan: {
      "./uses_port.test.mjs": inlineExecutions,
    },
    githubCheck: false,
  });
  assert({
    actual: {
      callOrder,
    },
    expect: {
      callOrder: expectCallOrder,
    },
  });
};

await test(
  {
    a: { uses: ["port:4"] },
    b: { uses: ["port:5"] },
    c: { uses: ["port:6"] },
  },
  ["a_start", "b_start", "c_start", "a_end", "b_end", "c_end"],
);
await test(
  {
    a: { uses: ["port:4"] },
    b: { uses: ["port:4"] },
    c: { uses: ["port:5"] },
  },
  ["a_start", "c_start", "a_end", "b_start", "c_end", "b_end"],
);
