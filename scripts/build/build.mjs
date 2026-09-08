/*
 * Build files
 * Usage:
 * npm run build              | Build only @jsenv/core
 * npm run build @jsenv/navi  | Build only @jsenv/navi
 * npm run build ./packages/  | Build every package inside ./packages/
 * npm run build packages     | Same as above
 * npm run build .            | Build everything (@jsenv/core + every package)
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDirectoryUrl = new URL("../../", import.meta.url);

const CORE_BUILD = {
  name: "@jsenv/core",
  url: rootDirectoryUrl,
  build: async () => {
    await import("./build_core.mjs");
  },
};

const readWorkspaceBuildArray = () => {
  const rootPackage = JSON.parse(
    readFileSync(new URL("./package.json", rootDirectoryUrl), "utf8"),
  );
  const workspaceBuildMap = new Map();
  for (const pattern of rootPackage.workspaces) {
    if (!pattern.endsWith("/*")) {
      throw new Error(`unsupported workspace pattern "${pattern}"`);
    }
    const parentDirectoryUrl = new URL(pattern.slice(0, -1), rootDirectoryUrl);
    let entryArray;
    try {
      entryArray = readdirSync(parentDirectoryUrl, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entryArray) {
      if (!entry.isDirectory() || entry.name[0] === ".") {
        continue;
      }
      const packageDirectoryUrl = new URL(`${entry.name}/`, parentDirectoryUrl);
      if (workspaceBuildMap.has(packageDirectoryUrl.href)) {
        continue;
      }
      let packageObject;
      try {
        packageObject = JSON.parse(
          readFileSync(new URL("./package.json", packageDirectoryUrl), "utf8"),
        );
      } catch {
        continue;
      }
      workspaceBuildMap.set(packageDirectoryUrl.href, {
        name: packageObject.name,
        url: packageDirectoryUrl,
        buildable: Boolean(packageObject.scripts?.build),
        build: async () => {
          const { status } = spawnSync(
            "npm",
            ["run", "build", "--if-present"],
            {
              cwd: fileURLToPath(packageDirectoryUrl),
              stdio: "inherit",
              shell: process.platform === "win32",
            },
          );
          if (status !== 0) {
            throw new Error(
              `build failed for ${packageObject.name} (exit code ${status})`,
            );
          }
        },
      });
    }
  }
  return Array.from(workspaceBuildMap.values());
};

const selectBuildArray = (arg) => {
  if (arg === undefined || arg === "@jsenv/core") {
    return [CORE_BUILD];
  }
  const workspaceBuildArray = readWorkspaceBuildArray();
  const workspaceBuildNamed = workspaceBuildArray.find(
    (workspaceBuild) => workspaceBuild.name === arg,
  );
  if (workspaceBuildNamed) {
    if (!workspaceBuildNamed.buildable) {
      throw new Error(`"${arg}" has no build script`);
    }
    return [workspaceBuildNamed];
  }
  if (arg[0] === "@") {
    throw new Error(`"${arg}" is not a package of this monorepo`);
  }
  let directoryUrl = new URL(arg, rootDirectoryUrl);
  if (!directoryUrl.href.endsWith("/")) {
    directoryUrl = new URL(`${directoryUrl.href}/`);
  }
  try {
    if (!statSync(directoryUrl).isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`"${arg}" is not a directory nor a package name`);
  }
  const buildArray = [];
  if (rootDirectoryUrl.href.startsWith(directoryUrl.href)) {
    buildArray.push(CORE_BUILD);
  }
  for (const workspaceBuild of workspaceBuildArray) {
    if (!workspaceBuild.buildable) {
      continue;
    }
    if (!workspaceBuild.url.href.startsWith(directoryUrl.href)) {
      continue;
    }
    buildArray.push(workspaceBuild);
  }
  if (buildArray.length === 0) {
    throw new Error(`no package to build inside "${arg}"`);
  }
  return buildArray;
};

const buildArray = selectBuildArray(process.argv[2]);
let index = 0;
for (const buildToRun of buildArray) {
  index++;
  if (buildArray.length > 1) {
    console.log(
      `\n--- building ${buildToRun.name} (${index}/${buildArray.length}) ---\n`,
    );
  }
  await buildToRun.build();
}
