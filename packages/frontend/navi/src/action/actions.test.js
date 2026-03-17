/* eslint-disable signals/no-value-after-await */

import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { createAction } from "./actions.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("outputSignal is updated when action completes", async () => {
    const userSignal = signal(null);
    const action = createAction(
      async () => {
        return { id: 1, name: "Alice" };
      },
      { outputSignal: userSignal },
    );

    const before = userSignal.value;
    await action.run();
    const after = userSignal.value;

    return { before, after };
  });

  test("outputSignal is reset to null when action is reset", async () => {
    const userSignal = signal(null);
    const action = createAction(
      async () => {
        return { id: 1, name: "Alice" };
      },
      { outputSignal: userSignal },
    );

    await action.run();
    const afterRun = userSignal.value;
    await action.reset();
    const afterReset = userSignal.value;

    return { afterRun, afterReset };
  });

  test("outputSignal is updated by child action created via bindParams", async () => {
    const userSignal = signal(null);
    const action = createAction(
      async ({ id }) => {
        return { id, name: "Alice" };
      },
      { outputSignal: userSignal },
    );

    const childAction = action.bindParams({ id: 42 });
    const before = userSignal.value;
    await childAction.run();
    const after = userSignal.value;

    return { before, after };
  });

  test("outputSignal reset also works on child action", async () => {
    const userSignal = signal(null);
    const action = createAction(
      async ({ id }) => {
        return { id, name: "Bob" };
      },
      { outputSignal: userSignal },
    );

    const childAction = action.bindParams({ id: 7 });
    await childAction.run();
    const afterRun = userSignal.value;
    await childAction.reset();
    const afterReset = userSignal.value;

    return { afterRun, afterReset };
  });

  test("outputSignal on child action can be overridden via bindParams", async () => {
    const parentSignal = signal(null);
    const childSignal = signal(null);

    const action = createAction(
      async ({ id }) => {
        return { id };
      },
      { outputSignal: parentSignal },
    );

    const childAction = action.bindParams(
      { id: 99 },
      { outputSignal: childSignal },
    );

    await childAction.run();

    return {
      parentSignal: parentSignal.value,
      childSignal: childSignal.value,
    };
  });
});
