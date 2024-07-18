import { installPackagesIfMissing } from "./package_installer.js";
import { runDevCommand } from "./command_dev.mjs";

export const runTestCommand = async () => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/test"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ executeTestPlan, nodeWorkerThread, chromium }] = await Promise.all([
    import("@jsenv/test"),
  ]);
  await executeTestPlan({
    rootDirectoryUrl: cwdUrl,
    testPlan: {
      "./**/*.test.html": {
        chromium: chromium(),
      },
      "./**/*.test.js": {
        node: {
          runtime: nodeWorkerThread(),
        },
      },
      "./**/*.test.mjs": {
        node: {
          runtime: nodeWorkerThread(),
        },
      },
    },
    webServer: {
      start: async () => {
        await installPackagesIfMissing(["playwright-chromium"], cwdUrl);
        const devServer = await runDevCommand(undefined, {
          keepProcessAlive: false,
        });
        return {
          origin: devServer.origin,
          rootDirectoryUrl: devServer.sourceDirectoryUrl,
        };
      },
    },
  });
};
