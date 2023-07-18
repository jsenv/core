import { ANSI } from "@jsenv/log";
import { urlIsInsideOf } from "@jsenv/urls";

import { createBuildUrlsGenerator } from "./build_urls_generator.js";

export const createBuildSpecifierManager = ({
  logger,
  buildDirectoryUrl,
  assetsDirectory,
}) => {
  const buildUrlsGenerator = createBuildUrlsGenerator({
    buildDirectoryUrl,
    assetsDirectory,
  });

  const buildDirectoryRedirections = new Map();
  const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
    if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
      throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`);
    }
    if (buildDirectoryRedirections.get(buildUrl) !== rawUrl) {
      logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
      buildDirectoryRedirections.set(buildUrl, rawUrl);
    }
  };

  return {
    buildUrlsGenerator,
    buildDirectoryRedirections,
    associateBuildUrlAndRawUrl,
    redirectToBuildDirectory: () => {},
  };
};
