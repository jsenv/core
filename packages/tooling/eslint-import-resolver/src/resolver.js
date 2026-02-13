// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js
// https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
// https://github.com/olalonde/eslint-import-resolver-babel-root-import

import {
  assertAndNormalizeDirectoryUrl,
  ensureWindowsDriveLetter,
  getRealFileSystemUrlSync,
  lookupPackageDirectory,
} from "@jsenv/filesystem";
import {
  applyFileSystemMagicResolution,
  applyNodeEsmResolution,
  determineModuleSystem,
  getExtensionsToTry,
  readCustomConditionsFromProcessArgs,
} from "@jsenv/node-esm-resolution";
import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js";
import { urlToExtension, urlToFileSystemPath } from "@jsenv/urls";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHtmlForImportmap } from "./find_importmap_in_html_file.js";
import { applyImportmapResolution } from "./importmap_resolution.js";
import { createLogger } from "./logger.js";
import { readImportmapFromFile } from "./read_importmap.js";
import { applyUrlResolution } from "./url_resolution.js";

export const interfaceVersion = 2;

export const resolve = (
  source,
  file,
  {
    logLevel = "error",
    packageConditions = ["browser", "import"],
    ambiguousExtensions = [".js", ".html", ".jsx", ".ts", ".tsx"],
    rootDirectoryUrl,
    importmapFileRelativeUrl,
    caseSensitive = true,
    // NICE TO HAVE: allow more control on when magic resolution applies:
    // one might want to enable this for node_modules but not for project files
    magicDirectoryIndex,
    magicExtensions,
  },
) => {
  const logger = createLogger({ logLevel });
  logger.debug(`
resolve import.
--- specifier ---
${source}
--- importer ---
${file}
--- package conditions ---
${packageConditions.join(",")}`);

  const triggerNotFoundWarning = ({ resolver, specifier, importer, url }) => {
    const logLevel =
      importer.includes(".xtest.js") || specifier.includes("/not_found.js")
        ? "debug"
        : "warn";
    if (resolver === "esm") {
      logger[logLevel](
        `esm module resolution failed for "${specifier}" imported by ${importer}`,
      );
    } else if (resolver === "commonjs") {
      logger[logLevel](
        `commonjs module resolution failed for "${specifier}" imported by ${importer}`,
      );
    } else {
      logger[logLevel](
        `filesystem resolution failed for "${specifier}" imported by ${importer} (file not found at ${url})`,
      );
    }
  };

  packageConditions = [
    ...readCustomConditionsFromProcessArgs(),
    ...packageConditions,
  ];
  const browserInPackageConditions = packageConditions.includes("browser");
  const nodeInPackageConditions = packageConditions.includes("node");
  if (nodeInPackageConditions && isSpecifierForNodeBuiltin(source)) {
    logger.debug(`-> native node module`);
    return {
      found: true,
      path: null,
    };
  }

  const importer = String(pathToFileURL(file));
  const onUrl = (url) => {
    if (url.startsWith("file:")) {
      url = ensureWindowsDriveLetter(url, importer);
      if (magicDirectoryIndex === undefined) {
        if (url.includes("/node_modules/")) {
          magicDirectoryIndex = true;
        } else {
          magicDirectoryIndex = false;
        }
      }
      if (magicExtensions === undefined) {
        if (url.includes("/node_modules/")) {
          magicExtensions = ["inherit", ".js"];
        } else {
          magicExtensions = false;
        }
      }

      return handleFileUrl(url, {
        specifier,
        importer,
        logger,
        caseSensitive,
        magicDirectoryIndex,
        magicExtensions,
        triggerNotFoundWarning,
      });
    }
    if (url.startsWith("node:") && !nodeInPackageConditions) {
      logger.warn(
        `Warning: ${file} is using "node:" scheme but "node" is not in packageConditions (importing "${source}")`,
      );
    }
    logger.debug(`-> consider found because of scheme ${url}`);
    return {
      found: true,
      path: null,
    };
  };

  const specifier = source;
  try {
    if (
      browserInPackageConditions &&
      !nodeInPackageConditions &&
      specifier[0] === "/"
    ) {
      if (!rootDirectoryUrl) {
        rootDirectoryUrl = lookupPackageDirectory(importer);
      }
      return onUrl(new URL(specifier.slice(1), rootDirectoryUrl).href, {
        resolvedBy: "url",
      });
    }

    // data:*, http://*, https://*, file://*
    if (isAbsoluteUrl(specifier)) {
      return onUrl(specifier, {
        resolvedBy: "url",
      });
    }

    const importmapResolution = tryToResolveWithImportmap({
      rootDirectoryUrl,
      importmapFileRelativeUrl,
      logger,
      specifier,
      importer,
    });
    if (importmapResolution) {
      return onUrl(importmapResolution.url, {
        resolvedBy: importmapResolution.resolvedBy,
      });
    }

    const moduleSystem = determineModuleSystem(importer, {
      ambiguousExtensions,
    });
    logger.debug(`-> module system is ${moduleSystem}`);
    if (moduleSystem === "commonjs") {
      const requireForImporter = createRequire(importer);

      let filesystemPath;
      try {
        const searchParamIndex = specifier.indexOf("?");
        const specifierWithoutSearchParam =
          searchParamIndex === -1
            ? specifier
            : specifier.slice(0, searchParamIndex);
        filesystemPath = requireForImporter.resolve(
          specifierWithoutSearchParam,
        );
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
          triggerNotFoundWarning({
            resolver: "commonjs",
            specifier,
            importer,
          });
          return { found: false, path: specifier };
        }
        throw e;
      }
      const url = String(pathToFileURL(filesystemPath));
      return onUrl(url, {
        resolvedBy: "commonjs",
      });
    }
    if (moduleSystem === "module") {
      let nodeResolution;
      try {
        nodeResolution = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl: importer,
          specifier,
        });
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
          triggerNotFoundWarning({
            resolver: "esm",
            specifier,
            importer,
          });
          return { found: false, path: specifier };
        }
        throw e;
      }
      if (nodeResolution) {
        return onUrl(nodeResolution.url, {
          resolvedBy: "node_esm",
        });
      }
    }
    if (moduleSystem === "url") {
      return onUrl(applyUrlResolution(specifier, importer), {
        resolvedBy: "url",
      });
    }
    throw new Error("not found");
  } catch (e) {
    logger.error(`Error while resolving "${source}" imported from "${file}"
--- error stack ---
${e.stack}`);
    return {
      found: false,
      path: null,
    };
  }
};

