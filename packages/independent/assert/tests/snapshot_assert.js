import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(testFileUrl, fnRegisteringTest, {
    executionEffects: {
      catch: (e) => {
        if (e.constructor?.name === "AssertionError") {
          e.stack = "";
          return;
        }
        throw e;
      },
    },
    logEffects: false,
    ...options,
  });
};
