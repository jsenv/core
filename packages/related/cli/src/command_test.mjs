import { installPackagesIfMissing } from "./package_installer.js";

export const runTestCommand = async () => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/test"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ executeTestPlan }] = await Promise.all([import("@jsenv/test")]);
  await executeTestPlan({
    testPlan: {},
  });
};
