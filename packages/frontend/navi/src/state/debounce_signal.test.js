import { snapshotTests } from "@jsenv/snapshot";
import { effect, signal } from "@preact/signals";
import { debounceSignal } from "./debounce_signal.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await snapshotTests(import.meta.url, ({ test }) => {
  test("update is debounced", async () => {
    const delay = 50;
    const src = signal("a");
    const debounced = debounceSignal(src, { delay });

    const valueAtStart = debounced.value;
    src.value = "b";
    const valueImmediatelyAfter = debounced.value;
    await sleep(delay + 20);
    const valueAfterDelay = debounced.value;

    return { valueAtStart, valueImmediatelyAfter, valueAfterDelay };
  });

  test("rapid updates only apply the last value", async () => {
    const delay = 50;
    const src = signal("a");
    const debounced = debounceSignal(src, { delay });

    src.value = "b";
    src.value = "c";
    src.value = "d";
    const valueBefore = debounced.value;
    await sleep(delay + 20);
    const valueAfter = debounced.value;

    return { valueBefore, valueAfter };
  });

  test("deep equal objects do not trigger debounced signal update", async () => {
    const delay = 50;
    const src = signal({ x: 1 });
    const debounced = debounceSignal(src, { delay });

    // Wait for the initial debounce timeout to fire
    await sleep(delay + 20);

    let updateCount = 0;
    const dispose = effect(() => {
      // eslint-disable-next-line no-unused-expressions
      debounced.value; // subscribe
      updateCount++;
    });
    // effect fires immediately on subscription
    const countAfterSubscribe = updateCount;

    src.value = { x: 1 }; // deeply equal, different reference
    await sleep(delay + 20);
    const countAfterDeepEqual = updateCount;

    src.value = { x: 2 }; // genuinely different
    await sleep(delay + 20);
    const countAfterDifferent = updateCount;

    dispose();

    return { countAfterSubscribe, countAfterDeepEqual, countAfterDifferent };
  });
});
