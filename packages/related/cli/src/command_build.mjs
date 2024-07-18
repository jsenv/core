import { existsSync, readFileSync } from "node:fs";

import { urlToRelativeUrl } from "@jsenv/urls";
import { installPackagesIfMissing } from "./package_installer.js";

export const runBuildCommand = async (src, dist) => {
  const cwdUrl = new URL(`${process.cwd()}/`, import.meta.url);
  const packagesRequired = ["@jsenv/core"];
  await installPackagesIfMissing(packagesRequired, cwdUrl);
  const [{ build }] = await Promise.all([import("@jsenv/core")]);
  const packageJson = readPackageJson(cwdUrl);
  if (packageJson?.environment === "browser") {
    const browserParams = getBuildParamsToBuildForBrowser({
      cwdUrl,
      src,
      dist,
      packageJson,
    });
    if (!browserParams) {
      throw new Error("cannot find entry point to build");
    }
    await build(browserParams);
    return;
  }
  if (packageJson?.environment === "node") {
    const nodeParams = getBuildParamsToBuildForNode({
      cwdUrl,
      src,
      dist,
      packageJson,
    });
    if (!nodeParams) {
      throw new Error("cannot find entry point to build");
    }
    await build(nodeParams);
    return;
  }
  const browserParams = getBuildParamsToBuildForBrowser({
    cwdUrl,
    src,
    dist,
    packageJson,
  });
  const nodeParams = getBuildParamsToBuildForNode(
    {
      cwdUrl,
      src,
      dist,
      packageJson,
    },
    {
      hasBrowserEntryPoint: Boolean(browserParams),
    },
  );
  if (!browserParams && !nodeParams) {
    throw new Error("found nothing to build");
  }
  if (browserParams) {
    await build(browserParams);
  }
  if (nodeParams) {
    await build(nodeParams);
  }
};

const getBuildParamsToBuildForBrowser = ({ cwdUrl, src, dist }) => {
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

  // search for html file in source directory
  if (existsSync(new URL("./index.html", sourceDirectoryUrl))) {
    return {
      sourceDirectoryUrl,
      buildDirectoryUrl,
      entryPoints: {
        "./index.html": "./index.html",
      },
      bundling: {
        js_module: {
          chunks: {
            vendors: { "file:///**/node_modules/": true },
          },
        },
      },
    };
  }
  if (existsSync(new URL("./main.html", sourceDirectoryUrl))) {
    return {
      sourceDirectoryUrl,
      buildDirectoryUrl,
      entryPoints: {
        "./index.html": "./index.html",
      },
      bundling: {
        js_module: {
          chunks: {
            vendors: { "file:///**/node_modules/": true },
          },
        },
      },
    };
  }
  return null;
};

const getBuildParamsToBuildForNode = (
  { cwdUrl, src, dist, packageJson },
  { hasBrowserEntryPoint } = {},
) => {
  let sourceDirectoryUrl;
  if (src) {
    sourceDirectoryUrl = new URL(src, cwdUrl);
  }
  let buildDirectoryUrl;
  if (dist) {
    buildDirectoryUrl = new URL(dist, cwdUrl);
  } else {
    buildDirectoryUrl = new URL("./dist/", cwdUrl);
  }
  if (packageJson?.main) {
    const { main } = packageJson;
    if (main.endsWith(".html")) {
      return null;
    }
    const mainFileUrl = new URL(packageJson.main, cwdUrl);
    const mainFileRelativeUrl = urlToRelativeUrl(
      mainFileUrl,
      sourceDirectoryUrl,
    );
    return {
      sourceDirectoryUrl,
      buildDirectoryUrl,
      entryPoints: {
        [`./${mainFileRelativeUrl}`]: `./${mainFileRelativeUrl}`,
      },
      runtimeCompat: {
        node: process.version.slice(1),
      },
    };
  }
  if (hasBrowserEntryPoint) {
    return null;
  }
  const mainFileUrl = new URL("./main.js", sourceDirectoryUrl);
  if (existsSync(mainFileUrl)) {
    return {
      sourceDirectoryUrl,
      buildDirectoryUrl,
      entryPoints: {
        "./main.js": "./main.js",
      },
      runtimeCompat: {
        node: process.version.slice(1),
      },
    };
  }
  return null;
};

const readPackageJson = (directoryUrl) => {
  const packageJsonFileUrl = new URL("./package.json", directoryUrl);
  try {
    return JSON.parse(String(readFileSync(packageJsonFileUrl)));
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
};
