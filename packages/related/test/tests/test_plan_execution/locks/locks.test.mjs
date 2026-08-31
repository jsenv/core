import { executeTestPlan, inlineRuntime } from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

const run = async (inlineExec) => {
  const callOrder = [];
  const inlineExecutions = {};
  for (const key of Object.keys(inlineExec)) {
    const desc = inlineExec[key];
    inlineExecutions[key] = {
      locks: desc.locks,
      runtime: inlineRuntime(async () => {
        callOrder.push(`${key}_start`);
        await new Promise((resolve) => setTimeout(resolve, 500));
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
      "./locks.test.mjs": inlineExecutions,
    },
    parallel: {
      max: 4,
    },
    githubCheck: false,
  });
  return callOrder;
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("basic", () =>
    run({
      a: { locks: ["port:4"] },
      b: { locks: ["port:5"] },
      c: { locks: ["port:6"] },
    }));

  test("second", () =>
    run({
      a: { locks: ["port:4"] },
      b: { locks: ["port:4"] },
      c: { locks: ["port:5"] },
    }));
});
