import { snapshotTests } from "@jsenv/snapshot";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  await snapshotTests(testFileUrl, fnRegisteringTest, {
    sideEffectFilePattern: "./output/[test_name].md",
    outFilePattern: "./output/[test_name]/[test_scenario]_[filename]",
    errorStackHidden: true,
    ...options,
  });
};
