import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { actionRunEffect } from "./action_run_effect.js";
import { createAction } from "./actions.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await snapshotTests(import.meta.url, ({ test }) => {
  test("runs action when params signal becomes truthy", () => {
    const paramsSignal = signal(null);
    const runCalls = [];
    const action = createAction(async (params) => {
      runCalls.push({ params });
    });
    actionRunEffect(action, () => paramsSignal.value);

    const runCountWithNullParams = runCalls.length;
    paramsSignal.value = { query: "hello" };
    const runCountAfterTruthyParams = runCalls.length;

    return { runCountWithNullParams, runCountAfterTruthyParams };
  });

  test("reruns action when params change", async () => {
    const paramsSignal = signal({ query: "a" });
    const runCalls = [];
    const action = createAction(async (params) => {
      runCalls.push({ params });
    });
    actionRunEffect(action, () => paramsSignal.value);

    await sleep(10); // let first run complete
    paramsSignal.value = { query: "b" };
    await sleep(10);

    return { runCalls };
  });

  test("debounce: action is not run until params settle", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "a" });
    const runLog = [];
    const action = createAction(async (params) => {
      runLog.push({ params });
    });
    actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Initial run fires after the debounce delay
    const runCountImmediately = runLog.length;
    // Rapid changes — only the last should be picked up
    paramsSignal.value = { query: "b" };
    await sleep(10);
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
    const runCalls = [];
    const action = createAction(async (params) => {
      runCalls.push({ params });
    });
    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Change params but don't wait for debounce to settle
    paramsSignal.value = { query: "b" };
    const runCountBeforeExplicitRun = runCalls.length;
    // Explicitly rerun — should flush latest params ("b") and run exactly once
    effectAction();
    const runCountImmediatelyAfterRerun = runCalls.length;
    // Wait to confirm debounce timeout does NOT fire another run
    await sleep(debounceDelay + 20);
    const runCountAfterWait = runCalls.length;
    const lastRunParams = runCalls[runCalls.length - 1].params;

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
    const runCalls = [];
    const action = createAction(async (params) => {
      runCalls.push({ params });
    });
    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Mutate params without waiting for debounce
    paramsSignal.value = { query: "latest" };
    // Explicit rerun must use "latest", not "initial"
    effectAction();
    const runParamsUsed =
      runCalls.length > 0 ? runCalls[runCalls.length - 1].params : null;

    return { runParamsUsed };
  });

  test("no auto-run when explicit reset is called while params change", async () => {
    const debounceDelay = 50;
    const paramsSignal = signal({ query: "a" });
    const runCalls = [];
    const action = createAction(async (params) => {
      runCalls.push({ params });
    });
    const effectAction = actionRunEffect(action, () => paramsSignal.value, {
      debounce: debounceDelay,
    });

    // Change params (still debouncing)
    paramsSignal.value = { query: "b" };
    // Explicit reset — params flush to "b" but onChange should NOT auto-run
    effectAction.reset();
    await sleep(debounceDelay + 20);
    const runCountAfterWait = runCalls.length;

    return { runCountAfterWait };
  });

  test("effect returning true: run count across false→true→false→true transitions", () => {
    const enabledSignal = signal(false);
    const runCalls = [];
    const action = createAction(() => {
      runCalls.push("run");
    });
    actionRunEffect(action, () => enabledSignal.value);

    const countAfterFalse = runCalls.length;
    enabledSignal.value = true;
    const countAfterFirstTrue = runCalls.length;
    enabledSignal.value = false;
    const countAfterSecondFalse = runCalls.length;
    enabledSignal.value = true;
    const countAfterSecondTrue = runCalls.length;

    return {
      countAfterFalse,
      countAfterFirstTrue,
      countAfterSecondFalse,
      countAfterSecondTrue,
    };
  });

  test("effect returning {t: Date.now()}: reruns on every false→true transition", () => {
    const enabledSignal = signal(false);
    const runCalls = [];
    const action = createAction((params) => {
      runCalls.push(params);
    });
    actionRunEffect(action, () =>
      enabledSignal.value ? { t: performance.now() } : false,
    );

    const countAfterFalse = runCalls.length;
    enabledSignal.value = true;
    const countAfterFirstTrue = runCalls.length;
    enabledSignal.value = false;
    const countAfterSecondFalse = runCalls.length;
    enabledSignal.value = true;
    const countAfterSecondTrue = runCalls.length;

    return {
      countAfterFalse,
      countAfterFirstTrue,
      countAfterSecondFalse,
      countAfterSecondTrue,
    };
  });

  test("action with initial params", () => {
    const paramsSignal = signal();
    const runCalls = [];
    const action = createAction(
      (p) => {
        runCalls.push(p);
      },
      { params: { foo: true } },
    );
    actionRunEffect(action, () => paramsSignal.value);
    paramsSignal.value = { bar: true };

    return runCalls;
  });

  test("returning empty object", () => {
    const paramsSignal = signal();
    const runCalls = [];
    const action = createAction((p) => {
      runCalls.push(p);
    });
    actionRunEffect(action, () => paramsSignal.value);
    paramsSignal.value = {};

    return runCalls;
  });

  /* eslint-disable signals/no-value-after-await */
  test("outputSignal lifecycle with actionRunEffect and userIdSignal", async () => {
    const userIdSignal = signal(undefined);
    const userSignal = signal(null);
    const fetchUserAction = createAction(
      async ({ userId }) => {
        await new Promise((r) => setTimeout(r, 10));
        return { id: userId, name: `User ${userId}` };
      },
      { outputSignal: userSignal },
    );
    actionRunEffect(fetchUserAction, () => {
      const userId = userIdSignal.value;
      if (!userId) {
        return null;
      }
      return { userId };
    });

    // 1. userIdSignal is initially undefined — action never ran
    const whenUserIdUndefined = userSignal.value;
    // 2. Set userId — action starts loading
    userIdSignal.value = 1;
    const afterSettingUserId = userSignal.value;
    await new Promise((r) => setTimeout(r, 100)); // wait for action to complete
    const onceLoaded = userSignal.value;

    // 4. Update userId to a new value — new fetch starts, old data still in signal
    userIdSignal.value = 2;
    const afterUpdatingUserId = userSignal.value;
    await new Promise((r) => setTimeout(r, 100)); // wait for action to complete
    const onceSecondUserLoaded = userSignal.value;

    // 5. Set userId back to undefined — action resets, signal cleared
    userIdSignal.value = undefined;
    const afterUserIdCleared = userSignal.value;

    return {
      whenUserIdUndefined,
      afterSettingUserId,
      onceLoaded,
      afterUpdatingUserId,
      onceSecondUserLoaded,
      afterUserIdCleared,
    };
  });
  /* eslint-enable signals/no-value-after-await */
});
