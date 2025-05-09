import { sigi } from "@jsenv/sigi";
import { effect } from "@preact/signals";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    const state = sigi({
      a: 1,
    });

    const values = [state.a];

    values.push(`start: ${state.a}`);
    effect(() => {
      values.push(`effect: ${state.a}`);
    });
    state.a++;
    values.push(`after increment: ${state.a}`);

    return values;
  });
});
