import { pathToFileURL } from "node:url";
import { parseJsWithAcorn } from "@jsenv/ast";
import { bufferToEtag } from "@jsenv/filesystem";
import { urlToRelativeUrl, isFileSystemPath } from "@jsenv/urls";
import {
  composeTwoSourcemaps,
  SOURCEMAP,
  generateSourcemapFileUrl,
  generateSourcemapDataUrl,
} from "@jsenv/sourcemap";

export const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  sourcemapsSourcesRelative,
  urlGraph,
  injectSourcemapPlaceholder,
  foundSourcemap,
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

  const defineGettersOnPropertiesDerivedFromContent = (urlInfo) => {
    const contentAstDescriptor = Object.getOwnPropertyDescriptor(
      urlInfo,
      "contentAst",
    );
    if (contentAstDescriptor.value === undefined) {
      defineVolaliteGetter(urlInfo, "contentAst", () => {
        if (urlInfo.content === urlInfo.originalContent) {
          return urlInfo.originalContentAst;
        }
        const ast = getContentAst(urlInfo.content, urlInfo.type, urlInfo.url);
        return ast;
      });
    }
    const contentEtagDescriptor = Object.getOwnPropertyDescriptor(
      urlInfo,
      "contentEtag",
    );
    if (contentEtagDescriptor.value === undefined) {
      defineVolaliteGetter(urlInfo, "contentEtag", () => {
        if (urlInfo.content === urlInfo.originalContent) {
          return urlInfo.originalContentEtag;
        }
        return getContentEtag(urlInfo.content);
      });
    }
  };

  const initTransformations = async (
    urlInfo,
    {
      content,
      contentAst, // most of the time will be undefined
      contentEtag, // in practice it's always undefined
      originalContent,
      originalContentAst, // most of the time will be undefined
      originalContentEtag, // in practice always undefined
    },
    context,
  ) => {
    urlInfo.contentFinalized = false;
    urlInfo.originalContentAst = originalContentAst;
    urlInfo.originalContentEtag = originalContentEtag;
    if (originalContent !== urlInfo.originalContent) {
      urlInfo.originalContent = originalContent;
      const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
        urlInfo,
        "originalContentAst",
      );
      if (originalContentAstDescriptor.value === undefined) {
        defineVolaliteGetter(urlInfo, "originalContentAst", () => {
          return getContentAst(
            urlInfo.originalContent,
            urlInfo.type,
            urlInfo.url,
          );
        });
      }
      const originalContentEtagDescriptor = Object.getOwnPropertyDescriptor(
        urlInfo,
        "originalContentEtag",
      );
      if (originalContentEtagDescriptor.value === undefined) {
        defineVolaliteGetter(urlInfo, "originalContentEtag", () => {
          return bufferToEtag(Buffer.from(urlInfo.originalContent));
        });
      }
    }

    urlInfo.contentAst = contentAst;
    urlInfo.contentEtag = contentEtag;
    urlInfo.content = content;
    defineGettersOnPropertiesDerivedFromContent(urlInfo);

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
    // For this reason sourcemap are not added to urlInfo.references
    // Instead they are stored into urlInfo.sourcemapReference
    // create a placeholder reference for the sourcemap that will be generated
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory
    const generatedUrlObject = new URL(urlInfo.generatedUrl);
    generatedUrlObject.searchParams.delete("js_module_fallback");
    generatedUrlObject.searchParams.delete("as_js_module");
    generatedUrlObject.searchParams.delete("as_js_classic");
    const urlForSourcemap = generatedUrlObject.href;
    urlInfo.sourcemapGeneratedUrl = generateSourcemapFileUrl(urlForSourcemap);
    // already loaded during "load" hook (happens during build)
    if (urlInfo.sourcemap) {
      const [sourcemapReference, sourcemapUrlInfo] = injectSourcemapPlaceholder(
        {
          urlInfo,
          specifier: urlInfo.sourcemapGeneratedUrl,
        },
      );
      sourcemapUrlInfo.isInline = sourcemaps === "inline";
      urlInfo.sourcemapReference = sourcemapReference;
      urlInfo.sourcemap = normalizeSourcemap(urlInfo, urlInfo.sourcemap);
      return;
    }
    // check for existing sourcemap for this content
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    });
    if (sourcemapFound) {
      const { type, line, column, specifier } = sourcemapFound;
      const [sourcemapReference, sourcemapUrlInfo] = foundSourcemap({
        urlInfo,
        type,
        specifier,
        specifierLine: line,
        specifierColumn: column,
      });
      try {
        await context.cook(sourcemapUrlInfo, { reference: sourcemapReference });
        const sourcemapRaw = JSON.parse(sourcemapUrlInfo.content);
        const sourcemap = normalizeSourcemap(urlInfo, sourcemapRaw);
        urlInfo.sourcemap = sourcemap;
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    } else {
      const [, sourcemapUrlInfo] = injectSourcemapPlaceholder({
        urlInfo,
        specifier: urlInfo.sourcemapGeneratedUrl,
      });
      sourcemapUrlInfo.isInline = sourcemaps === "inline";
    }
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
      urlInfo.content = content;
      urlInfo.contentAst = contentAst;
      urlInfo.contentEtag = contentEtag;
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
      applyTransformationsEffects(urlInfo);
    }
  };

  const applyTransformationsEffects = (urlInfo) => {
    urlInfo.contentFinalized = true;
    if (urlInfo.sourcemapReference) {
      if (
        sourcemapsEnabled &&
        urlInfo.sourcemap &&
        !urlInfo.generatedUrl.startsWith("data:")
      ) {
        // during build this function can be called after the file is cooked
        // - to update content and sourcemap after "optimize" hook
        // - to inject versioning into the entry point content
        // in this scenarion we don't want to call injectSourcemap
        // just update the content and the
        const sourcemapReference = urlInfo.sourcemapReference;
        const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url);
        sourcemapUrlInfo.contentType = "application/json";
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
      } else {
        // in the end we don't use the sourcemap placeholder
        urlGraph.deleteUrlInfo(urlInfo.sourcemapReference.url);
      }
    }
  };

  return {
    initTransformations,
    applyTransformations,
    applyTransformationsEffects,
  };
};

const defineVolaliteGetter = (object, property, getter) => {
  const restore = (value) => {
    Object.defineProperty(object, property, {
      enumerable: true,
      configurable: true,
      writable: true,
      value,
    });
  };

  Object.defineProperty(object, property, {
    enumerable: true,
    configurable: true,
    get: () => {
      const value = getter();
      restore();
      return value;
    },
    set: restore,
  });
};

const getContentAst = (content, type, url) => {
  if (type === "js_module") {
    return parseJsWithAcorn({
      js: content,
      url,
      isJsModule: true,
    });
  }
  if (type === "js_classic") {
    return parseJsWithAcorn({
      js: content,
      url,
    });
  }
  return null;
};

const getContentEtag = (content) => {
  return bufferToEtag(Buffer.from(content));
};
