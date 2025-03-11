import { Abort } from "@jsenv/abort";
import { urlToFileSystemPath } from "@jsenv/urls";

import { importWithRequire } from "../helpers/import_with_require.js";
import { composeTwoFileByFileIstanbulCoverages } from "./istanbul_coverage_composition.js";

export const v8CoverageToIstanbul = async (v8Coverage, { signal }) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    const v8ToIstanbul = importWithRequire("v8-to-istanbul");
    const sourcemapCache = v8Coverage["source-map-cache"];
    let istanbulCoverageComposed = null;

    await v8Coverage.result.reduce(async (previous, fileV8Coverage) => {
      operation.throwIfAborted();
      await previous;

      const { source } = fileV8Coverage;
      let sources;
      // when v8 coverage comes from playwright (chromium) v8Coverage.source is set
      if (typeof source === "string") {
        sources = { source };
      }
      // when v8 coverage comes from Node.js, the source can be read from sourcemapCache
      else if (sourcemapCache) {
        sources = sourcesFromSourceMapCache(fileV8Coverage.url, sourcemapCache);
      }
      const path = urlToFileSystemPath(fileV8Coverage.url);

      const converter = v8ToIstanbul(
        path,
        // wrapperLength is undefined we don't need it
        // https://github.com/istanbuljs/v8-to-istanbul/blob/2b54bc97c5edf8a37b39a171ec29134ba9bfd532/lib/v8-to-istanbul.js#L27
        undefined,
        sources,
      );
      await converter.load();

      converter.applyCoverage(fileV8Coverage.functions);
      const istanbulCoverage = converter.toIstanbul();

      istanbulCoverageComposed = istanbulCoverageComposed
        ? composeTwoFileByFileIstanbulCoverages(
            istanbulCoverageComposed,
            istanbulCoverage,
          )
        : istanbulCoverage;
    }, Promise.resolve());

    if (!istanbulCoverageComposed) {
      return {};
    }
    istanbulCoverageComposed = markAsConvertedFromV8(istanbulCoverageComposed);
    return istanbulCoverageComposed;
  } finally {
    await operation.end();
  }
};

const markAsConvertedFromV8 = (fileByFileCoverage) => {
  const fileByFileMarked = {};
  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key];
    fileByFileMarked[key] = {
      ...fileCoverage,
      fromV8: true,
    };
  });
  return fileByFileMarked;
};

const sourcesFromSourceMapCache = (url, sourceMapCache) => {
  const sourceMapAndLineLengths = sourceMapCache[url];
  if (!sourceMapAndLineLengths) {
    return {};
  }

  const { data, lineLengths } = sourceMapAndLineLengths;
  // See: https://github.com/nodejs/node/pull/34305
  if (!data) {
    return undefined;
  }

  const sources = {
    sourcemap: data,
    ...(lineLengths ? { source: sourcesFromLineLengths(lineLengths) } : {}),
  };
  return sources;
};

const sourcesFromLineLengths = (lineLengths) => {
  let source = "";
  lineLengths.forEach((length) => {
    source += `${"".padEnd(length, ".")}\n`;
  });
  return source;
};
