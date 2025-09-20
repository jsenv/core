import {
  assertAndNormalizeDirectoryUrl,
  bufferToEtag,
  readFile,
} from "@jsenv/filesystem";
import { createDetailedMessage, createLogger } from "@jsenv/humanize";
import { fileURLToPath } from "node:url";
import { applyTrackingConfig } from "./internal/apply_tracking_config.js";
import { formatFileSizeReportForLog } from "./internal/format_file_size_report_for_log.js";
import { jsenvTrackingConfig } from "./jsenv_tracking_config.js";
import { transform as rawTransform } from "./raw_transformation.js";

export const generateFileSizeReport = async ({
  log,
  logLevel,
  rootDirectoryUrl,
  trackingConfig = jsenvTrackingConfig,
  manifestConfig = {
    "./dist/**/manifest.json": true,
  },
  transformations = { raw: rawTransform },
}) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);

  const logger = createLogger({ logLevel });

  const trackingNames = Object.keys(trackingConfig);
  if (trackingNames.length === 0) {
    logger.warn(`trackingConfig is empty`);
  }

  const groupTrackingResults = await applyTrackingConfig(trackingConfig, {
    rootDirectoryUrl,
    manifestConfig,
  });
  const groupNames = Object.keys(groupTrackingResults);
  const groups = {};

  // ensure keys order is the same as trackingConfig (despite Promise.all below)
  groupNames.forEach((groupName) => {
    groups[groupName] = null;
  });
  await Promise.all(
    groupNames.map(async (groupName) => {
      const groupTrackingResult = groupTrackingResults[groupName];
      const groupReport = await groupTrackingResultToGroupReport(
        groupTrackingResult,
        {
          logger,
          rootDirectoryUrl,
          tracking: trackingConfig[groupName],
          transformations,
        },
      );
      groups[groupName] = groupReport;
    }),
  );

  const fileSizeReport = {
    transformationKeys: Object.keys(transformations),
    groups,
  };

  if (log) {
    logger.info(formatFileSizeReportForLog(fileSizeReport));
  }

  return fileSizeReport;
};

const groupTrackingResultToGroupReport = async (
  groupTrackingResult,
  { logger, rootDirectoryUrl, tracking, transformations },
) => {
  const manifestMap = {};
  const { manifestMetaMap } = groupTrackingResult;
  const manifestRelativeUrls = Object.keys(manifestMetaMap);
  await Promise.all(
    manifestRelativeUrls.map(async (manifestRelativeUrl) => {
      const manifestFileUrl = new URL(manifestRelativeUrl, rootDirectoryUrl)
        .href;
      const manifestFileContent = await readFile(manifestFileUrl, {
        as: "string",
      });
      let manifest;
      try {
        manifest = JSON.parse(manifestFileContent);
      } catch (e) {
        if (e.name === "SyntaxError") {
          logger.error(
            createDetailedMessage(
              `JSON.parse error while trying to parse a manifest file`,
              {
                "error stack": e.stack,
                "manifest file": fileURLToPath(manifestFileUrl),
              },
            ),
          );
          return;
        }
        throw e;
      }
      manifestMap[manifestRelativeUrl] = manifest;
    }),
  );

  const fileMap = {};
  const { trackedMetaMap } = groupTrackingResult;
  const trackedRelativeUrls = Object.keys(trackedMetaMap);
  // we use reduce and not Promise.all() because transformation can be expensive (gzip, brotli)
  // so we won't benefit from concurrency (it might even make things worse)
  await trackedRelativeUrls.reduce(async (previous, fileRelativeUrl) => {
    await previous;
    const fileUrl = new URL(fileRelativeUrl, rootDirectoryUrl).href;
    const fileBuffer = await readFile(fileUrl, { as: "buffer" });
    const sizeMap = await getFileSizeMap(fileBuffer, {
      transformations,
      logger,
      fileUrl,
    });
    const hash = bufferToEtag(fileBuffer);
    fileMap[fileRelativeUrl] = {
      sizeMap,
      hash,
      meta: trackedMetaMap[fileRelativeUrl],
    };
  }, Promise.resolve());

  return {
    tracking,
    manifestMap,
    fileMap,
  };
};

const getFileSizeMap = async (
  fileBuffer,
  { transformations, logger, fileUrl },
) => {
  const sizeMap = {};
  await Object.keys(transformations).reduce(async (previous, sizeName) => {
    await previous;
    const transform = transformations[sizeName];
    try {
      const transformResult = await transform(fileBuffer);
      sizeMap[sizeName] = Buffer.from(transformResult).length;
    } catch (e) {
      logger.error(
        createDetailedMessage(
          `error while transforming ${fileUrl} with ${sizeName}`,
          {
            "error stack": e.stack,
          },
        ),
      );
      sizeMap[sizeName] = "error";
    }
  }, Promise.resolve());
  return sizeMap;
};
