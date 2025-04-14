// import { ANSI } from "@jsenv/humanize";
import { urlIsInsideOf, urlToFilename, urlToRelativeUrl } from "@jsenv/urls";

export const createBuildUrlsGenerator = ({
  // logger,
  sourceDirectoryUrl,
  buildDirectoryUrl,
}) => {
  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename(url);
    }
    if (urlInfo.filenameHint) {
      return urlInfo.filenameHint;
    }
    return urlToFilename(url);
  };

  const buildUrlMap = new Map();
  const associateBuildUrl = (url, buildUrl) => {
    buildUrlMap.set(url, buildUrl);
    //     logger.debug(`associate a build url
    // ${ANSI.color(url, ANSI.GREY)} ->
    // ${ANSI.color(buildUrl, ANSI.MAGENTA)}
    // `);
  };

  const nameSetPerDirectoryMap = new Map();
  const generate = (url, { urlInfo, ownerUrlInfo, assetsDirectory }) => {
    const buildUrlFromMap = buildUrlMap.get(url);
    if (buildUrlFromMap) {
      return buildUrlFromMap;
    }
    if (urlIsInsideOf(url, buildDirectoryUrl)) {
      if (ownerUrlInfo.searchParams.has("dynamic_import_id")) {
        const ownerDirectoryPath = determineDirectoryPath({
          sourceDirectoryUrl,
          assetsDirectory,
          urlInfo: ownerUrlInfo,
        });
        const buildRelativeUrl = urlToRelativeUrl(url, buildDirectoryUrl);
        const buildUrl = `${buildDirectoryUrl}${ownerDirectoryPath}${buildRelativeUrl}`;
        associateBuildUrl(url, buildUrl);
        return buildUrl;
      }
      associateBuildUrl(url, url);
      return url;
    }
    if (urlInfo.type === "entry_build") {
      const buildUrl = new URL(urlInfo.filenameHint, buildDirectoryUrl).href;
      associateBuildUrl(url, buildUrl);
      return buildUrl;
    }
    if (
      urlInfo.type === "directory" ||
      (urlInfo.type === undefined && urlInfo.typeHint === "directory")
    ) {
      let directoryPath;
      if (url === sourceDirectoryUrl) {
        directoryPath = "";
      } else if (urlInfo.filenameHint) {
        directoryPath = urlInfo.filenameHint;
      } else {
        directoryPath = urlToRelativeUrl(url, sourceDirectoryUrl);
      }
      const { search } = new URL(url);
      const buildUrl = `${buildDirectoryUrl}${directoryPath}${search}`;
      associateBuildUrl(url, buildUrl);
      return buildUrl;
    }

    const directoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo,
      ownerUrlInfo,
    });
    let nameSet = nameSetPerDirectoryMap.get(directoryPath);
    if (!nameSet) {
      nameSet = new Set();
      nameSetPerDirectoryMap.set(directoryPath, nameSet);
    }
    const urlObject = new URL(url);
    let { search, hash } = urlObject;
    let urlName = getUrlName(url, urlInfo);
    let [basename, extension] = splitFileExtension(urlName);
    extension = extensionMappings[extension] || extension;
    let nameCandidate = `${basename}${extension}`; // reconstruct name in case extension was normalized
    let integer = 1;
    while (nameSet.has(nameCandidate)) {
      integer++;
      nameCandidate = `${basename}${integer}${extension}`;
    }
    const name = nameCandidate;
    nameSet.add(name);
    const buildUrl = `${buildDirectoryUrl}${directoryPath}${name}${search}${hash}`;
    associateBuildUrl(url, buildUrl);
    return buildUrl;
  };

  return {
    generate,
  };
};

// It's best to generate files with an extension representing what is inside the file
// and after build js files contains solely js (js or typescript is gone).
// This way a static file server is already configured to server the correct content-type
// (otherwise one would have to configure that ".jsx" is "text/javascript")
// To keep in mind: if you have "user.jsx" and "user.js" AND both file are not bundled
// you end up with "dist/js/user.js" and "dist/js/user2.js"
const extensionMappings = {
  ".jsx": ".js",
  ".ts": ".js",
  ".tsx": ".js",
};

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".");
  if (dotLastIndex === -1) {
    return [filename, ""];
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const determineDirectoryPath = ({
  sourceDirectoryUrl,
  assetsDirectory,
  urlInfo,
  ownerUrlInfo,
}) => {
  if (urlInfo.dirnameHint) {
    return urlInfo.dirnameHint;
  }
  if (urlInfo.type === "directory") {
    return "";
  }
  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      sourceDirectoryUrl,
      assetsDirectory,
      urlInfo: ownerUrlInfo || urlInfo.firstReference.ownerUrlInfo,
    });
    return parentDirectoryPath;
  }
  const dynamicImportId = urlInfo.searchParams.get("dynamic_import_id");
  if (dynamicImportId) {
    return `${assetsDirectory}${dynamicImportId}/`;
  }
  if (urlInfo.isEntryPoint && !urlInfo.isDynamicEntryPoint) {
    return "";
  }
  if (urlInfo.type === "importmap") {
    return "";
  }
  if (urlInfo.type === "html") {
    return `${assetsDirectory}html/`;
  }
  if (urlInfo.type === "css") {
    return `${assetsDirectory}css/`;
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return `${assetsDirectory}js/`;
  }
  if (urlInfo.type === "json") {
    return `${assetsDirectory}json/`;
  }
  return `${assetsDirectory}other/`;
};
