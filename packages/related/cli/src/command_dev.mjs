import { existsSync } from "node:fs";

import { installPackagesIfMissing } from "./package_installer.js";

export const runDevCommand = async (
  src,
  { open, keepProcessAlive = true } = {},
) => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/core", "open"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ startDevServer }, openModule] = await Promise.all([
    import("@jsenv/core"),
    import("open"),
  ]);
  let sourceDirectoryUrl;

  if (src) {
    sourceDirectoryUrl = new URL(src, cwdUrl);
  } else {
    const defaultSourceDirectoryUrl = new URL("./src/", cwdUrl);
    if (existsSync(defaultSourceDirectoryUrl)) {
      sourceDirectoryUrl = defaultSourceDirectoryUrl;
    } else {
      sourceDirectoryUrl = cwdUrl;
    }
  }
  const devServer = await startDevServer({
    sourceDirectoryUrl,
    port: 3456,
    keepProcessAlive,
  });
  if (open) {
    openModule.open(`${devServer.origin}`);
  }
  return devServer;
};
