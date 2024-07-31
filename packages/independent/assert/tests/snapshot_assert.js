import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(testFileUrl, fnRegisteringTest, {
    snapshotFilePattern: "./<basename>/<basename>.md",
    errorStackHidden: true,
    ...options,
  });
};
