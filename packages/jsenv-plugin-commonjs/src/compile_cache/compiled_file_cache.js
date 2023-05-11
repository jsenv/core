import { readFileSync, writeFileSync } from "node:fs";
import { createLogger, UNICODE } from "@jsenv/log";
import {
  assertAndNormalizeFileUrl,
  ensureEmptyDirectory,
} from "@jsenv/filesystem";

import { validateCompileCache } from "./validate_compile_cache.js";
import { createLockRegistry } from "./file_lock_registry.js";
import { updateCompileCache } from "./update_compile_cache.js";

const { lockForResource } = createLockRegistry();

export const reuseOrCreateCompiledFile = async ({
  logLevel,
  compileCacheDirectoryUrl,
  sourceFileUrl,
  compiledFileUrl,
  compileCacheStrategy,
  compileCacheAssetsValidation,
  compile,
}) => {
  const logger = createLogger({ logLevel });
  await initCompileCacheDirectory({ logger, compileCacheDirectoryUrl });
  sourceFileUrl = assertAndNormalizeFileUrl(sourceFileUrl);
  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`);
  }

  const getCacheValidity = () => {
    const cacheValidity = validateCompileCache({
      logger,
      compiledFileUrl,
      compileCacheStrategy,
      compileCacheAssetsValidation,
    });
    return cacheValidity;
  };

  return startAsap(
    async () => {
      logger.debug(`check cache for ${compiledFileUrl}`);
      const cacheValidity = getCacheValidity();
      if (cacheValidity.isValid) {
        logger.debug(`${UNICODE.OK} found a valid cache`);
        const compileInfo = cacheValidity.compileInfo.data;
        const content = String(cacheValidity.compiledFile.data.buffer);
        const assets = {};
        let sourcemap = null;
        Object.keys(compileInfo.assetInfos).forEach((assetRelativeUrl) => {
          const assetUrl = new URL(assetRelativeUrl, compiledFileUrl).href;
          const assetValidity = cacheValidity.assets.data[assetUrl];
          const asset = {
            type: compileInfo.assetInfos[assetRelativeUrl].type,
            etag: compileInfo.assetInfos[assetRelativeUrl].etag,
            content: assetValidity.data.content,
          };
          assets[assetUrl] = asset;
          if (asset.type === "sourcemap") {
            sourcemap = assetValidity.data.sourcemap;
          }
        });
        return {
          isValid: () => getCacheValidity().isValid,
          content,
          sourcemap,
        };
      }
      if (cacheValidity.code === "SOURCES_EMPTY") {
        logger.warn(
          `${UNICODE.WARN} meta.sources is empty for ${compiledFileUrl}`,
        );
      }
      logger.debug(`${UNICODE.INFO} cache not found or invalid`);
      const compileInfoIsValid = cacheValidity.compileInfo
        ? cacheValidity.compileInfo.isValid
        : false;
      const fileContentAsBuffer = readFileSync(new URL(sourceFileUrl));
      const fileContentAsString = String(fileContentAsBuffer);

      const compileResult = await compile({
        content: fileContentAsString,
      });
      if (typeof compileResult !== "object" || compileResult === null) {
        throw new TypeError(
          `compile must return an object, got ${compileResult}`,
        );
      }
      const { content, sourcemap, assets } = compileResult;
      updateCompileCache({
        logger,
        compiledFileUrl,
        content,
        assets,
        compileResultStatus: compileInfoIsValid ? "updated" : "created",
      });
      return {
        isValid: () => getCacheValidity().isValid,
        content,
        sourcemap,
      };
    },
    {
      compiledFileUrl,
    },
  );
};

const initalized = {};
const initCompileCacheDirectory = async ({
  logger,
  compileCacheDirectoryUrl,
}) => {
  if (initalized[compileCacheDirectoryUrl]) {
    return;
  }
  initalized[compileCacheDirectoryUrl] = true;
  logger.debug(`check compile directory at ${compileCacheDirectoryUrl}`);
  const compileContextJsonFileUrl = new URL(
    "./__compile_context__.json",
    compileCacheDirectoryUrl,
  );
  const version = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url)),
  ).version;
  const compileContext = readCompileContextFile({
    logger,
    compileContextJsonFileUrl,
  });
  if (compileContext && compileContext.version === version) {
    logger.debug(`${UNICODE.OK} reuse compile directory`);
  } else {
    if (compileContext) {
      logger.debug(`${UNICODE.WARN} clean existing directory`);
    } else {
      logger.debug(`${UNICODE.INFO} create an empty directory`);
    }
    await ensureEmptyDirectory(compileCacheDirectoryUrl);
    writeFileSync(
      compileContextJsonFileUrl,
      JSON.stringify({ version }, null, "  "),
    );
  }
};

const readCompileContextFile = ({ logger, compileContextJsonFileUrl }) => {
  let compileContextFileContent;
  try {
    compileContextFileContent = readFileSync(compileContextJsonFileUrl);
  } catch (e) {
    logger.debug(
      `${UNICODE.INFO} cannot read compile context at ${compileContextJsonFileUrl}`,
    );
    return null;
  }
  try {
    const compileContext = JSON.parse(compileContextFileContent);
    return compileContext;
  } catch (e) {
    if (e.name === "SyntaxError") {
      logger.warn(
        `${UNICODE.WARN} syntax error in ${compileContextJsonFileUrl}`,
      );
      return null;
    }
    throw e;
  }
};

const startAsap = async (fn, { compiledFileUrl }) => {
  const unlockLocal = await lockForResource(compiledFileUrl);
  try {
    return await fn();
  } finally {
    // "finally" we want to unlock in case of error too
    unlockLocal();
  }
};
