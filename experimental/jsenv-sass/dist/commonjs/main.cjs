'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var module$1 = require('module');
var server = require('@jsenv/server');
var util = require('@jsenv/util');

/* global __filename */
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file:///${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
const windowsFilePathToUrl = windowsFilePath => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`;
};
const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}` : javaScriptSource;
};
const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeCssSourceMappingUrl(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}` : cssSource;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g; // ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file

const writeJavaScriptSourceMappingURL = value => `${"//#"} sourceMappingURL=${value}`;

const writeCssSourceMappingUrl = value => `/*# sourceMappingURL=${value} */`;

const sourcemapToBase64Url = sourcemap => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return `data:application/json;charset=utf-8;base64,${asBase64}`;
};

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;

  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return `${before}${mappedAfter}`;
  }

  return source;
};

const generateCompiledFileAssetUrl = (compiledFileUrl, assetName) => {
  return `${compiledFileUrl}__asset__${assetName}`;
};

const isWindows = process.platform === "win32";
const transformResultToCompilationResult = async ({
  code,
  map,
  contentType = "application/javascript",
  metadata = {}
}, {
  projectDirectoryUrl,
  originalFileContent,
  originalFileUrl,
  compiledFileUrl,
  sourcemapFileUrl,
  sourcemapEnabled = true,
  // removing sourcesContent from map decrease the sourceMap
  // it also means client have to fetch source from server (additional http request)
  // some client ignore sourcesContent property such as vscode-chrome-debugger
  // Because it's the most complex scenario and we want to ensure client is always able
  // to find source from the sourcemap, we remove map.sourcesContent by default to test this.
  sourcemapExcludeSources = true,
  sourcemapMethod = "comment" // "comment", "inline"

}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileContent !== "string") {
    throw new TypeError(`originalFileContent must be a string, got ${originalFileContent}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];
  const assets = [];
  const assetsContent = [];
  let output = code;

  if (sourcemapEnabled && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(originalFileUrl);
      sourcesContent.push(originalFileContent);
    } else {
      await Promise.all(map.sources.map(async (source, index) => {
        // be careful here we might received C:/Directory/file.js path from babel
        // also in case we receive relative path like directory\file.js we replace \ with slash
        // for url resolution
        const sourceFileUrl = isWindows && startsWithWindowsDriveLetter(source) ? windowsFilePathToUrl(source) : util.ensureWindowsDriveLetter(util.resolveUrl(isWindows ? replaceBackSlashesWithSlashes(source) : source, sourcemapFileUrl), sourcemapFileUrl);

        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return;
        }

        map.sources[index] = util.urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl);
        sources[index] = sourceFileUrl;

        if (map.sourcesContent && map.sourcesContent[index]) {
          sourcesContent[index] = map.sourcesContent[index];
        } else {
          const sourceFileContent = await util.readFile(sourceFileUrl);
          sourcesContent[index] = sourceFileContent;
        }
      }));
    }

    if (sourcemapExcludeSources) {
      delete map.sourcesContent;
    } // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform


    delete map.sourceRoot;
    const setSourceMappingUrl = contentType === "application/javascript" ? setJavaScriptSourceMappingUrl : setCssSourceMappingUrl;

    if (sourcemapMethod === "inline") {
      output = setSourceMappingUrl(output, sourcemapToBase64Url(map));
    } else if (sourcemapMethod === "comment") {
      const sourcemapFileRelativePathForModule = util.urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl);
      output = setSourceMappingUrl(output, sourcemapFileRelativePathForModule);
      assets.push(sourcemapFileUrl);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(originalFileUrl);
    sourcesContent.push(originalFileContent);
  }

  const {
    coverage
  } = metadata;

  if (coverage) {
    const coverageAssetFileUrl = generateCompiledFileAssetUrl(compiledFileUrl, "coverage.json");
    assets.push(coverageAssetFileUrl);
    assetsContent.push(stringifyCoverage(coverage));
  }

  return {
    compiledSource: output,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

const require$1 = module$1.createRequire(url);

const sass = require$1("sass");

const jsenvCompilerForSass = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  writeOnFilesystem,
  sourcemapExcludeSources
}) => {
  const contentType = server.urlToContentType(originalFileUrl);

  if (contentType !== "text/x-sass" && contentType !== "text/x-scss") {
    return null;
  }

  return {
    compile: originalFileContent => {
      const result = sass.renderSync({
        file: util.urlToFileSystemPath(originalFileUrl),
        data: originalFileContent,
        outFile: util.urlToFileSystemPath(compiledFileUrl),
        sourceMap: true,
        sourceMapContents: true
      });
      const css = String(result.css);
      const map = JSON.parse(String(result.map));
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      return transformResultToCompilationResult({
        code: css,
        map,
        contentType: "text/css"
      }, {
        projectDirectoryUrl,
        originalFileContent,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
        sourcemapExcludeSources
      });
    }
  };
};

exports.jsenvCompilerForSass = jsenvCompilerForSass;

//# sourceMappingURL=main.cjs.map