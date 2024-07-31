import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  sourceFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(sourceFileUrl, fnRegisteringTest, {
    snapshotFilePattern: "./<basename>/<basename>.md",
    errorStackHidden: true,
    ...options,
  });
};
