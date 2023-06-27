import { pathToFileURL } from "node:url";
import { urlToRelativeUrl, isFileSystemPath } from "@jsenv/urls";
import {
  composeTwoSourcemaps,
  SOURCEMAP,
  generateSourcemapFileUrl,
  generateSourcemapDataUrl,
} from "@jsenv/sourcemap";
import {
  defineGettersOnPropertiesDerivedFromOriginalContent,
  defineGettersOnPropertiesDerivedFromContent,
} from "./url_content.js";

export const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
}) => {
  if (sourcemapsSourcesProtocol === undefined) {
    sourcemapsSourcesProtocol = "file:///";
  }
  if (sourcemapsSourcesContent === undefined) {
    sourcemapsSourcesContent = true;
  }

  const sourcemapsEnabled =
    sourcemaps === "inline" ||
    sourcemaps === "file" ||
    sourcemaps === "programmatic";

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
    urlInfo.content = undefined;
    urlInfo.sourcemap = null;
    urlInfo.sourcemapIsWrong = null;
    urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
      const referencedUrlInfo = referenceToOther.urlInfo;
      if (referencedUrlInfo.isInline) {
        referencedUrlInfo.deleteFromGraph();
      }
    });
  };

  const setContent = async (
    urlInfo,
    content,
    {
      contentAst, // most of the time will be undefined
      contentEtag, // in practice it's always undefined
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

    urlInfo.contentAst = contentAst;
    urlInfo.contentEtag = contentEtag;
    urlInfo.content = content;
    defineGettersOnPropertiesDerivedFromContent(urlInfo);

    urlInfo.sourcemap = sourcemap;
    if (!sourcemapsEnabled) {
      return;
    }
    if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
      return;
    }
    if (urlInfo.generatedUrl.startsWith("data:")) {
      return;
    }
    // sourcemap is a special kind of reference:
    // It's a reference to a content generated dynamically the content itself.
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    const generatedUrlObject = new URL(urlInfo.generatedUrl);
    generatedUrlObject.searchParams.delete("js_module_fallback");
    generatedUrlObject.searchParams.delete("as_js_module");
    generatedUrlObject.searchParams.delete("as_js_classic");
    const urlForSourcemap = generatedUrlObject.href;
    urlInfo.sourcemapGeneratedUrl = generateSourcemapFileUrl(urlForSourcemap);

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
      sourcemap,
      sourcemapIsWrong,
    } = transformations;
    if (type) {
      urlInfo.type = type;
    }
    if (contentType) {
      urlInfo.contentType = contentType;
    }
    if (content && content !== urlInfo.content) {
      urlInfo.contentAst = contentAst;
      urlInfo.contentEtag = contentEtag;
      urlInfo.content = content;
      defineGettersOnPropertiesDerivedFromContent(urlInfo);
    }
    if (sourcemapsEnabled && sourcemap) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      const finalSourcemap = composeTwoSourcemaps(
        urlInfo.sourcemap,
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

    if (urlInfo.contentFinalized) {
      applySourcemapOnContent(urlInfo);
    }
  };

  const applySourcemapOnContent = (urlInfo) => {
    if (!sourcemapsEnabled) {
      return;
    }
    if (!urlInfo.sourcemap) {
      return;
    }
    if (urlInfo.generatedUrl.startsWith("data:")) {
      return;
    }

    // during build this function can be called after the file is cooked
    // - to update content and sourcemap after "optimize" hook
    // - to inject versioning into the entry point content
    // in this scenarion we don't want to inject sourcemap reference
    // just update the content

    let sourcemapReference = null;
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
    const sourcemapUrlInfo = sourcemapReference.urlInfo;

    const sourcemap = urlInfo.sourcemap;
    if (sourcemapsSourcesRelative) {
      sourcemap.sources = sourcemap.sources.map((source) => {
        const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
        return sourceRelative || ".";
      });
    }
    if (sourcemapsSourcesProtocol !== "file:///") {
      sourcemap.sources = sourcemap.sources.map((source) => {
        if (source.startsWith("file:///")) {
          return `${sourcemapsSourcesProtocol}${source.slice(
            "file:///".length,
          )}`;
        }
        return source;
      });
    }
    sourcemapUrlInfo.contentType = "application/json";
    sourcemapUrlInfo.content = JSON.stringify(sourcemap, null, "  ");

    if (!urlInfo.sourcemapIsWrong) {
      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier =
          generateSourcemapDataUrl(sourcemap);
      }
      if (sourcemaps === "file" || sourcemaps === "inline") {
        urlInfo.content = SOURCEMAP.writeComment({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier:
            sourcemaps === "file" && sourcemapsSourcesRelative
              ? urlToRelativeUrl(sourcemapReference.url, urlInfo.url)
              : sourcemapReference.generatedSpecifier,
        });
      }
    }
  };

  const endTransformations = (urlInfo, transformations) => {
    if (transformations) {
      applyTransformations(urlInfo, transformations);
    }
    applySourcemapOnContent(urlInfo);
    urlInfo.contentFinalized = true;
  };

  return {
    resetContent,
    setContent,
    applyTransformations,
    endTransformations,
  };
};