const tryToResolveWithImportmap = ({
  rootDirectoryUrl,
  importmapFileRelativeUrl,
  logger,
  specifier,
  importer,
}) => {
  try {
    const extension = urlToExtension(importer);
    if (extension === ".html") {
      const importmap = parseHtmlForImportmap(importer);
      if (importmap) {
        const urlFromImportmap = applyImportmapResolution(
          specifier,
          importer,
          importmap,
          {
            logger,
          },
        );
        if (urlFromImportmap) {
          return {
            url: urlFromImportmap,
            resolvedBy: "importmap_inside_html",
          };
        }
      }
    }
    if (importmapFileRelativeUrl) {
      if (typeof importmapFileRelativeUrl === "undefined") {
        return null;
      }
      if (typeof importmapFileRelativeUrl !== "string") {
        throw new TypeError(
          `importmapFileRelativeUrl must be a string, got ${importmapFileRelativeUrl}`,
        );
      }
      rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
        rootDirectoryUrl,
        "rootDirectoryUrl",
      );
      const importmapFileUrl = applyUrlResolution(
        importmapFileRelativeUrl,
        rootDirectoryUrl,
      );
      if (!importmapFileUrl.startsWith(`${rootDirectoryUrl}`)) {
        logger.warn(`import map file is outside root directory.
--- import map file ---
${fileURLToPath(importmapFileUrl)}
--- root directory ---
${fileURLToPath(rootDirectoryUrl)}`);
      }
      const importmap = readImportmapFromFile(importmapFileUrl);
      const urlFromImportmap = applyImportmapResolution(
        specifier,
        importer,
        importmap,
        { logger },
      );
      if (urlFromImportmap) {
        return {
          url: urlFromImportmap,
          resolvedBy: "importmap_from_param",
        };
      }
    }
    return null;
  } catch (e) {
    if (e && e.code === "SyntaxError") {
      logger.error(`syntax error in importmap
--- error stack ---
${e.stack}`);
      return null;
    }
    if (e && e.code === "ENOENT") {
      logger.error(`importmap file not found`);
      return null;
    }
    throw e;
  }
};

const handleFileUrl = (
  fileUrl,
  {
    specifier,
    importer,
    logger,
    magicDirectoryIndex,
    magicExtensions,
    caseSensitive,
    triggerNotFoundWarning,
  },
) => {
  fileUrl = `file://${new URL(fileUrl).pathname}`; // remove query params from url
  const fileResolution = applyFileSystemMagicResolution(fileUrl, {
    magicDirectoryIndex,
    magicExtensions: getExtensionsToTry(magicExtensions, importer),
  });
  if (!fileResolution.stat) {
    triggerNotFoundWarning({
      resolver: "filesystem",
      specifier,
      importer,
      url: fileUrl,
    });
    return { found: false, path: urlToFileSystemPath(fileUrl) };
  }
  fileUrl = fileResolution.url;
  const realFileUrl = getRealFileSystemUrlSync(fileUrl, {
    // we don't follow link because we care only about the theoric file location
    // without this realFileUrl and fileUrl can be different
    // and we would log the warning about case sensitivity
    followLink: false,
  });
  const filePath = urlToFileSystemPath(fileUrl);
  const realFilePath = realFileUrl
    ? urlToFileSystemPath(realFileUrl)
    : filePath;
  if (caseSensitive && realFileUrl && realFileUrl !== fileUrl) {
    logger.warn(
      `WARNING: file found for ${filePath} but would not be found on a case sensitive filesystem.
The real file path is ${realFilePath}.
You can choose to disable this warning by disabling case sensitivity.
If you do so keep in mind windows users would not find that file.`,
    );
    return {
      found: false,
      path: realFilePath,
    };
  }
  logger.debug(`-> found file at ${realFilePath}`);
  return {
    found: true,
    path: realFilePath,
  };
};

const isAbsoluteUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
