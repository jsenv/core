import { bufferToEtag, writeFileSync } from "@jsenv/filesystem";
import { urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/urls";
import { existsSync, utimesSync } from "node:fs";

export const updateCompileCache = ({
  logger,
  compiledFileUrl,
  content,
  assets,
  mtime,
  compileResultStatus,
}) => {
  const isNew = compileResultStatus === "created";
  const isUpdated = compileResultStatus === "updated";
  if (!isNew && !isUpdated) {
    return;
  }

  // ensure source that does not leads to files are not capable to invalidate the cache
  const filesRemoved = [];
  Object.keys(assets).forEach((assetUrl) => {
    if (
      assetUrl.startsWith("file://") &&
      assets[assetUrl].type === "source" &&
      !existsSync(new URL(assetUrl))
    ) {
      delete assets[assetUrl];
      filesRemoved.push(assetUrl);
    }
  });
  const notFoundCount = filesRemoved.length;
  if (notFoundCount > 0) {
    logger.warn(`COMPILE_ASSET_FILE_NOT_FOUND: ${notFoundCount} file(s) not found.
--- consequence ---
cache will be reused even if one of the source file is modified
--- files not found ---
${filesRemoved.join(`\n`)}`);
  }

  logger.debug(
    `write compiled file at ${urlToFileSystemPath(compiledFileUrl)}`,
  );
  writeFileSync(compiledFileUrl, content, {
    fileLikelyNotFound: isNew,
  });
  // mtime is passed, it meant the file mtime is important
  // -> we update file mtime
  if (mtime) {
    utimesSync(new URL(compiledFileUrl), new Date(mtime), new Date(mtime));
  }

  const assetInfos = {};
  Object.keys(assets).forEach((assetUrl) => {
    logger.debug(
      `write compiled file asset at ${urlToFileSystemPath(assetUrl)}`,
    );
    const asset = assets[assetUrl];
    writeFileSync(assetUrl, asset.content, {
      fileLikelyNotFound: isNew,
    });
    const assetRelativeUrl = urlToRelativeUrl(assetUrl, compiledFileUrl);
    const assetEtag = asset.etag || bufferToEtag(Buffer.from(asset.content));
    assetInfos[assetRelativeUrl] = {
      type: asset.type,
      etag: assetEtag,
    };
  });

  const compileInfoFileUrl = `${compiledFileUrl}__compile_info__.json`;
  let latestCompileInfo;
  if (isNew) {
    latestCompileInfo = {
      // was used at some point to ensure the compiled file matches browser etag
      // etag: bufferToEtag(Buffer.from(content)),
      assetInfos,
      createdMs: Date.now(),
      lastModifiedMs: Date.now(),
    };
  } else if (isUpdated) {
    latestCompileInfo = {
      // was used at some point to ensure the compiled file matches browser etag
      // etag: bufferToEtag(Buffer.from(content)),
      assetInfos,
      lastModifiedMs: Date.now(),
    };
  }
  logger.debug(
    `write compiled file info at ${urlToFileSystemPath(compileInfoFileUrl)}`,
  );
  writeFileSync(
    compileInfoFileUrl,
    JSON.stringify(latestCompileInfo, null, "  "),
    {
      fileLikelyNotFound: isNew,
    },
  );
};
