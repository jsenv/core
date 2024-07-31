import { snapshotSideEffects, snapshotTests } from "@jsenv/snapshot";

await snapshotTests(
  ({ test }) => {
    test("something", () => {
      console.log("hello");
    });
  },
  new URL("./output/0_log_hello.md", import.meta.url),
);

{
  await snapshotTests(
    ({ test }) => {
      test("something", () => {
        console.log("hello");
      });
    },
    new URL("./output/1_log_throw.md", import.meta.url),
  );
  await snapshotSideEffects(
    async () => {
      await snapshotTests(
        ({ test }) => {
          test("something", () => {
            console.log("bonjour");
          });
        },
        new URL("./output/1_log_throw.md", import.meta.url),
        {
          throwWhenDiff: true,
        },
      );
    },
    new URL("./output/1_log_throw_result.md", import.meta.url),
    {
      filesystemEffects: false,
      errorStackHidden: true,
    },
  );
}
