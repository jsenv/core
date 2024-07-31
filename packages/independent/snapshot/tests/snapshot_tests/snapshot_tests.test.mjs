import { clearDirectorySync } from "@jsenv/filesystem";
import { snapshotSideEffects, snapshotTests } from "@jsenv/snapshot";

clearDirectorySync(new URL("./output/", import.meta.url));

await snapshotTests(
  import.meta.url,
  ({ test }) => {
    test("something", () => {
      console.log("hello");
    });
  },
  {
    sideEffectFileUrl: "./output/0_log_hello.md",
  },
);

{
  await snapshotTests(
    import.meta.url,
    ({ test }) => {
      test("something", () => {
        console.log("hello");
      });
    },
    {
      sideEffectFileUrl: "./output/1_log_hello.md",
    },
  );
  await snapshotSideEffects(
    import.meta.url,
    async () => {
      await snapshotTests(
        import.meta.url,
        ({ test }) => {
          test("something", () => {
            console.log("bonjour");
          });
        },
        {
          sideEffectFileUrl: "./output/1_log_hello.md",
          throwWhenDiff: true,
        },
      );
    },
    {
      sideEffectFileUrl: "./output/2_log_hello_result.md",
      filesystemEffects: false,
      errorStackHidden: true,
    },
  );
}
