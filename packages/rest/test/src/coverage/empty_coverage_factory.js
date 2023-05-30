import { readFile } from "@jsenv/filesystem";
import { resolveUrl } from "@jsenv/urls";
import { Abort } from "@jsenv/abort";
import { applyBabelPlugins } from "@jsenv/ast";

import { importWithRequire } from "../helpers/import_with_require.js";
import { babelPluginInstrument } from "./babel_plugin_instrument.js";

export const relativeUrlToEmptyCoverage = async (
  relativeUrl,
  { signal, rootDirectoryUrl },
) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  try {
    const fileUrl = resolveUrl(relativeUrl, rootDirectoryUrl);
    const content = await readFile(fileUrl, { as: "string" });

    operation.throwIfAborted();
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [babelPluginInstrument],
      urlInfo: {
        originalUrl: fileUrl,
        content,
      },
    });
    const { coverage } = metadata;
    if (!coverage) {
      throw new Error(`missing coverage for file`);
    }
    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function (key) {
      coverage.s[key] = 0;
    });
    return coverage;
  } catch (e) {
    if (e && e.code === "PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      return createEmptyCoverage(relativeUrl);
    }
    throw e;
  } finally {
    await operation.end();
  }
};

const createEmptyCoverage = (relativeUrl) => {
  const { createFileCoverage } = importWithRequire("istanbul-lib-coverage");
  return createFileCoverage(relativeUrl).toJSON();
};
