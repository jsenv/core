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

  // test("1_effect", () => {
  //   const state = sigi({
  //     a: 1,
  //   });

  //   const values = [state.a];

  //   values.push(`start: ${state.a}`);
  //   // effect(() => {
  //   //   values.push(`effect: ${state.a}`);
  //   // });
  //   state.a++;
  //   values.push(`after increment: ${state.a}`);

  //   return values;
  // });
});
