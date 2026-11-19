/*
 * The document is busy while a routing or an action run started through it is
 * out, each one counted by its own end (step 06): two runs of the same verb
 * share a name, and the first one ending must not say the document idle while
 * the other is still out.
 */

import { snapshotTests } from "@jsenv/snapshot";

// The module reads the document's readiness when it loads.
globalThis.document ??= {
  readyState: "complete",
  addEventListener: () => {},
};
const { documentIsBusySignal, workingWhile } =
  await import("../browser_integration/document_loading_signal.js");

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("busy until the last run of a verb ends", async () => {
    const first = deferred();
    const second = deferred();
    const busy = [];
    busy.push(["before", documentIsBusySignal.value]);
    const firstRun = workingWhile(() => first.promise, ["games.GET"]);
    const secondRun = workingWhile(() => second.promise, ["games.GET"]);
    busy.push(["two runs out", documentIsBusySignal.value]);
    first.resolve();
    await firstRun;
    busy.push(["first ended", documentIsBusySignal.value]);
    second.resolve();
    await secondRun;
    busy.push(["second ended", documentIsBusySignal.value]);
    return busy;
  });

  test("a run without a name keeps nothing busy", async () => {
    const run = deferred();
    const running = workingWhile(() => run.promise);
    const while_running = documentIsBusySignal.value;
    run.resolve();
    await running;
    return { while_running };
  });
});
