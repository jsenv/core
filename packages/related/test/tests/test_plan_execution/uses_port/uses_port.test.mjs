import { executeTestPlan, inlineRuntime } from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

const run = async (inlineExec) => {
  const callOrder = [];
  const inlineExecutions = {};
  for (const key of Object.keys(inlineExec)) {
    const desc = inlineExec[key];
    inlineExecutions[key] = {
      uses: desc.uses,
      runtime: inlineRuntime(async () => {
        callOrder.push(`${key}_start`);
        await new Promise((resolve) => setTimeout(resolve, 800));
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
  return callOrder;
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    run({
      a: { uses: ["port:4"] },
      b: { uses: ["port:5"] },
      c: { uses: ["port:6"] },
    }));

  test("0_second", () =>
    run({
      a: { uses: ["port:4"] },
      b: { uses: ["port:4"] },
      c: { uses: ["port:5"] },
    }));
});
