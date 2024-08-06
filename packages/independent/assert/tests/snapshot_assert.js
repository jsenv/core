import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(testFileUrl, fnRegisteringTest, {
    errorTransform: (e) => {
      if (e.constructor?.name === "AssertionError") {
        e.stack = "";
      }
    },
    ...options,
  });
};
