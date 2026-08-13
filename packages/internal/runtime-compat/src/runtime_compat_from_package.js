import { lookupPackageDirectory, readPackageAtOrNull } from "@jsenv/filesystem";
import { browserDefaultRuntimeCompat } from "./browser_default_runtime_compat.js";

export const inferRuntimeCompatFromClosestPackage = async (
  sourceUrl,
  { runtimeType },
) => {
  const packageDirectoryUrl = lookupPackageDirectory(sourceUrl);
  if (!packageDirectoryUrl) {
    return null;
  }
  const packageJSON = readPackageAtOrNull(packageDirectoryUrl);
  if (!packageJSON) {
    return null;
  }

  if (runtimeType === "browser") {
    const browserslistQuery = packageJSON.browserslist;
    if (!browserslistQuery) {
      return null;
    }
    const namespace = await import("browserslist");
    const browserslist = namespace.default;
    const browserslistResult = browserslist(browserslistQuery);
    const runtimeCompat = {};
    for (const browserNameAndVersion of browserslistResult) {
      let [name, version] = browserNameAndVersion.split(" ");
      if (name === "ios_saf") {
        name = "ios_safari";
      }
      if (Object.keys(browserDefaultRuntimeCompat).includes(name)) {
        runtimeCompat[name] = version;
      }
    }
    return runtimeCompat;
  }

  const engines = packageJSON.engines;
  if (!engines) {
    return null;
  }
  const node = engines.node;
  const versionMatch = node.match(/[0-9*.]+/);
  if (!versionMatch) {
    return null;
  }
  return {
    node: versionMatch[0],
  };
};
