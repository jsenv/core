import { sigi } from "@jsenv/sigi";
import { snapshotTests } from "@jsenv/snapshot";
import { effect, signal } from "@preact/signals";

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

  test("2_renaming_into_array", () => {
    const state = signal([{ name: "a" }, { name: "b" }]);
    const currentItemSignal = signal({ name: "a" });
    const values = [];
    effect(() => {
      const currentItem = currentItemSignal.value;
      for (const item of state) {
        if (item.name === currentItem.name) {
          const prev = sigi.prev(item);
          // eslint-disable-next-line signals/no-conditional-value-read
          const prevName = prev.value.name;
          if (prevName.name !== item.name) {
            values.push(`renamed from: ${prevName.name}, to: ${item.name}`);
          }
        }
      }
    });
    state[0].name = "a_renamed";
    return values;
  });
});
