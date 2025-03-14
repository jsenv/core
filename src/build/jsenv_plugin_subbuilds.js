import { urlToRelativeUrl } from "@jsenv/urls";
import { defaultRuntimeCompat, getDefaultBase } from "./build_params.js";

export const jsenvPluginSubbuilds = (
  subBuildParamsArray,
  { parentBuildParams, onCustomBuildDirectory, buildStart },
) => {
  if (subBuildParamsArray.length === 0) {
    return [];
  }
  return subBuildParamsArray.map((subBuildParams, index) => {
    const defaultChildBuildParams = {};
    const childBuildParams = {
      ...parentBuildParams,
      logs: {
        level: "warn",
        disabled: true,
      },
      ...defaultChildBuildParams,
      ...subBuildParams,
      // for now the subbuild content won't be written cause
      // it can conflict when there is several build in parallel
      // causing errors like scandir ENOENT
      // (this is because we cleanup the outDirectory for each build)
      // (so we night be removing dir while also trying to write them)
      outDirectoryUrl: null,
    };
    const subBuildDirectoryUrl = subBuildParams.buildDirectoryUrl;
    if (subBuildDirectoryUrl) {
      const subBuildRelativeUrl = urlToRelativeUrl(
        subBuildDirectoryUrl,
        parentBuildParams.buildDirectoryUrl,
      );
      const subbuildRuntimeCompat =
        childBuildParams.runtimeCompat || defaultRuntimeCompat;
      const subbuildBase =
        subBuildParams.base || getDefaultBase(subbuildRuntimeCompat);
      childBuildParams.base = `${subbuildBase}${subBuildRelativeUrl}`;
      onCustomBuildDirectory(subBuildRelativeUrl);
    }
    const buildPromise = buildStart(childBuildParams, index);
    const entryPointBuildUrlMap = new Map();
    const entryPointSourceUrlSet = new Set();
    const entryPointBuildUrlSet = new Set();
    const childBuildEntryPoints = childBuildParams.entryPoints;
    for (const key of Object.keys(childBuildEntryPoints)) {
      const entryPointUrl = new URL(key, childBuildParams.sourceDirectoryUrl)
        .href;
      const entryPointBuildUrl = new URL(
        childBuildEntryPoints[key],
        childBuildParams.buildDirectoryUrl,
      ).href;
      entryPointBuildUrlMap.set(entryPointUrl, entryPointBuildUrl);
      entryPointSourceUrlSet.add(entryPointUrl);
      entryPointBuildUrlSet.add(entryPointBuildUrl);
    }

    return {
      name: `jsenv:subbuild_${index}`,
      redirectReference: (reference) => {
        const entryPointBuildUrl = entryPointBuildUrlMap.get(reference.url);
        if (!entryPointBuildUrl) {
          return null;
        }
        return entryPointBuildUrl;
      },
      fetchUrlContent: async (urlInfo) => {
        if (!entryPointBuildUrlSet.has(urlInfo.url)) {
          return;
        }
        await buildPromise;
        urlInfo.typeHint = "asset"; // this ensure the rest of jsenv do not scan or modify the content of this file
      },
    };
  });
};
