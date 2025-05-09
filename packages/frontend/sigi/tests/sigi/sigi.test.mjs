import { sigi } from "@jsenv/sigi";
import { effect } from "@preact/signals";
import { snapshotTests } from "@jsenv/snapshot";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_get_set_get", () => {
    const state = sigi({
      a: 1,
    });

    const values = [];
    values.push(`get: ${state.a}`);
    state.a++;
    values.push(`get after increment: ${state.a}`);

    return values;
  });

  test("1_effect", async () => {
    const state = sigi({
      a: 1,
    });
    const values = [];
    effect(() => {
      values.push(`effect: ${state.a}`);
    });
    state.a++;
    await new Promise((resolve) => setTimeout(resolve, 10));

    return values;
  });
});
