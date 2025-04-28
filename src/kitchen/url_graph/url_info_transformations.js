import { writeFileSync } from "@jsenv/filesystem";
import {
  composeTwoSourcemaps,
  generateSourcemapDataUrl,
  SOURCEMAP,
} from "@jsenv/sourcemap";
import {
  isFileSystemPath,
  setUrlBasename,
  urlToBasename,
  urlToFileSystemPath,
  urlToPathname,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { pathToFileURL } from "node:url";
import {
  defineGettersOnPropertiesDerivedFromContent,
  defineGettersOnPropertiesDerivedFromOriginalContent,
} from "./url_content.js";
import { applyContentInjections } from "./url_info_injections.js";

export const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsComment,
  sourcemapsSources,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent = true,
  outDirectoryUrl,
  supervisor,
}) => {
  const formatSourcemapSource =
    typeof sourcemapsSources === "function"
      ? (source, urlInfo) => {
          return sourcemapsSources(source, urlInfo);
        }
      : sourcemapsSources === "relative"
        ? (source, urlInfo) => {
            const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
            return sourceRelative || ".";
          }
        : null;

  const normalizeSourcemap = (urlInfo, sourcemap) => {
    let { sources } = sourcemap;
    if (sources) {
      sources = sources.map((source) => {
        if (source && isFileSystemPath(source)) {
          return String(pathToFileURL(source));
        }
        return source;
      });
    }
    const wantSourcesContent =
      // for inline content (<script> insdide html)
      // chrome won't be able to fetch the file as it does not exists
      // so sourcemap must contain sources
      sourcemapsSourcesContent ||
      urlInfo.isInline ||
      (sources &&
        sources.some((source) => !source || !source.startsWith("file:")));
    if (sources && sources.length > 1) {
      sourcemap.sources = sources.map(
        (source) => new URL(source, urlInfo.originalUrl).href,
      );
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined;
      }
      return sourcemap;
    }
    sourcemap.sources = [urlInfo.originalUrl];
    sourcemap.sourcesContent = [urlInfo.originalContent];
    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined;
    }
    return sourcemap;
  };

  const resetContent = (urlInfo) => {
    urlInfo.contentFinalized = false;
    urlInfo.originalContent = undefined;
    urlInfo.originalContentAst = undefined;
    urlInfo.originalContentEtag = undefined;
    urlInfo.contentAst = undefined;
    urlInfo.contentEtag = undefined;
    urlInfo.contentLength = undefined;
    urlInfo.content = undefined;
    urlInfo.sourcemap = null;
    urlInfo.sourcemapIsWrong = null;
    urlInfo.sourcemapReference = null;
  };

  const setContentProperties = (
    urlInfo,
    { content, contentAst, contentEtag, contentLength },
  ) => {
    if (content === urlInfo.content) {
      return false;
    }
    urlInfo.contentAst = contentAst;
    urlInfo.contentEtag = contentEtag;
    urlInfo.contentLength = contentLength;
    urlInfo.content = content;
    defineGettersOnPropertiesDerivedFromContent(urlInfo);
    return true;
  };

  const setContent = async (
    urlInfo,
    content,
    {
      contentAst, // most of the time will be undefined
      contentEtag, // in practice it's always undefined
      contentLength,
      originalContent = content,
      originalContentAst, // most of the time will be undefined
      originalContentEtag, // in practice always undefined
      sourcemap,
    } = {},
  ) => {
    urlInfo.originalContentAst = originalContentAst;
    urlInfo.originalContentEtag = originalContentEtag;
    if (originalContent !== urlInfo.originalContent) {
      urlInfo.originalContent = originalContent;
    }
    defineGettersOnPropertiesDerivedFromOriginalContent(urlInfo);

    let may = mayHaveSourcemap(urlInfo);
    let shouldHandle = shouldHandleSourcemap(urlInfo);
    if (may && !shouldHandle) {
      content = SOURCEMAP.removeComment({
        contentType: urlInfo.contentType,
        content,
      });
    }
    setContentProperties(urlInfo, {
      content,
      contentAst,
      contentEtag,
      contentLength,
    });
    urlInfo.sourcemap = sourcemap;
    if (!may || !shouldHandle) {
      return;
    }

    // case #1: already loaded during "load" hook
    // - happens during build
    // - happens for url converted during fetch (js_module_fallback for instance)
    if (urlInfo.sourcemap) {
      urlInfo.sourcemap = normalizeSourcemap(urlInfo, urlInfo.sourcemap);
      return;
    }

    // case #2: check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    });
    if (sourcemapFound) {
      const { type, subtype, line, column, specifier } = sourcemapFound;
      const sourcemapReference = urlInfo.dependencies.found({
        type,
        subtype,
        expectedType: "sourcemap",
        specifier,
        specifierLine: line,
        specifierColumn: column,
      });
      urlInfo.sourcemapReference = sourcemapReference;
      try {
        await sourcemapReference.urlInfo.cook();
        const sourcemapRaw = JSON.parse(sourcemapReference.urlInfo.content);
        const sourcemap = normalizeSourcemap(urlInfo, sourcemapRaw);
        urlInfo.sourcemap = sourcemap;
        return;
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    }

    // case #3: will be injected once cooked
  };

  const applyTransformations = (urlInfo, transformations) => {
    if (!transformations) {
      return;
    }
    const {
      type,
      contentType,
      content,
      contentAst, // undefined most of the time
      contentEtag, // in practice always undefined
      contentLength,
      sourcemap,
      sourcemapIsWrong,
      contentInjections,
    } = transformations;
    if (type) {
      urlInfo.type = type;
    }
    if (contentType) {
      urlInfo.contentType = contentType;
    }
    if (Object.hasOwn(transformations, "contentInjections")) {
      if (contentInjections) {
        Object.assign(urlInfo.contentInjections, contentInjections);
      }
      if (content === undefined) {
        return;
      }
    }
    let contentModified;
    if (Object.hasOwn(transformations, "content")) {
      contentModified = setContentProperties(urlInfo, {
        content,
        contentAst,
        contentEtag,
        contentLength,
      });
    }
    if (
      sourcemap &&
      mayHaveSourcemap(urlInfo) &&
      shouldHandleSourcemap(urlInfo)
    ) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      let currentSourcemap = urlInfo.sourcemap;
      const finalSourcemap = composeTwoSourcemaps(
        currentSourcemap,
        sourcemapNormalized,
      );
      const finalSourcemapNormalized = normalizeSourcemap(
        urlInfo,
        finalSourcemap,
      );
      urlInfo.sourcemap = finalSourcemapNormalized;
      // A plugin is allowed to modify url content
      // without returning a sourcemap
      // This is the case for preact and react plugins.
      // They are currently generating wrong source mappings
      // when used.
      // Generating the correct sourcemap in this situation
      // is a nightmare no-one could solve in years so
      // jsenv won't emit a warning and use the following strategy:
      // "no sourcemap is better than wrong sourcemap"
      urlInfo.sourcemapIsWrong = urlInfo.sourcemapIsWrong || sourcemapIsWrong;
    }
    if (contentModified && urlInfo.contentFinalized) {
      applyContentEffects(urlInfo);
    }
  };

  const applyContentEffects = (urlInfo) => {
    applySourcemapOnContent(urlInfo);
    writeInsideOutDirectory(urlInfo);
  };

  const writeInsideOutDirectory = (urlInfo) => {
    // writing result inside ".jsenv" directory (debug purposes)
    if (!outDirectoryUrl) {
      return;
    }
    const { generatedUrl } = urlInfo;
    if (!generatedUrl) {
      return;
    }
    if (!generatedUrl.startsWith("file:")) {
      return;
    }
    if (urlToPathname(generatedUrl).endsWith("/")) {
      // when users explicitely request a directory
      // we can't write the content returned by the server in ".jsenv" at that url
      // because it would try to write a directory
      // ideally we would decide a filename for this
      // for now we just don't write anything
      return;
    }
    if (urlInfo.type === "directory") {
      // no need to write the directory
      return;
    }
    // if (urlInfo.content === undefined) {
    //   // Some error might lead to urlInfo.content to be null
    //   // (error hapenning before urlInfo.content can be set, or 404 for instance)
    //   // in that case we can't write anything
    //   return;
    // }

    let contentIsInlined = urlInfo.isInline;
    if (
      contentIsInlined &&
      supervisor &&
      urlInfo.graph.getUrlInfo(urlInfo.inlineUrlSite.url).type === "html"
    ) {
      contentIsInlined = false;
    }
    if (!contentIsInlined) {
      const generatedUrlObject = new URL(generatedUrl);
      let baseName = urlToBasename(generatedUrlObject);
      for (const [key, value] of generatedUrlObject.searchParams) {
        baseName += `7${encodeFilePathComponent(key)}=${encodeFilePathComponent(value)}`;
      }
      const outFileUrl = setUrlBasename(generatedUrlObject, baseName);
      let outFilePath = urlToFileSystemPath(outFileUrl);
      outFilePath = truncate(outFilePath, 2055); // for windows
      writeFileSync(outFilePath, urlInfo.content, { force: true });
    }
    const { sourcemapGeneratedUrl, sourcemapReference } = urlInfo;
    if (sourcemapGeneratedUrl && sourcemapReference) {
      writeFileSync(
        new URL(sourcemapGeneratedUrl),
        sourcemapReference.urlInfo.content,
      );
    }
  };

  const applySourcemapOnContent = (
    urlInfo,
    formatSource = formatSourcemapSource,
  ) => {
    if (!urlInfo.sourcemap || !shouldHandleSourcemap(urlInfo)) {
      return;
    }

    // during build this function can be called after the file is cooked
    // - to update content and sourcemap after "optimize" hook
    // - to inject versioning into the entry point content
    // in this scenarion we don't want to inject sourcemap reference
    // just update the content

    let sourcemapReference = urlInfo.sourcemapReference;
    if (!sourcemapReference) {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (referenceToOther.type === "sourcemap_comment") {
          sourcemapReference = referenceToOther;
          break;
        }
      }
      if (!sourcemapReference) {
        sourcemapReference = urlInfo.dependencies.inject({
          trace: {
            message: `sourcemap comment placeholder`,
            url: urlInfo.url,
          },
          type: "sourcemap_comment",
          subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
          expectedType: "sourcemap",
          specifier: urlInfo.sourcemapGeneratedUrl,
          isInline: sourcemaps === "inline",
        });
      }
      urlInfo.sourcemapReference = sourcemapReference;
    }
    const sourcemapUrlInfo = sourcemapReference.urlInfo;
    // It's possible urlInfo content to be modified after being finalized
    // In that case we'll recompose sourcemaps (and re-append it to file content)
    // Recomposition is done on urlInfo.sourcemap and must be done with absolute urls inside .sources
    // (so we can detect if sources are identical)
    // For this reason we must not mutate urlInfo.sourcemap.sources
    const sourcemapGenerated = {
      ...urlInfo.sourcemap,
      sources: urlInfo.sourcemap.sources.map((source) => {
        const sourceFormatted = formatSource
          ? formatSource(source, urlInfo)
          : source;
        if (sourcemapsSourcesProtocol) {
          if (sourceFormatted.startsWith("file:///")) {
            return `${sourcemapsSourcesProtocol}${sourceFormatted.slice(
              "file:///".length,
            )}`;
          }
        }
        return sourceFormatted;
      }),
    };
    sourcemapUrlInfo.type = "sourcemap";
    sourcemapUrlInfo.contentType = "application/json";
    setContentProperties(sourcemapUrlInfo, {
      content: JSON.stringify(sourcemapGenerated, null, "  "),
    });

    if (!urlInfo.sourcemapIsWrong) {
      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier =
          generateSourcemapDataUrl(sourcemapGenerated);
      }
      if (shouldUpdateSourcemapComment(urlInfo, sourcemaps)) {
        let specifier;
        if (sourcemaps === "file" && sourcemapsComment === "relative") {
          specifier = urlToRelativeUrl(
            sourcemapReference.generatedUrl,
            urlInfo.generatedUrl,
          );
        } else {
          specifier = sourcemapReference.generatedSpecifier;
        }
        setContentProperties(urlInfo, {
          content: SOURCEMAP.writeComment({
            contentType: urlInfo.contentType,
            content: urlInfo.content,
            specifier,
          }),
        });
      }
    }
  };

  const endTransformations = (urlInfo, transformations) => {
    if (transformations) {
      applyTransformations(urlInfo, transformations);
    }
    const { contentInjections } = urlInfo;
    if (contentInjections && Object.keys(contentInjections).length > 0) {
      const injectionTransformations = applyContentInjections(
        urlInfo.content,
        contentInjections,
        urlInfo,
      );
      applyTransformations(urlInfo, injectionTransformations);
    }
    applyContentEffects(urlInfo);
    urlInfo.contentFinalized = true;
  };

  return {
    resetContent,
    setContent,
    applyTransformations,
    applySourcemapOnContent,
    endTransformations,
  };
};

// https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4
const illegalRe = /[/?<>\\:*|"]/g;
// eslint-disable-next-line no-control-regex
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const encodeFilePathComponent = (input, replacement = "") => {
  const encoded = input
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement);
  return encoded;
};
const truncate = (sanitized, length) => {
  const uint8Array = new TextEncoder().encode(sanitized);
  const truncated = uint8Array.slice(0, length);
  return new TextDecoder().decode(truncated);
};

const shouldUpdateSourcemapComment = (urlInfo, sourcemaps) => {
  if (urlInfo.context.buildStep === "shape") {
    return false;
  }
  if (sourcemaps === "file" || sourcemaps === "inline") {
    return true;
  }
  return false;
};
const mayHaveSourcemap = (urlInfo) => {
  if (urlInfo.url.startsWith("data:")) {
    return false;
  }
  if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
    return false;
  }
  return true;
};
const shouldHandleSourcemap = (urlInfo) => {
  const { sourcemaps } = urlInfo.context;
  if (
    sourcemaps !== "inline" &&
    sourcemaps !== "file" &&
    sourcemaps !== "programmatic"
  ) {
    return false;
  }
  return true;
};
