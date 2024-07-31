import { snapshotTests } from "@jsenv/snapshot";
import { urlToBasename } from "@jsenv/urls";

export const snapshotAssertTests = async (
  testFileUrl,
  fnRegisteringTest,
  options,
) => {
  const testFilebasename = urlToBasename(testFileUrl);
  let name = testFilebasename.slice(0, -".test".length);
  name = name.toLowerCase();
  const snapshotFileUrl = new URL(`./${name}/${name}.md`, testFileUrl).href;
  await snapshotTests(fnRegisteringTest, snapshotFileUrl, {
    sourceFileUrl: testFileUrl,
    errorStackHidden: true,
    ...options,
  });
};
