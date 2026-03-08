import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { actionRunEffect } from "./action_run_effect.js";
import { createAction } from "./actions.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await snapshotTests(import.meta.url, ({ test }) => {
  test("runs action when params signal becomes truthy", () => {
    const paramsSignal = signal(null);
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params });
    });

    actionRunEffect(action, () => paramsSignal.value);
    const runCountWithNullParams = runLog.length;

    paramsSignal.value = { query: "hello" };
    const runCountAfterTruthyParams = runLog.length;

    return { runCountWithNullParams, runCountAfterTruthyParams };
  });

  test("reruns action when params change", async () => {
    const paramsSignal = signal({ query: "a" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params: { ...params } });
    });

    actionRunEffect(action, () => paramsSignal.value);
    await sleep(10); // let first run complete

    paramsSignal.value = { query: "b" };
    await sleep(10);

    return { runLog };
  });

  test("debounce: action is not run until params settle", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "a" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params: { ...params } });
    });

    actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });
    // Initial run fires after the debounce delay
    const runCountImmediately = runLog.length;

    // Rapid changes — only the last should be picked up
    paramsSignal.value = { query: "b" };
    paramsSignal.value = { query: "c" };
    paramsSignal.value = { query: "d" };
    const runCountBeforeDelay = runLog.length;

    await sleep(debounceDelay + 20);
    const runCountAfterDelay = runLog.length;
    const lastRunParams = runLog[runLog.length - 1]?.params;

    return {
      runCountImmediately,
      runCountBeforeDelay,
      runCountAfterDelay,
      lastRunParams,
    };
  });

  test("debounce: explicit rerun flushes params and runs once (no double-run)", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "a" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params: { ...params } });
    });

    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Change params but don't wait for debounce to settle
    paramsSignal.value = { query: "b" };
    const runCountBeforeExplicitRun = runLog.length;

    // Explicitly rerun — should flush latest params ("b") and run exactly once
    effectAction.rerun();
    const runCountImmediatelyAfterRerun = runLog.length;

    // Wait to confirm debounce timeout does NOT fire another run
    await sleep(debounceDelay + 20);
    const runCountAfterWait = runLog.length;
    const lastRunParams = runLog[runLog.length - 1]?.params;

    return {
      runCountBeforeExplicitRun,
      runCountImmediatelyAfterRerun,
      runCountAfterWait,
      lastRunParams,
    };
  });

  test("debounce: explicit rerun uses latest params, not stale ones", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "initial" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params: { ...params } });
    });

    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Mutate params without waiting for debounce
    paramsSignal.value = { query: "latest" };

    // Explicit rerun must use "latest", not "initial"
    effectAction.rerun();
    const runParamsUsed =
      runLog.length > 0 ? runLog[runLog.length - 1].params : null;

    return { runParamsUsed };
  });

  test("no auto-run when explicit reset is called while params change", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "a" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params: { ...params } });
    });

    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Change params (still debouncing)
    paramsSignal.value = { query: "b" };

    // Explicit reset — params flush to "b" but onChange should NOT auto-run
    effectAction.reset();

    await sleep(debounceDelay + 20);
    const runCountAfterWait = runLog.length;

    return { runCountAfterWait };
  });
});
