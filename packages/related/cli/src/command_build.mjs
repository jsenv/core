import { existsSync } from "node:fs";

import { installPackagesIfMissing } from "./package_installer.js";

export const runBuildCommand = async (src, dist) => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/core"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ build }] = await Promise.all([import("@jsenv/core")]);
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
  let buildDirectoryUrl;
  if (dist) {
    buildDirectoryUrl = new URL(dist, cwdUrl);
  } else {
    buildDirectoryUrl = new URL("./dist/", cwdUrl);
  }
  await build({
    sourceDirectoryUrl,
    buildDirectoryUrl,
  });
};
