import { installPackagesIfMissing } from "./package_installer.js";

export const runPreviewCommand = async (dist) => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/core", "open"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ startBuildServer }, openModule] = await Promise.all([
    import("@jsenv/core"),
    import("open"),
  ]);
  let buildDirectoryUrl;
  if (dist) {
    buildDirectoryUrl = new URL(dist, cwdUrl);
  } else {
    buildDirectoryUrl = new URL("./dist/", cwdUrl);
  }
  const buildServer = await startBuildServer({
    buildDirectoryUrl,
    port: 4567,
  });
  openModule.default(`${buildServer.origin}`);
};
