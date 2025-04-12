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

import { lookupPackageDirectory, writeFileSync } from "@jsenv/filesystem";
import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js";
import { URL_META } from "@jsenv/url-meta";
import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { jsenvCoreDirectoryUrl } from "../../jsenv_core_directory_url.js";

export const jsenvPluginPackageSideEffects = ({ packageDirectory }) => {
  if (!packageDirectory.url) {
    return [];
  }
  if (
    urlIsInsideOf(packageDirectory.url, jsenvCoreDirectoryUrl) ||
    packageDirectory.url === String(jsenvCoreDirectoryUrl)
  ) {
    return [];
  }
  const packageJson = packageDirectory.read(packageDirectory.url);
  if (!packageJson) {
    return [];
  }
  const { sideEffects } = packageJson;
  if (
    sideEffects === true ||
    sideEffects === undefined ||
    !Array.isArray(sideEffects)
  ) {
    return [];
  }

  const sideEffectFileUrlSet = new Set();
  const packageJsonFileUrl = new URL("./package.json", packageDirectory.url)
    .href;

  const normalizeSideEffectFileUrl = (url) => {
    const urlRelativeToPackage = urlToRelativeUrl(url, packageDirectory.url);
    return urlRelativeToPackage[0] === "."
      ? urlRelativeToPackage
      : `./${urlRelativeToPackage}`;
  };

  const sideEffectBuildFileUrls = [];

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
    // ptet plutot transformReferenceSearchParams pour etre sur d'arriver a la fin
    // mais bon on let met de toute façon a la fin dans plugins.js
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
          reference.urlInfoEffectSet.add((urlInfo) => {
            urlInfo.contentSideEffects.push(sideEffectFromClosestPackage);
          });
        }
        return;
      }
    },
    refineBuildUrlContent: (buildUrlInfo) => {
      for (const sideEffect of buildUrlInfo.contentSideEffects) {
        if (sideEffect.has) {
          sideEffectBuildFileUrls.push(buildUrlInfo.url);
          return;
        }
      }
    },
    refineBuild: () => {
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
          sideEffectsToAdd.push(normalizeSideEffectFileUrl(url));
        }
      }
      if (sideEffectsToAdd.length === 0) {
        return;
      }
      packageJson.sideEffects = sideEffectBuildFileUrls.map(
        normalizeSideEffectFileUrl,
      );
      writeFileSync(
        packageJsonFileUrl,
        JSON.stringify(packageJson, null, "  "),
      );
    },
  };
};
