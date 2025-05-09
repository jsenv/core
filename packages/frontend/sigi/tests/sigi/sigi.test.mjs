import { sigi } from "@jsenv/sigi";
// import { effect } from "@preact/signals";
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

  test("0_array_of_objects", () => {
    const state = sigi([]);
    const values = [];
    values.push(`start: ${state}`);
    state.push({
      name: "a",
    });
    state.push({
      name: "b",
    });

    values.push(`get: ${state.a[0].b}`);
    state.a[0].b++;
    values.push(`get after increment: ${state.a[0].b}`);

    return values;
  });
});
