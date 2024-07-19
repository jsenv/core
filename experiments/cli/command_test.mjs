import { existsSync } from "node:fs";
import { installPackagesIfMissing } from "./package_installer.js";
import { runDevCommand } from "./command_dev.mjs";

export const runTestCommand = async () => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/test"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ executeTestPlan, nodeWorkerThread, chromium }] = await Promise.all([
    import("@jsenv/test"),
  ]);
  let sourceDirectoryUrl;
  const defaultSourceDirectoryUrl = new URL("./src/", cwdUrl);
  if (existsSync(defaultSourceDirectoryUrl)) {
    sourceDirectoryUrl = defaultSourceDirectoryUrl;
  } else {
    sourceDirectoryUrl = cwdUrl;
  }

  await executeTestPlan({
    rootDirectoryUrl: cwdUrl,
    testPlan: {
      [sourceDirectoryUrl === cwdUrl
        ? "./**/*.test.html"
        : "./src/**/*.test.html"]: {
        chromium: {
          runtime: chromium(),
        },
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
      "./packages/": null,
    },
    webServer: {
      start: async () => {
        await installPackagesIfMissing(
          ["@playwright/browser-chromium"],
          cwdUrl,
        );
        const devServer = await runDevCommand(sourceDirectoryUrl, {
          keepProcessAlive: false,
          logLevel: "warn",
        });
        return {
          origin: devServer.origin,
          rootDirectoryUrl: sourceDirectoryUrl,
        };
      },
    },
  });
};
