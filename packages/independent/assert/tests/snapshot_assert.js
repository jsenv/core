import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(testFileUrl, fnRegisteringTest, {
    sideEffectFilePattern: "./output/<basename>.md",
    errorStackHidden: true,
    ...options,
  });
};
