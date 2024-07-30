import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  fnRegisteringTest,
  snapshotFileUrl,
  options,
) => {
  await snapshotTests(fnRegisteringTest, snapshotFileUrl, options);
};
