/**
 * Lorsqu'on bundle un package ayant pas le field sideEffects
 * alors on fini potentiellement par dire
 * sideEffect: false
 * sur le package racine alors qu'on en sait rien
 * on pourrait mettre un package.json dans dist dans ce cas
 * qui ne déclare pas le field side effect afin
 * d'override le package.json du project qui lui dit qu'il ny en a pas
 *
 * On part du principe pour le moment que c'est la respo du package racine de déclarer cela
 *
 */

import { updateJsonFileSync } from "@jsenv/filesystem";
import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js";
import { URL_META } from "@jsenv/url-meta";
import { urlToRelativeUrl } from "@jsenv/urls";
import { jsenvCoreDirectoryUrl } from "../../jsenv_core_directory_url.js";

export const jsenvPluginPackageSideEffects = ({
  rootDirectoryUrl,
  packageDirectory,
}) => {
  if (!packageDirectory.url) {
    return [];
  }
  const packageJson = packageDirectory.read(packageDirectory.url);
  if (!packageJson) {
    return [];
  }
  const { sideEffects } = packageJson;
  if (sideEffects !== false && !Array.isArray(sideEffects)) {
    return [];
  }

  const sideEffectFileUrlSet = new Set();
  const packageJsonFileUrl = new URL("./package.json", packageDirectory.url)
    .href;
  const shouldUpdatePackageJSON =
    import.meta.build ||
    // only when building @jsenv/core itself (not when running tests or building @jsenv/core/packages/*)
    rootDirectoryUrl === String(jsenvCoreDirectoryUrl);

  const normalizeSideEffectFileUrl = (url) => {
    const urlRelativeToPackage = urlToRelativeUrl(url, packageDirectory.url);
    return urlRelativeToPackage[0] === "."
      ? urlRelativeToPackage
      : `./${urlRelativeToPackage}`;
  };

  const sideEffectBuildFileUrls = [];

  const packageSideEffectsCacheMap = new Map();
  const readSideEffectInfoFromClosestPackage = (urlInfo) => {
    const closestPackageDirectoryUrl = urlInfo.packageDirectoryUrl;
    const closestPackageJSON = urlInfo.packageJSON;
    if (!closestPackageJSON) {
      return undefined;
    }
    const fromCache = packageSideEffectsCacheMap.get(
      closestPackageDirectoryUrl,
    );
    if (fromCache) {
      return fromCache.value;
    }
    try {
      return storePackageSideEffect(
        closestPackageDirectoryUrl,
        closestPackageJSON,
      );
    } catch {
      return storePackageSideEffect(closestPackageDirectoryUrl, null);
    }
  };
  const storePackageSideEffect = (packageDirectoryUrl, packageJSON) => {
    if (!packageJSON) {
      packageSideEffectsCacheMap.set(packageDirectoryUrl, { value: undefined });
      return undefined;
    }
    const value = packageJSON.sideEffects;
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
        sideEffectPatterns[v] = v;
      }
      const associations = URL_META.resolveAssociations(
        { sideEffects: sideEffectPatterns },
        packageDirectoryUrl,
      );
      const getSideEffectInfo = (urlInfo) => {
        const meta = URL_META.applyAssociations({
          url: urlInfo.url,
          associations,
        });
        const sideEffectKey = meta.sideEffects;
        if (sideEffectKey) {
          return {
            ...hasSideEffect,
            reason: `"${sideEffectKey}" listed in package.json side effects`,
          };
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
  const getSideEffectInfoFromClosestPackage = (urlInfo) => {
    const sideEffectInfoFromClosestPackage =
      readSideEffectInfoFromClosestPackage(urlInfo);
    if (sideEffectInfoFromClosestPackage === undefined) {
      return null;
    }
    if (typeof sideEffectInfoFromClosestPackage === "function") {
      return sideEffectInfoFromClosestPackage(urlInfo);
    }
    return sideEffectInfoFromClosestPackage;
  };

  return {
    name: "jsenv:package_side_effects",
    appliesDuring: "build",
    urlInfoCreated: (urlInfo) => {
      const url = urlInfo.url;
      if (isSpecifierForNodeBuiltin(url)) {
        urlInfo.contentSideEffects.push({
          sideEffect: "no",
          reason: "node builtin module",
        });
        return;
      }
      if (url.startsWith("file:")) {
        const sideEffectFromClosestPackage =
          getSideEffectInfoFromClosestPackage(urlInfo);
        if (sideEffectFromClosestPackage) {
          // if (sideEffectFromClosestPackage.has) {
          //    console.log(`have side effect: ${url}`);
          // } else {
          //  console.log(`no side effect: ${url}`);
          // }
          urlInfo.contentSideEffects.push(sideEffectFromClosestPackage);
        }
        return;
      }
    },
    refineBuildUrlContent: (buildUrlInfo, { buildUrl }) => {
      for (const sideEffect of buildUrlInfo.contentSideEffects) {
        if (sideEffect.has) {
          sideEffectBuildFileUrls.push(buildUrl);
          return;
        }
      }
    },
    refineBuild: () => {
      if (!shouldUpdatePackageJSON) {
        return;
      }
      if (sideEffectBuildFileUrls.length === 0) {
        return;
      }
      let sideEffectsToAdd = [];
      if (sideEffects === false) {
        sideEffectsToAdd = sideEffectBuildFileUrls;
      } else if (Array.isArray(sideEffects)) {
        for (const sideEffectFileRelativeUrl of sideEffects) {
          const sideEffectFileUrl = new URL(
            sideEffectFileRelativeUrl,
            packageDirectory.url,
          ).href;
          sideEffectFileUrlSet.add(sideEffectFileUrl);
        }
        for (const url of sideEffectBuildFileUrls) {
          if (sideEffectFileUrlSet.has(url)) {
            continue;
          }
          sideEffectsToAdd.push(url);
        }
      }
      if (sideEffectsToAdd.length === 0) {
        return;
      }

      const finalSideEffects = Array.isArray(sideEffects) ? sideEffects : [];
      for (const sideEffectBuildUrl of sideEffectBuildFileUrls) {
        finalSideEffects.push(normalizeSideEffectFileUrl(sideEffectBuildUrl));
      }
      updateJsonFileSync(packageJsonFileUrl, {
        sideEffects: finalSideEffects,
      });
    },
  };
};
