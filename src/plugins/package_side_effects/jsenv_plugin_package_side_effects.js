import { lookupPackageDirectory } from "@jsenv/filesystem";
import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js";
import { URL_META } from "@jsenv/url-meta";
import { readFileSync } from "node:fs";

export const jsenvPluginPackageSideEffects = () => {
  const packageSideEffectsCacheMap = new Map();
  const readSideEffectInfoFromClosestPackage = (url) => {
    const packageDirectoryUrl = lookupPackageDirectory(url);
    if (!packageDirectoryUrl) {
      return undefined;
    }
    const fromCache = packageSideEffectsCacheMap.get(packageDirectoryUrl);
    if (fromCache) {
      return fromCache.value;
    }
    try {
      const packageFileContent = readFileSync(
        new URL("./package.json", packageDirectoryUrl),
        "utf8",
      );
      const packageJSON = JSON.parse(packageFileContent);
      return storePackageSideEffect(packageDirectoryUrl, packageJSON);
    } catch {
      return storePackageSideEffect(packageDirectoryUrl, null);
    }
  };
  const storePackageSideEffect = (packageDirectoryUrl, packageJson) => {
    if (!packageJson) {
      packageSideEffectsCacheMap.set(packageDirectoryUrl, { value: undefined });
      return undefined;
    }
    const value = packageJson.sideEffects;
    if (Array.isArray(value)) {
      const noSideEffect = {
        has: false,
        reason: "not listed in package.json side effects",
        packageDirectoryUrl,
      };
      const hasSideEffect = {
        has: true,
        reason: "listed in package.json side effects",
        packageDirectoryUrl,
      };
      const sideEffectPatterns = {};
      for (const v of value) {
        sideEffectPatterns[v] = true;
      }
      const associations = URL_META.resolveAssociations(
        { sideEffects: sideEffectPatterns },
        packageDirectoryUrl,
      );
      const getSideEffectInfo = (url) => {
        const meta = URL_META.applyAssociations({ url, associations });
        if (meta.sideEffects) {
          return hasSideEffect;
        }
        return noSideEffect;
      };
      packageSideEffectsCacheMap.set(packageDirectoryUrl, {
        value: getSideEffectInfo,
      });
      return getSideEffectInfo;
    }
    if (value === false) {
      const noSideEffect = {
        has: false,
        reason: "package.json side effects is false",
        packageDirectoryUrl,
      };
      packageSideEffectsCacheMap.set(packageDirectoryUrl, {
        value: noSideEffect,
      });
      return noSideEffect;
    }
    const hasSideEffect = {
      has: true,
      reason: "package.json side effects is true",
      packageDirectoryUrl,
    };
    packageSideEffectsCacheMap.set(packageDirectoryUrl, {
      value: hasSideEffect,
    });
    return hasSideEffect;
  };
  const getSideEffectInfoFromClosestPackage = (url) => {
    const sideEffectInfoFromClosestPackage =
      readSideEffectInfoFromClosestPackage(url);
    if (sideEffectInfoFromClosestPackage === undefined) {
      return null;
    }
    if (typeof sideEffectInfoFromClosestPackage === "function") {
      return sideEffectInfoFromClosestPackage(url);
    }
    return sideEffectInfoFromClosestPackage;
  };

  return {
    name: "jsenv:package_side_effects",
    appliesDuring: "build",
    redirectReference: (reference) => {
      const url = reference.url;

      if (isSpecifierForNodeBuiltin(url)) {
        reference.addEffect((urlInfo) => {
          urlInfo.contentSideEffects.push({
            sideEffect: "no",
            reason: "node builtin module",
          });
        });
        return;
      }
      if (url.startsWith("file:")) {
        const sideEffectFromClosestPackage =
          getSideEffectInfoFromClosestPackage(url);
        if (sideEffectFromClosestPackage) {
          // if (sideEffectFromClosestPackage.has) {
          //    console.log(`have side effect: ${url}`);
          // } else {
          //  console.log(`no side effect: ${url}`);
          // }

          // TODO: reference.addEffect does not exists yet
          reference.addEffect((urlInfo) => {
            urlInfo.contentSideEffects.push(sideEffectFromClosestPackage);
          });
        }
        return;
      }
    },
  };
};
