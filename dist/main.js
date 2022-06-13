import { parentPort } from "node:worker_threads";
import { urlToRelativeUrl, normalizeStructuredMetaMap, urlToMeta, registerFileLifecycle, urlIsInsideOf, urlToExtension, urlToFilename, readFileSync as readFileSync$1, fileSystemPathToUrl, urlToFileSystemPath, isFileSystemPath, bufferToEtag, writeFileSync, ensureWindowsDriveLetter, moveUrl, collectFiles, assertAndNormalizeDirectoryUrl, registerDirectoryLifecycle, resolveUrl, writeFile, ensureEmptyDirectory, writeDirectory, resolveDirectoryUrl, urlToBasename } from "@jsenv/filesystem";
import { createDetailedMessage, createLogger, loggerToLevels } from "@jsenv/logger";
import { createTaskLog, ANSI, msAsDuration, msAsEllapsedTime, byteAsMemoryUsage, UNICODE, createLog, startSpinner, distributePercentages, byteAsFileSize } from "@jsenv/log";
import { getCallerPosition } from "@jsenv/utils/src/caller_position.js";
import { initReloadableProcess } from "@jsenv/utils/process_reload/process_reload.js";
import { parseHtmlString, stringifyHtmlAst, visitHtmlAst, getHtmlNodeAttributeByName, htmlNodePosition, findNode, getHtmlNodeTextNode, removeHtmlNode, setHtmlNodeGeneratedText, removeHtmlNodeAttributeByName, parseScriptNode, injectScriptAsEarlyAsPossible, createHtmlNode, removeHtmlNodeText, assignHtmlNodeAttributes, parseLinkNode } from "@jsenv/utils/html_ast/html_ast.js";
import { htmlAttributeSrcSet } from "@jsenv/utils/html_ast/html_attribute_src_set.js";
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js";
import { applyPostCss } from "@jsenv/utils/css_ast/apply_post_css.js";
import { postCssPluginUrlVisitor } from "@jsenv/utils/css_ast/postcss_plugin_url_visitor.js";
import { parseJsUrls } from "@jsenv/utils/js_ast/parse_js_urls.js";
import { resolveImport, normalizeImportMap, composeTwoImportMaps } from "@jsenv/importmap";
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js";
import { applyNodeEsmResolution, defaultLookupPackageScope, defaultReadPackageJson, readCustomConditionsFromProcessArgs, applyFileSystemMagicResolution } from "@jsenv/node-esm-resolution";
import { statSync, readdirSync, readFileSync, realpathSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ensurePathnameTrailingSlash, injectQueryParams, injectQueryParamsIntoSpecifier, normalizeUrl, setUrlFilename, asUrlWithoutSearch, asUrlUntilPathname } from "@jsenv/utils/urls/url_utils.js";
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js";
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js";
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js";
import { DataUrl } from "@jsenv/utils/urls/data_url.js";
import { transpileWithParcel, minifyWithParcel } from "@jsenv/utils/css_ast/parcel_css.js";
import { fetchOriginalUrlInfo } from "@jsenv/utils/graph/fetch_original_url_info.js";
import { createRequire } from "node:module";
import { r as requireBabelPlugin, j as jsenvPluginBabel, b as babelHelperNameFromUrl, R as RUNTIME_COMPAT } from "./js/babel_helpers.js";
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js";
import babelParser from "@babel/parser";
import { sortByDependencies } from "@jsenv/utils/graph/sort_by_dependencies.js";
import { applyRollupPlugins } from "@jsenv/utils/js_ast/apply_rollup_plugins.js";
import { sourcemapConverter } from "@jsenv/utils/sourcemap/sourcemap_converter.js";
import { createCallbackList, createCallbackListNotifiedOnce, Abort, raceCallbacks, raceProcessTeardownEvents } from "@jsenv/abort";
import { createSSEService } from "@jsenv/utils/event_source/sse_service.js";
import { stringifyUrlSite } from "@jsenv/utils/urls/url_trace.js";
import { timeStart, fetchFileSystem, composeTwoResponses, serveDirectory, startServer, pluginCORS, jsenvAccessControlAllowedHeaders, pluginServerTiming, pluginRequestWaitingCheck, composeServices, findFreePort } from "@jsenv/server";
import { SOURCEMAP, generateSourcemapUrl, sourcemapToBase64Url } from "@jsenv/utils/sourcemap/sourcemap_utils.js";
import { validateResponseIntegrity } from "@jsenv/integrity";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js";
import { memoizeByFirstArgument } from "@jsenv/utils/memoize/memoize_by_first_argument.js";
import { generateCoverageJsonFile } from "@jsenv/utils/coverage/coverage_reporter_json_file.js";
import { generateCoverageHtmlDirectory } from "@jsenv/utils/coverage/coverage_reporter_html_directory.js";
import { generateCoverageTextLog } from "@jsenv/utils/coverage/coverage_reporter_text_log.js";
import { memoryUsage } from "node:process";
import wrapAnsi from "wrap-ansi";
import stripAnsi from "strip-ansi";
import cuid from "cuid";
import { babelPluginInstrument } from "@jsenv/utils/coverage/babel_plugin_instrument.js";
import { reportToCoverage } from "@jsenv/utils/coverage/report_to_coverage.js";
import v8 from "node:v8";
import { runInNewContext, Script } from "node:vm";
import { memoize } from "@jsenv/utils/memoize/memoize.js";
import { filterV8Coverage } from "@jsenv/utils/coverage/v8_coverage_from_directory.js";
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/utils/coverage/istanbul_coverage_composition.js";
import { escapeRegexpSpecialChars } from "@jsenv/utils/string/escape_regexp_special_chars.js";
import { fork } from "node:child_process";
import { uneval } from "@jsenv/uneval";
import { createVersionGenerator } from "@jsenv/utils/versioning/version_generator.js";
import "@jsenv/utils/semantic_versioning/highest_version.js";
import "@jsenv/utils/js_ast/babel_utils.js";

const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.data.rawUrl || urlInfo.url;
  const content = urlInfo.content;
  const {
    scenario,
    referenceUtils
  } = context;
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: scenario !== "build"
  });
  const actions = [];
  visitHtmlUrls({
    url,
    htmlAst,
    onUrl: ({
      type,
      subtype,
      expectedType,
      line,
      column,
      originalLine,
      originalColumn,
      specifier,
      attribute
    }) => {
      const isRessourceHint = ["preconnect", "dns-prefetch", "prefetch", "preload", "modulepreload"].includes(subtype);
      const [reference] = referenceUtils.found({
        type,
        expectedType,
        originalLine,
        originalColumn,
        specifier,
        specifierLine: line,
        specifierColumn: column,
        isRessourceHint
      });
      actions.push(async () => {
        attribute.value = await referenceUtils.readGeneratedSpecifier(reference);
      });
    }
  });

  if (actions.length === 0) {
    return null;
  }

  await Promise.all(actions.map(action => action()));
  return {
    content: stringifyHtmlAst(htmlAst)
  };
};

const visitHtmlUrls = ({
  url,
  htmlAst,
  onUrl
}) => {
  const addDependency = ({
    type,
    subtype,
    expectedType,
    node,
    attribute,
    specifier
  }) => {
    const generatedFromInlineContent = Boolean(getHtmlNodeAttributeByName(node, "generated-from-inline-content"));
    let position;

    if (generatedFromInlineContent) {
      // when generated from inline content,
      // line, column is not "src" nor "generated-from-src" but "original-position"
      position = htmlNodePosition.readNodePosition(node);
    } else {
      position = htmlNodePosition.readAttributePosition(node, attribute.name);
    }

    const {
      line,
      column // originalLine, originalColumn

    } = position;
    onUrl({
      type,
      subtype,
      expectedType,
      line,
      column,
      // originalLine, originalColumn
      specifier,
      attribute,
      // injected:Boolean(getHtmlNodeAttributeByName(node, "injected-by"))
      // srcGeneratedFromInlineContent
      ...readFetchMetas(node)
    });
  };

  const visitors = {
    link: node => {
      const relAttribute = getHtmlNodeAttributeByName(node, "rel");
      const rel = relAttribute ? relAttribute.value : undefined;
      const typeAttribute = getHtmlNodeAttributeByName(node, "type");
      const type = typeAttribute ? typeAttribute.value : undefined;
      visitAttributeAsUrlSpecifier({
        type: "link_href",
        subtype: rel,
        node,
        attributeName: "href",
        expectedContentType: type,
        expectedType: {
          manifest: "webmanifest",
          modulepreload: "js_module",
          stylesheet: "css"
        }[rel]
      });
    },
    // style: () => {},
    script: node => {
      const typeAttributeNode = getHtmlNodeAttributeByName(node, "type");
      visitAttributeAsUrlSpecifier({
        type: "script_src",
        expectedType: {
          "undefined": "js_classic",
          "text/javascript": "js_classic",
          "module": "js_module",
          "importmap": "importmap"
        }[typeAttributeNode ? typeAttributeNode.value : undefined],
        node,
        attributeName: "src"
      });
    },
    a: node => {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href"
      });
    },
    iframe: node => {
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src"
      });
    },
    img: node => {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src"
      });
      visitSrcset({
        type: "img_srcset",
        node
      });
    },
    souce: node => {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src"
      });
      visitSrcset({
        type: "source_srcset",
        node
      });
    },
    // svg <image> tag
    image: node => {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href"
      });
    },
    use: node => {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href"
      });
    }
  };

  const visitAttributeAsUrlSpecifier = ({
    type,
    subtype,
    expectedType,
    node,
    attributeName
  }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName);
    const value = attribute ? attribute.value : undefined;

    if (value) {
      const generatedBy = getHtmlNodeAttributeByName(node, "generated-by");

      if (generatedBy) {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return;
      }

      addDependency({
        type,
        subtype,
        expectedType,
        node,
        attribute,
        specifier: attributeName === "generated-from-src" || attributeName === "generated-from-href" ? new URL(value, url).href : value
      });
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
        node,
        attributeName: "generated-from-src"
      });
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
        node,
        attributeName: "generated-from-href"
      });
    }
  };

  const visitSrcset = ({
    type,
    node
  }) => {
    const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset");
    const srcset = srcsetAttribute ? srcsetAttribute.value : undefined;

    if (srcset) {
      const srcCandidates = htmlAttributeSrcSet.parse(srcset);
      srcCandidates.forEach(srcCandidate => {
        addDependency({
          type,
          node,
          attribute: srcsetAttribute,
          specifier: srcCandidate.specifier
        });
      });
    }
  };

  visitHtmlAst(htmlAst, node => {
    const visitor = visitors[node.nodeName];

    if (visitor) {
      visitor(node);
    }
  });
};

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"];
const integrityCompatibleTagNames = ["script", "link", "img", "source"];

const readFetchMetas = node => {
  const meta = {};

  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossoriginAttribute = getHtmlNodeAttributeByName(node, "crossorigin");
    meta.crossorigin = crossoriginAttribute ? crossoriginAttribute.value : undefined;
  }

  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity");
    meta.integrity = integrityAttribute ? integrityAttribute.value : undefined;
  }

  return meta;
};

/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */
const parseAndTransformCssUrls = async (urlInfo, context) => {
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  await applyPostCss({
    sourcemaps: false,
    plugins: [postCssPluginUrlVisitor({
      urlVisitor: ({
        type,
        specifier,
        specifierStart,
        specifierEnd,
        specifierLine,
        specifierColumn
      }) => {
        const [reference] = context.referenceUtils.found({
          type: `css_${type}`,
          specifier,
          specifierStart,
          specifierEnd,
          specifierLine,
          specifierColumn
        });
        actions.push(async () => {
          magicSource.replace({
            start: specifierStart,
            end: specifierEnd,
            replacement: await context.referenceUtils.readGeneratedSpecifier(reference)
          });
        });
      }
    })],
    url: urlInfo.data.rawUrl || urlInfo.url,
    content: urlInfo.content
  });
  await Promise.all(actions.map(action => action()));
  return magicSource.toContentAndSourcemap();
};

// the following apis are creating js entry points:
// - new Worker()
// - new SharedWorker()
// - navigator.serviceWorker.register()
const isWebWorkerEntryPointReference = reference => {
  if (reference.subtype === "new_url_first_arg") {
    return ["worker", "service_worker", "shared_worker"].includes(reference.expectedSubtype);
  }

  return ["new_worker_first_arg", "new_shared_worker_first_arg", "service_worker_register_first_arg"].includes(reference.subtype);
};
const isWebWorkerUrlInfo = urlInfo => {
  return urlInfo.subtype === "worker" || urlInfo.subtype === "service_worker" || urlInfo.subtype === "shared_worker";
}; // export const isEntryPoint = (urlInfo, urlGraph) => {
//   if (urlInfo.data.isEntryPoint) {
//     return true
//   }
//   if (isWebWorker(urlInfo)) {
//     // - new Worker("a.js") -> "a.js" is an entry point
//     // - self.importScripts("b.js") -> "b.js" is not an entry point
//     // So the following logic applies to infer if the file is a web worker entry point
//     // "When a non-webworker file references a worker file, the worker file is an entry point"
//     const dependents = Array.from(urlInfo.dependents)
//     return dependents.some((dependentUrl) => {
//       const dependentUrlInfo = urlGraph.getUrlInfo(dependentUrl)
//       return !isWebWorker(dependentUrlInfo)
//     })
//   }
//   return false
// }

const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.data && urlInfo.data.rawUrl || urlInfo.url,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo)
  });
  const {
    rootDirectoryUrl,
    referenceUtils
  } = context;
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  urlInfo.data.usesImport = false;
  urlInfo.data.usesExport = false;
  urlInfo.data.usesImportAssertion = false;
  jsMentions.forEach(jsMention => {
    if (jsMention.assert) {
      urlInfo.data.usesImportAssertion = true;
    }

    if (jsMention.subtype === "import_static" || jsMention.subtype === "import_dynamic") {
      urlInfo.data.usesImport = true;
    }

    if (jsMention.subtype === "export") {
      urlInfo.data.usesExport = true;
    }

    const [reference] = referenceUtils.found({
      type: jsMention.type,
      subtype: jsMention.subtype,
      expectedType: jsMention.expectedType,
      expectedSubtype: jsMention.expectedSubtype || urlInfo.subtype,
      specifier: jsMention.specifier,
      specifierStart: jsMention.specifierStart,
      specifierEnd: jsMention.specifierEnd,
      specifierLine: jsMention.specifierLine,
      specifierColumn: jsMention.specifierColumn,
      data: jsMention.data,
      baseUrl: {
        "StringLiteral": jsMention.baseUrl,
        "window.origin": rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url
      }[jsMention.baseUrlType],
      assert: jsMention.assert,
      assertNode: jsMention.assertNode,
      typePropertyNode: jsMention.typePropertyNode
    });
    actions.push(async () => {
      const replacement = await referenceUtils.readGeneratedSpecifier(reference);
      magicSource.replace({
        start: jsMention.specifierStart,
        end: jsMention.specifierEnd,
        replacement
      });

      if (reference.mutation) {
        reference.mutation(magicSource);
      }
    });
  });
  await Promise.all(actions.map(action => action()));
  const {
    content,
    sourcemap
  } = magicSource.toContentAndSourcemap();
  return {
    content,
    sourcemap
  };
};

const parseAndTransformWebmanifestUrls = async (urlInfo, context) => {
  const content = urlInfo.content;
  const manifest = JSON.parse(content);
  const actions = [];
  const {
    icons = []
  } = manifest;
  icons.forEach(icon => {
    const [reference] = context.referenceUtils.found({
      type: "webmanifest_icon_src",
      specifier: icon.src
    });
    actions.push(async () => {
      icon.src = await context.referenceUtils.readGeneratedSpecifier(reference);
    });
  });

  if (actions.length === 0) {
    return null;
  }

  await Promise.all(actions.map(action => action()));
  return JSON.stringify(manifest, null, "  ");
};

const jsenvPluginUrlAnalysis = ({
  rootDirectoryUrl,
  include
}) => {
  let getIncludeInfo = () => undefined;

  if (include) {
    const includeMetaMap = normalizeStructuredMetaMap({
      include
    }, rootDirectoryUrl);

    getIncludeInfo = url => {
      const meta = urlToMeta({
        url,
        structuredMetaMap: includeMetaMap
      });
      return meta.include;
    };
  }

  return {
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: reference => {
      if (reference.specifier[0] === "#") {
        reference.shouldHandle = false;
        return;
      }

      const includeInfo = getIncludeInfo(reference.url);

      if (includeInfo === true) {
        reference.shouldHandle = true;
        return;
      }

      if (includeInfo === false) {
        reference.shouldHandle = false;
        return;
      }

      if (reference.url.startsWith("data:")) {
        reference.shouldHandle = true;
        return;
      }

      if (reference.url.startsWith("file:")) {
        reference.shouldHandle = true;
        return;
      }
    },
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
      directory: (urlInfo, context) => {
        const originalDirectoryReference = findOriginalDirectoryReference(urlInfo, context);
        const directoryRelativeUrl = urlToRelativeUrl(urlInfo.url, context.rootDirectoryUrl);
        JSON.parse(urlInfo.content).forEach(directoryEntry => {
          context.referenceUtils.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: directoryEntry,
            trace: `"${directoryRelativeUrl}${directoryEntry}" entry in directory referenced by ${originalDirectoryReference.trace}`
          });
        });
      }
    }
  };
};

const findOriginalDirectoryReference = (urlInfo, context) => {
  const findNonFileSystemAncestor = urlInfo => {
    for (const dependentUrl of urlInfo.dependents) {
      const dependentUrlInfo = context.urlGraph.getUrlInfo(dependentUrl);

      if (dependentUrlInfo.type !== "directory") {
        return [dependentUrlInfo, urlInfo];
      }

      const found = findNonFileSystemAncestor(dependentUrlInfo);

      if (found) {
        return found;
      }
    }

    return [];
  };

  const [ancestor, child] = findNonFileSystemAncestor(urlInfo);

  if (!ancestor) {
    return null;
  }

  const ref = ancestor.references.find(ref => ref.url === child.url);
  return ref;
};

const jsenvPluginLeadingSlash = () => {
  return {
    name: "jsenv:leading_slash",
    appliesDuring: "*",
    resolveUrl: (reference, context) => {
      if (reference.specifier[0] !== "/") {
        return null;
      }

      return new URL(reference.specifier.slice(1), context.rootDirectoryUrl).href;
    }
  };
};

/*
 * Plugin to read and apply importmap files found in html files.
 * - feeds importmap files to jsenv kitchen
 * - use importmap to resolve import (when there is one + fallback to other resolution mecanism)
 * - inline importmap with [src=""]
 *
 * A correct importmap resolution should scope importmap resolution per html file.
 * It would be doable by adding ?html_id to each js file in order to track
 * the html file importing it.
 * Considering it happens only when all the following conditions are met:
 * - 2+ html files are using an importmap
 * - the importmap used is not the same
 * - the importmap contain conflicting mappings
 * - these html files are both executed during the same scenario (dev, test, build)
 * And that it would be ugly to see ?html_id all over the place
 * -> The importmap resolution implemented here takes a shortcut and does the following:
 * - All importmap found are merged into a single one that is applied to every import specifiers
 */
const jsenvPluginImportmap = () => {
  let finalImportmap = null;
  const importmaps = {};

  const onHtmlImportmapParsed = (importmap, htmlUrl) => {
    importmaps[htmlUrl] = importmap ? normalizeImportMap(importmap, htmlUrl) : null;
    finalImportmap = Object.keys(importmaps).reduce((previous, url) => {
      const importmap = importmaps[url];

      if (!previous) {
        return importmap;
      }

      if (!importmap) {
        return previous;
      }

      return composeTwoImportMaps(previous, importmap);
    }, null);
  };

  return {
    name: "jsenv:importmap",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: reference => {
        if (!finalImportmap) {
          return null;
        }

        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.parentUrl,
            importMap: finalImportmap,
            onImportMapping: () => {
              fromMapping = true;
            }
          });

          if (fromMapping) {
            return result;
          }

          return null;
        } catch (e) {
          if (e.message.includes("bare specifier")) {
            // in theory we should throw to be compliant with web behaviour
            // but for now it's simpler to return null
            // and let a chance to other plugins to handle the bare specifier
            // (node esm resolution)
            // and we want importmap to be prio over node esm so we cannot put this plugin after
            return null;
          }

          throw e;
        }
      }
    },
    transformUrlContent: {
      html: async (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const importmap = findNode(htmlAst, node => {
          if (node.nodeName !== "script") {
            return false;
          }

          const typeAttribute = getHtmlNodeAttributeByName(node, "type");

          if (!typeAttribute || typeAttribute.value !== "importmap") {
            return false;
          }

          return true;
        });

        if (!importmap) {
          onHtmlImportmapParsed(null, htmlUrlInfo.url);
          return null;
        }

        const handleInlineImportmap = async (importmap, textNode) => {
          const {
            line,
            column,
            lineEnd,
            columnEnd,
            isOriginal
          } = htmlNodePosition.readNodePosition(importmap, {
            preferOriginal: true
          });
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd
          });
          const [inlineImportmapReference, inlineImportmapUrlInfo] = context.referenceUtils.foundInline({
            type: "script_src",
            isOriginalPosition: isOriginal,
            specifierLine: line - 1,
            specifierColumn: column,
            specifier: inlineImportmapUrl,
            contentType: "application/importmap+json",
            content: textNode.value
          });
          await context.cook(inlineImportmapUrlInfo, {
            reference: inlineImportmapReference
          });
          setHtmlNodeGeneratedText(importmap, {
            generatedText: inlineImportmapUrlInfo.content,
            generatedBy: "jsenv:importmap"
          });
          onHtmlImportmapParsed(JSON.parse(inlineImportmapUrlInfo.content), htmlUrlInfo.url);
        };

        const handleImportmapWithSrc = async (importmap, src) => {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this situation the ref to the importmap was already discovered
          // when parsing the HTML
          const importmapReference = context.referenceUtils.findByGeneratedSpecifier(src);
          const importmapUrlInfo = context.urlGraph.getUrlInfo(importmapReference.url);
          await context.cook(importmapUrlInfo, {
            reference: importmapReference
          });
          onHtmlImportmapParsed(JSON.parse(importmapUrlInfo.content), htmlUrlInfo.url);
          removeHtmlNodeAttributeByName(importmap, "src");
          setHtmlNodeGeneratedText(importmap, {
            generatedText: importmapUrlInfo.content,
            generatedBy: "jsenv:importmap",
            generatedFromSrc: src
          });
          const {
            line,
            column,
            lineEnd,
            columnEnd,
            isOriginal
          } = htmlNodePosition.readNodePosition(importmap, {
            preferOriginal: true
          });
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd
          });
          context.referenceUtils.becomesInline(importmapReference, {
            line: line - 1,
            column,
            isOriginal,
            specifier: inlineImportmapUrl,
            contentType: "application/importmap+json",
            content: importmapUrlInfo.content
          });
        };

        const srcAttribute = getHtmlNodeAttributeByName(importmap, "src");
        const src = srcAttribute ? srcAttribute.value : undefined;

        if (src) {
          await handleImportmapWithSrc(importmap, src);
        } else {
          const textNode = getHtmlNodeTextNode(importmap);

          if (textNode) {
            await handleInlineImportmap(importmap, textNode);
          }
        } // once this plugin knows the importmap, it will use it
        // to map imports. These import specifiers will be normalized
        // by "formatReferencedUrl" making the importmap presence useless.
        // In dev/test we keep importmap into the HTML to see it even if useless
        // Duing build we get rid of it


        if (context.scenario === "build") {
          removeHtmlNode(importmap);
        }

        return {
          content: stringifyHtmlAst(htmlAst)
        };
      }
    }
  };
};

const jsenvPluginUrlResolution = () => {
  const urlResolver = reference => {
    return new URL(reference.specifier, reference.baseUrl || reference.parentUrl).href;
  };

  return {
    name: "jsenv:url_resolution",
    appliesDuring: "*",
    resolveUrl: {
      "entry_point": urlResolver,
      "link_href": urlResolver,
      "script_src": urlResolver,
      "a_href": urlResolver,
      "iframe_src": urlResolver,
      "img_src": urlResolver,
      "img_srcset": urlResolver,
      "source_src": urlResolver,
      "source_srcset": urlResolver,
      "image_href": urlResolver,
      "use_href": urlResolver,
      "css_@import": urlResolver,
      "css_url": urlResolver,
      "sourcemap_comment": urlResolver,
      "js_import_export": urlResolver,
      "js_url_specifier": urlResolver,
      "js_inline_content": urlResolver,
      "webmanifest_icon_src": urlResolver
    }
  };
};

/*
 * - should I restore eventual search params lost during node esm resolution
 * - what about symlinks?
 *   It feels like I should apply symlink (when we don't want to preserve them)
 *   once a file:/// url is found, regardless
 *   if that comes from node resolution or anything else (not even magic resolution)
 *   it should likely be an other plugin happening after the others
 */
const jsenvPluginNodeEsmResolution = ({
  rootDirectoryUrl,
  runtimeCompat,
  packageConditions,
  filesInvalidatingCache = ["package.json", "package-lock.json"]
}) => {
  const packageScopesCache = new Map();

  const lookupPackageScope = url => {
    const fromCache = packageScopesCache.get(url);

    if (fromCache) {
      return fromCache;
    }

    const packageScope = defaultLookupPackageScope(url);
    packageScopesCache.set(url, packageScope);
    return packageScope;
  };

  const packageJsonsCache = new Map();

  const readPackageJson = url => {
    const fromCache = packageJsonsCache.get(url);

    if (fromCache) {
      return fromCache;
    }

    const packageJson = defaultReadPackageJson(url);
    packageJsonsCache.set(url, packageJson);
    return packageJson;
  };
  filesInvalidatingCache.forEach(file => {
    registerFileLifecycle(new URL(file, rootDirectoryUrl), {
      added: () => {
        packageScopesCache.clear();
        packageJsonsCache.clear();
      },
      updated: () => {
        packageScopesCache.clear();
        packageJsonsCache.clear();
      },
      removed: () => {
        packageScopesCache.clear();
        packageJsonsCache.clear();
      },
      keepProcessAlive: false
    });
  });
  return [jsenvPluginNodeEsmResolver({
    runtimeCompat,
    packageConditions,
    lookupPackageScope,
    readPackageJson
  }), jsenvPluginNodeModulesVersionInUrls({
    lookupPackageScope,
    readPackageJson
  })];
};

const jsenvPluginNodeEsmResolver = ({
  runtimeCompat,
  packageConditions,
  lookupPackageScope,
  readPackageJson
}) => {
  const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node"); // https://nodejs.org/api/esm.html#resolver-algorithm-specification

  packageConditions = packageConditions || [...readCustomConditionsFromProcessArgs(), nodeRuntimeEnabled ? "node" : "browser", "import"];
  return {
    name: "jsenv:node_esm_resolve",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: reference => {
        const {
          parentUrl,
          specifier
        } = reference;
        const {
          url
        } = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl,
          specifier,
          lookupPackageScope,
          readPackageJson
        });
        return url;
      }
    },
    fetchUrlContent: urlInfo => {
      if (urlInfo.url.startsWith("file:///@ignore/")) {
        return {
          content: "export default {}"
        };
      }

      return null;
    }
  };
};

const jsenvPluginNodeModulesVersionInUrls = ({
  lookupPackageScope,
  readPackageJson
}) => {
  return {
    name: "jsenv:node_modules_version_in_urls",
    appliesDuring: {
      dev: true,
      test: true
    },
    transformUrlSearchParams: (reference, context) => {
      if (!reference.url.startsWith("file:")) {
        return null;
      } // without this check a file inside a project without package.json
      // could be considered as a node module if there is a ancestor package.json
      // but we want to version only node modules


      if (!reference.url.includes("/node_modules/")) {
        return null;
      }

      if (reference.searchParams.has("v")) {
        return null;
      }

      const packageUrl = lookupPackageScope(reference.url);

      if (!packageUrl) {
        return null;
      }

      if (packageUrl === context.rootDirectoryUrl) {
        return null;
      }

      const packageVersion = readPackageJson(packageUrl).version;

      if (!packageVersion) {
        // example where it happens: https://github.com/babel/babel/blob/2ce56e832c2dd7a7ed92c89028ba929f874c2f5c/packages/babel-runtime/helpers/esm/package.json#L2
        return null;
      }

      return {
        v: packageVersion
      };
    }
  };
};

const jsenvPluginUrlVersion = () => {
  return {
    name: "jsenv:url_version",
    appliesDuring: "*",
    redirectUrl: reference => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hmr to bypass browser cache
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const urlObject = new URL(reference.url);
      urlObject.searchParams.delete("v");
      return urlObject.href;
    },
    transformUrlSearchParams: reference => {
      if (!reference.data.version) {
        return null;
      }

      if (reference.searchParams.has("v")) {
        return null;
      }

      return {
        v: reference.data.version
      };
    }
  };
};

const jsenvPluginFileUrls = ({
  magicExtensions = ["inherit", ".js"],
  magicDirectoryIndex = true,
  preservesSymlink = true,
  directoryReferenceAllowed = false
}) => {
  const getExtensionsToTry = (magicExtensions, importer) => {
    const extensionsSet = new Set();
    magicExtensions.forEach(magicExtension => {
      if (magicExtension === "inherit") {
        const importerExtension = urlToExtension(importer);
        extensionsSet.add(importerExtension);
      } else {
        extensionsSet.add(magicExtension);
      }
    });
    return Array.from(extensionsSet.values());
  };

  return [{
    name: "jsenv:file_url_resolution",
    appliesDuring: "*",
    redirectUrl: reference => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }

      if (reference.isInline) {
        return null;
      }

      const urlObject = new URL(reference.url);
      let stat;

      try {
        stat = statSync(urlObject);
      } catch (e) {
        if (e.code === "ENOENT") {
          stat = null;
        } else {
          throw e;
        }
      }

      const {
        search,
        hash
      } = urlObject;

      const resolveSymlink = fileUrl => {
        const realPath = realpathSync(new URL(fileUrl));
        const realFileUrl = `${pathToFileURL(realPath)}${search}${hash}`;
        return realFileUrl;
      };

      let {
        pathname
      } = urlObject;
      const pathnameUsesTrailingSlash = pathname.endsWith("/");
      urlObject.search = "";
      urlObject.hash = ""; // force trailing slash on directories and remove eventual trailing slash on files

      if (stat && stat.isDirectory()) {
        reference.expectedType = "directory";

        if (!pathnameUsesTrailingSlash) {
          urlObject.pathname = `${pathname}/`;
        }

        if (directoryReferenceAllowed) {
          return preservesSymlink ? urlObject.href : resolveSymlink(urlObject.href);
        } // give a chane to magic resolution if enabled

      } else if (pathnameUsesTrailingSlash) {
        // a warning would be great because it's strange to reference a file with a trailing slash
        urlObject.pathname = pathname.slice(0, -1);
      }

      const url = urlObject.href;
      const filesystemResolution = applyFileSystemMagicResolution(url, {
        fileStat: stat,
        magicDirectoryIndex,
        magicExtensions: getExtensionsToTry(magicExtensions, reference.parentUrl)
      });

      if (!filesystemResolution.found) {
        return null;
      }

      const fileUrlRaw = filesystemResolution.url;
      const fileUrl = `${fileUrlRaw}${search}${hash}`;
      return preservesSymlink ? fileUrl : resolveSymlink(fileUrl);
    }
  }, {
    name: "jsenv:filesystem_resolution",
    appliesDuring: "*",
    resolveUrl: {
      filesystem: (reference, context) => {
        const {
          parentUrl
        } = reference;
        const parentUrlInfo = context.urlGraph.getUrlInfo(parentUrl);
        const baseUrl = parentUrlInfo && parentUrlInfo.type === "directory" ? ensurePathnameTrailingSlash(parentUrl) : parentUrl;
        return new URL(reference.specifier, baseUrl).href;
      }
    }
  }, {
    name: "jsenv:@fs_resolution",
    appliesDuring: {
      // during dev and test it's a browser running the code
      // so absolute file urls needs to be relativized
      dev: true,
      test: true,
      // during build it's fine to use file:// urls
      build: false
    },
    resolveUrl: reference => {
      if (reference.specifier.startsWith("/@fs/")) {
        const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length);
        return `file:///${fsRootRelativeUrl}`;
      }

      return null;
    },
    formatUrl: (reference, context) => {
      if (!reference.generatedUrl.startsWith("file:")) {
        return null;
      }

      if (urlIsInsideOf(reference.generatedUrl, context.rootDirectoryUrl)) {
        return `/${urlToRelativeUrl(reference.generatedUrl, context.rootDirectoryUrl)}`;
      }

      return `/@fs/${reference.generatedUrl.slice("file:///".length)}`;
    }
  }, {
    name: "jsenv:file_url_fetching",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo, context) => {
      if (!urlInfo.url.startsWith("file:")) {
        return null;
      }

      const urlObject = new URL(urlInfo.url);

      if (context.reference.expectedType === "directory") {
        if (directoryReferenceAllowed) {
          const directoryEntries = readdirSync(urlObject);
          return {
            type: "directory",
            contentType: "application/json",
            content: JSON.stringify(directoryEntries, null, "  "),
            filename: urlToRelativeUrl(ensurePathnameTrailingSlash(urlInfo.url), context.rootDirectoryUrl)
          };
        }

        const error = new Error("found a directory on filesystem");
        error.code = "EISDIR";
        throw error;
      }

      const fileBuffer = readFileSync(urlObject);
      const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url);

      if (CONTENT_TYPE.isTextual(contentType)) {
        return {
          contentType,
          content: String(fileBuffer)
        };
      }

      return {
        contentType,
        content: fileBuffer
      };
    }
  }];
};

const jsenvPluginHttpUrls = () => {
  return {
    name: "jsenv:http_urls",
    appliesDuring: "*" // fetchUrlContent: (urlInfo) => {
    //   if (urlInfo.url.startsWith("http") || urlInfo.url.startsWith("https")) {
    //     return { shouldHandle: false }
    //   }
    //   return null
    // },

  };
};

const jsenvPluginHtmlInlineContent = ({
  analyzeConvertedScripts
}) => {
  return {
    name: "jsenv:html_inline_content",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const actions = [];

        const handleInlineStyle = node => {
          if (node.nodeName !== "style") {
            return;
          }

          const textNode = getHtmlNodeTextNode(node);

          if (!textNode) {
            return;
          }

          actions.push(async () => {
            const {
              line,
              column,
              lineEnd,
              columnEnd,
              isOriginal
            } = htmlNodePosition.readNodePosition(node, {
              preferOriginal: true
            });
            const inlineStyleUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: ".css",
              line,
              column,
              lineEnd,
              columnEnd
            });
            const [inlineStyleReference, inlineStyleUrlInfo] = context.referenceUtils.foundInline({
              type: "link_href",
              expectedType: "css",
              isOriginalPosition: isOriginal,
              // we remove 1 to the line because imagine the following html:
              // <style>body { color: red; }</style>
              // -> content starts same line as <style>
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineStyleUrl,
              contentType: "text/css",
              content: textNode.value
            });
            await context.cook(inlineStyleUrlInfo, {
              reference: inlineStyleReference
            });
            setHtmlNodeGeneratedText(node, {
              generatedText: inlineStyleUrlInfo.content,
              generatedBy: "jsenv:html_inline_content"
            });
          });
        };

        const handleInlineScript = node => {
          if (node.nodeName !== "script") {
            return;
          }

          const textNode = getHtmlNodeTextNode(node);

          if (!textNode) {
            return;
          } // If the inline script was already handled by an other plugin, ignore it
          // - we want to preserve inline scripts generated by html supervisor during dev
          // - we want to avoid cooking twice a script during build


          const generatedBy = getHtmlNodeAttributeByName(node, "generated-by");

          if (generatedBy) {
            if (generatedBy.value === "jsenv:as_js_classic_html") {
              if (!analyzeConvertedScripts) {
                return;
              }
            }

            if (generatedBy.value === "jsenv:html_supervisor") {
              return;
            }
          }

          actions.push(async () => {
            const scriptCategory = parseScriptNode(node);
            const {
              line,
              column,
              lineEnd,
              columnEnd,
              isOriginal
            } = htmlNodePosition.readNodePosition(node, {
              preferOriginal: true
            }); // from MDN about [type] attribute:
            // "Any other value: The embedded content is treated as a data block
            // which won't be processed by the browser. Developers must use a valid MIME type
            // that is not a JavaScript MIME type to denote data blocks.
            // The src attribute will be ignored."
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type

            const isJs = scriptCategory === "classic" || scriptCategory === "module";
            const isImportmap = scriptCategory === "importmap";
            const contentType = isJs ? "text/javascript" : isImportmap ? "application/importmap+json" : scriptCategory;
            let inlineScriptUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: CONTENT_TYPE.asFileExtension(contentType),
              line,
              column,
              lineEnd,
              columnEnd
            });
            const [inlineScriptReference, inlineScriptUrlInfo] = context.referenceUtils.foundInline({
              node,
              type: "script_src",
              expectedType: {
                classic: "js_classic",
                module: "js_module",
                importmap: "importmap"
              }[scriptCategory],
              // we remove 1 to the line because imagine the following html:
              // <script>console.log('ok')</script>
              // -> content starts same line as <script>
              specifierLine: line - 1,
              specifierColumn: column,
              isOriginalPosition: isOriginal,
              specifier: inlineScriptUrl,
              contentType,
              content: textNode.value
            });
            await context.cook(inlineScriptUrlInfo, {
              reference: inlineScriptReference
            });
            setHtmlNodeGeneratedText(node, {
              generatedText: inlineScriptUrlInfo.content,
              generatedBy: "jsenv:html_inline_content"
            });
          });
        };

        visitHtmlAst(htmlAst, node => {
          handleInlineStyle(node);
          handleInlineScript(node);
        });

        if (actions.length === 0) {
          return null;
        }

        await Promise.all(actions.map(action => action()));
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

const jsenvPluginJsInlineContent = ({
  allowEscapeForVersioning
}) => {
  const parseAndTransformInlineContentCalls = async (urlInfo, context) => {
    const inlineContentInfos = await parseJsInlineContentInfos({
      js: urlInfo.content,
      url: urlInfo.data && urlInfo.data.rawUrl || urlInfo.url,
      isJsModule: urlInfo.type === "js_module"
    });

    if (inlineContentInfos.length === 0) {
      return null;
    }

    const magicSource = createMagicSource(urlInfo.content);
    await inlineContentInfos.reduce(async (previous, inlineContentInfo) => {
      await previous;
      const inlineUrl = generateInlineContentUrl({
        url: urlInfo.url,
        extension: CONTENT_TYPE.asFileExtension(inlineContentInfo.contentType),
        line: inlineContentInfo.line,
        column: inlineContentInfo.column,
        lineEnd: inlineContentInfo.lineEnd,
        columnEnd: inlineContentInfo.columnEnd
      });
      let {
        quote
      } = inlineContentInfo;

      if (quote === "`" && !context.isSupportedOnCurrentClients("template_literals")) {
        // if quote is "`" and template literals are not supported
        // we'll use a regular string (single or double quote)
        // when rendering the string
        quote = JS_QUOTES.pickBest(inlineContentInfo.content);
      }

      const [inlineReference, inlineUrlInfo] = context.referenceUtils.foundInline({
        type: "js_inline_content",
        subtype: inlineContentInfo.type,
        // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
        isOriginalPosition: urlInfo.content === urlInfo.originalContent,
        specifierLine: inlineContentInfo.line,
        specifierColumn: inlineContentInfo.column,
        specifier: inlineUrl,
        contentType: inlineContentInfo.contentType,
        content: inlineContentInfo.content
      });
      inlineUrlInfo.jsQuote = quote;

      inlineReference.escape = value => JS_QUOTES.escapeSpecialChars(value.slice(1, -1), {
        quote
      });

      await context.cook(inlineUrlInfo, {
        reference: inlineReference
      });
      magicSource.replace({
        start: inlineContentInfo.start,
        end: inlineContentInfo.end,
        replacement: JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
          quote,
          allowEscapeForVersioning
        })
      });
    }, Promise.resolve());
    return magicSource.toContentAndSourcemap();
  };

  return {
    name: "jsenv:js_inline_content",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: parseAndTransformInlineContentCalls,
      js_module: parseAndTransformInlineContentCalls
    }
  };
};

const parseJsInlineContentInfos = async ({
  js,
  url,
  isJsModule
}) => {
  if (!js.includes("InlineContent") && !js.includes("new Blob(") && !js.includes("JSON.parse(")) {
    return [];
  }

  const {
    metadata
  } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataInlineContents],
    urlInfo: {
      url,
      type: isJsModule ? "js_module" : "js_classic",
      content: js
    }
  });
  return metadata.inlineContentInfos;
};

const babelPluginMetadataInlineContents = () => {
  return {
    name: "metadata-inline-contents",
    visitor: {
      Program: (programPath, state) => {
        const inlineContentInfos = [];

        const onInlineContentInfo = inlineContentInfo => {
          inlineContentInfos.push(inlineContentInfo);
        };

        programPath.traverse({
          NewExpression: path => {
            if (isNewInlineContentCall(path)) {
              analyzeNewInlineContentCall(path.node, {
                onInlineContentInfo
              });
              return;
            }

            if (isNewBlobCall(path.node)) {
              analyzeNewBlobCall(path.node, {
                onInlineContentInfo
              });
              return;
            }
          },
          CallExpression: path => {
            const node = path.node;

            if (isJSONParseCall(node)) {
              analyzeJsonParseCall(node, {
                onInlineContentInfo
              });
            }
          }
        });
        state.file.metadata.inlineContentInfos = inlineContentInfos;
      }
    }
  };
};

const isNewInlineContentCall = path => {
  const node = path.node;

  if (node.callee.type === "Identifier") {
    // terser rename import to use a shorter name
    const name = getOriginalName(path, node.callee.name);
    return name === "InlineContent";
  }

  if (node.callee.id && node.callee.id.type === "Identifier") {
    const name = getOriginalName(path, node.callee.id.name);
    return name === "InlineContent";
  }

  return false;
};

const analyzeNewInlineContentCall = (node, {
  onInlineContentInfo
}) => {
  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: node.arguments[0],
    type: "new_inline_content_first_arg"
  });
};

const isNewBlobCall = node => {
  return node.callee.type === "Identifier" && node.callee.name === "Blob";
};

const analyzeNewBlobCall = (node, {
  onInlineContentInfo
}) => {
  const firstArg = node.arguments[0];

  if (firstArg.type !== "ArrayExpression") {
    return;
  }

  if (firstArg.elements.length !== 1) {
    return;
  }

  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: firstArg.elements[0],
    type: "new_blob_first_arg"
  });
};

const analyzeArguments = ({
  node,
  onInlineContentInfo,
  nodeHoldingContent,
  type
}) => {
  if (node.arguments.length !== 2) {
    return;
  }

  const [, secondArg] = node.arguments;
  const typePropertyNode = getTypePropertyNode(secondArg);

  if (!typePropertyNode) {
    return;
  }

  const typePropertyValueNode = typePropertyNode.value;

  if (typePropertyValueNode.type !== "StringLiteral") {
    return;
  }

  const contentType = typePropertyValueNode.value;
  const contentDetails = extractContentDetails(nodeHoldingContent);

  if (contentDetails) {
    onInlineContentInfo({
      node: nodeHoldingContent,
      ...getNodePosition(nodeHoldingContent),
      type,
      contentType,
      ...contentDetails
    });
  }
};

const extractContentDetails = node => {
  if (node.type === "StringLiteral") {
    return {
      nodeType: "StringLiteral",
      quote: node.extra.raw[0],
      content: node.value
    };
  }

  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis;

    if (quasis.length !== 1) {
      return null;
    }

    const templateElementNode = quasis[0];
    return {
      nodeType: "TemplateLiteral",
      quote: "`",
      content: templateElementNode.value.cooked
    };
  }

  return null;
};

const isJSONParseCall = node => {
  const callee = node.callee;
  return callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "JSON" && callee.property.type === "Identifier" && callee.property.name === "parse";
};

const analyzeJsonParseCall = (node, {
  onInlineContentInfo
}) => {
  const firstArgNode = node.arguments[0];
  const contentDetails = extractContentDetails(firstArgNode);

  if (contentDetails) {
    onInlineContentInfo({
      node: firstArgNode,
      ...getNodePosition(firstArgNode),
      type: "json_parse_first_arg",
      contentType: "application/json",
      ...contentDetails
    });
  }
};

const getNodePosition = node => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column
  };
};

const getOriginalName = (path, name) => {
  const binding = path.scope.getBinding(name);

  if (!binding) {
    return name;
  }

  if (binding.path.type === "ImportSpecifier") {
    const importedName = binding.path.node.imported.name;

    if (name === importedName) {
      return name;
    }

    return getOriginalName(path, importedName);
  }

  if (binding.path.type === "VariableDeclarator") {
    const {
      init
    } = binding.path.node;

    if (init && init.type === "Identifier") {
      const previousName = init.name;
      return getOriginalName(path, previousName);
    }
  }

  return name;
};

const getTypePropertyNode = node => {
  if (node.type !== "ObjectExpression") {
    return null;
  }

  const {
    properties
  } = node;
  return properties.find(property => {
    return property.type === "ObjectProperty" && property.key.type === "Identifier" && property.key.name === "type";
  });
};

const jsenvPluginDataUrls = () => {
  return {
    name: "jsenv:data_urls",
    appliesDuring: "*",
    resolveUrl: reference => {
      if (!reference.specifier.startsWith("data:")) {
        return null;
      }

      return reference.specifier;
    },
    fetchUrlContent: urlInfo => {
      if (!urlInfo.url.startsWith("data:")) {
        return null;
      }

      const {
        contentType,
        base64Flag,
        data: urlData
      } = DataUrl.parse(urlInfo.url);
      urlInfo.data.base64Flag = base64Flag;
      return {
        contentType,
        content: contentFromUrlData({
          contentType,
          base64Flag,
          urlData
        })
      };
    },
    formatUrl: (reference, context) => {
      if (!reference.generatedUrl.startsWith("data:")) {
        return null;
      }

      if (reference.type === "sourcemap_comment") {
        return null;
      }

      return (async () => {
        const urlInfo = context.urlGraph.getUrlInfo(reference.url);
        await context.cook(urlInfo, {
          reference
        });

        if (urlInfo.originalContent === urlInfo.content) {
          return reference.generatedUrl;
        }

        const specifier = DataUrl.stringify({
          contentType: urlInfo.contentType,
          base64Flag: urlInfo.data.base64Flag,
          data: urlInfo.data.base64Flag ? dataToBase64(urlInfo.content) : String(urlInfo.content)
        });
        return specifier;
      })();
    }
  };
};

const contentFromUrlData = ({
  contentType,
  base64Flag,
  urlData
}) => {
  if (CONTENT_TYPE.isTextual(contentType)) {
    if (base64Flag) {
      return base64ToString(urlData);
    }

    return urlData;
  }

  if (base64Flag) {
    return base64ToBuffer(urlData);
  }

  return Buffer.from(urlData);
};

const base64ToBuffer = base64String => Buffer.from(base64String, "base64");

const base64ToString = base64String => Buffer.from(base64String, "base64").toString("utf8");

const dataToBase64 = data => Buffer.from(data).toString("base64");

const jsenvPluginInlineQueryParam = () => {
  return {
    name: "jsenv:inline_query_param",
    appliesDuring: "*",
    formatUrl: {
      // <link> and <script> can be inlined in the html
      // this should be done during dev and postbuild but not build
      // so that the bundled file gets inlined and not the entry point
      "link_href": () => null,
      "script_src": () => null,
      // if the referenced url is a worker we could use
      // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
      // but maybe we should rather use ?object_url
      // or people could do this:
      // import workerText from './worker.js?text'
      // const blob = new Blob(workerText, { type: 'text/javascript' })
      // window.URL.createObjectURL(blob)
      // in any case the recommended way is to use an url
      // to benefit from shared worker and reuse worker between tabs
      "*": (reference, context) => {
        if (!reference.searchParams.has("inline")) {
          return null;
        }

        return (async () => {
          const urlInfo = context.urlGraph.getUrlInfo(reference.url);
          await context.cook(urlInfo, {
            reference
          });
          const specifier = DataUrl.stringify({
            mediaType: urlInfo.contentType,
            base64Flag: true,
            data: Buffer.from(urlInfo.content).toString("base64")
          });
          return specifier;
        })();
      }
    }
  };
};

const jsenvPluginInline = ({
  fetchInlineUrls = true,
  analyzeConvertedScripts = false,
  allowEscapeForVersioning = false
} = {}) => {
  return [...(fetchInlineUrls ? [jsenvPluginInlineUrls()] : []), jsenvPluginHtmlInlineContent({
    analyzeConvertedScripts
  }), jsenvPluginJsInlineContent({
    allowEscapeForVersioning
  }), jsenvPluginDataUrls(), jsenvPluginInlineQueryParam()];
};

const jsenvPluginInlineUrls = () => {
  return {
    name: "jsenv:inline_urls",
    appliesDuring: "*",
    fetchUrlContent: urlInfo => {
      if (!urlInfo.isInline) {
        return null;
      }

      return {
        contentType: urlInfo.contentType,
        // we want to fetch the original content otherwise we might re-cook
        // content already cooked
        content: urlInfo.originalContent
      };
    }
  };
};

/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 */
const jsenvPluginHtmlSupervisor = ({
  logs = false,
  measurePerf = false
}) => {
  const htmlSupervisorSetupFileUrl = new URL("./js/html_supervisor_setup.js", import.meta.url).href;
  const htmlSupervisorInstallerFileUrl = new URL("./js/html_supervisor_installer.js", import.meta.url).href;
  return {
    name: "jsenv:html_supervisor",
    appliesDuring: {
      dev: true,
      test: true
    },
    transformUrlContent: {
      html: ({
        url,
        content
      }, {
        referenceUtils
      }) => {
        const htmlAst = parseHtmlString(content);
        const scriptsToSupervise = [];

        const handleInlineScript = (node, textNode) => {
          const scriptCategory = parseScriptNode(node);
          const {
            line,
            column,
            lineEnd,
            columnEnd,
            isOriginal
          } = htmlNodePosition.readNodePosition(node, {
            preferOriginal: true
          });
          let inlineScriptUrl = generateInlineContentUrl({
            url,
            extension: ".js",
            line,
            column,
            lineEnd,
            columnEnd
          });
          const [inlineScriptReference] = referenceUtils.foundInline({
            type: "script_src",
            expectedType: {
              classic: "js_classic",
              module: "js_module"
            }[scriptCategory],
            isOriginalPosition: isOriginal,
            specifierLine: line - 1,
            specifierColumn: column,
            specifier: inlineScriptUrl,
            contentType: "text/javascript",
            content: textNode.value
          });
          removeHtmlNodeText(node);
          scriptsToSupervise.push({
            node,
            isInline: true,
            type: scriptCategory,
            src: inlineScriptReference.generatedSpecifier
          });
        };

        const handleScriptWithSrc = (node, srcAttribute) => {
          const scriptCategory = parseScriptNode(node);
          const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity");
          const integrity = integrityAttribute ? integrityAttribute.value : undefined;
          const crossoriginAttribute = getHtmlNodeAttributeByName(node, "crossorigin");
          const crossorigin = crossoriginAttribute ? crossoriginAttribute.value : undefined;
          const deferAttribute = getHtmlNodeAttributeByName(node, "crossorigin");
          const defer = deferAttribute ? deferAttribute.value : undefined;
          const asyncAttribute = getHtmlNodeAttributeByName(node, "crossorigin");
          const async = asyncAttribute ? asyncAttribute.value : undefined;
          removeHtmlNodeAttributeByName(node, "src");
          scriptsToSupervise.push({
            node,
            type: scriptCategory,
            src: srcAttribute.value,
            defer,
            async,
            integrity,
            crossorigin
          });
        };

        visitHtmlAst(htmlAst, node => {
          if (node.nodeName !== "script") {
            return;
          }

          const scriptCategory = parseScriptNode(node);

          if (scriptCategory !== "classic" && scriptCategory !== "module") {
            return;
          }

          const injectedByAttribute = getHtmlNodeAttributeByName(node, "injected-by");

          if (injectedByAttribute) {
            return;
          }

          const noHtmlSupervisor = getHtmlNodeAttributeByName(node, "no-html-supervisor");

          if (noHtmlSupervisor) {
            return;
          }

          const textNode = getHtmlNodeTextNode(node);

          if (textNode) {
            handleInlineScript(node, textNode);
            return;
          }

          const srcAttribute = getHtmlNodeAttributeByName(node, "src");

          if (srcAttribute) {
            handleScriptWithSrc(node, srcAttribute);
            return;
          }
        });
        const [htmlSupervisorInstallerFileReference] = referenceUtils.inject({
          type: "js_import_export",
          expectedType: "js_module",
          specifier: htmlSupervisorInstallerFileUrl
        });
        injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
          "tagName": "script",
          "type": "module",
          "textContent": `
      import { installHtmlSupervisor } from ${htmlSupervisorInstallerFileReference.generatedSpecifier}
      installHtmlSupervisor(${JSON.stringify({
            logs,
            measurePerf
          }, null, "        ")})`,
          "injected-by": "jsenv:html_supervisor"
        }));
        const [htmlSupervisorSetupFileReference] = referenceUtils.inject({
          type: "script_src",
          expectedType: "js_classic",
          specifier: htmlSupervisorSetupFileUrl
        });
        injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
          "tagName": "script",
          "src": htmlSupervisorSetupFileReference.generatedSpecifier,
          "injected-by": "jsenv:html_supervisor"
        }));
        scriptsToSupervise.forEach(({
          node,
          isInline,
          type,
          src,
          defer,
          async,
          integrity,
          crossorigin
        }) => {
          setHtmlNodeGeneratedText(node, {
            generatedText: generateCodeToSuperviseScript({
              type,
              src,
              isInline,
              defer,
              async,
              integrity,
              crossorigin,
              htmlSupervisorInstallerSpecifier: htmlSupervisorInstallerFileReference.generatedSpecifier
            }),
            generatedBy: "jsenv:html_supervisor",
            generatedFromSrc: src,
            generatedFromInlineContent: isInline
          });
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
}; // Ideally jsenv should take into account eventual
// "integrity" and "crossorigin" attribute during supervision

const generateCodeToSuperviseScript = ({
  type,
  src,
  isInline,
  defer,
  async,
  integrity,
  crossorigin,
  htmlSupervisorInstallerSpecifier
}) => {
  const paramsAsJson = JSON.stringify({
    src,
    isInline,
    defer,
    async,
    integrity,
    crossorigin
  });

  if (type === "module") {
    return `
      import { superviseScriptTypeModule } from ${htmlSupervisorInstallerSpecifier}
      superviseScriptTypeModule(${paramsAsJson})
`;
  }

  return `
      window.__html_supervisor__.superviseScript(${paramsAsJson})
`;
};

/*
 * Some code uses globals specific to Node.js in code meant to run in browsers...
 * This plugin will replace some node globals to things compatible with web:
 * - process.env.NODE_ENV
 * - __filename
 * - __dirname
 * - global
 */
const jsenvPluginCommonJsGlobals = () => {
  const transformCommonJsGlobals = async (urlInfo, {
    scenario
  }) => {
    if (!urlInfo.content.includes("process.env.NODE_ENV") && !urlInfo.content.includes("__filename") && !urlInfo.content.includes("__dirname")) {
      return null;
    }

    const isJsModule = urlInfo.type === "js_module";
    const replaceMap = {
      "process.env.NODE_ENV": `("${scenario === "dev" || scenario === "test" ? "development" : "production"}")`,
      "global": "globalThis",
      "__filename": isJsModule ? `import.meta.url.slice('file:///'.length)` : `document.currentScript.src`,
      "__dirname": isJsModule ? `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')` : `new URL('./', document.currentScript.src).href`
    };
    const {
      metadata
    } = await applyBabelPlugins({
      babelPlugins: [[babelPluginMetadataExpressionPaths, {
        replaceMap,
        allowConflictingReplacements: true
      }]],
      urlInfo
    });
    const {
      expressionPaths
    } = metadata;
    const keys = Object.keys(expressionPaths);

    if (keys.length === 0) {
      return null;
    }

    const magicSource = createMagicSource(urlInfo.content);
    keys.forEach(key => {
      expressionPaths[key].forEach(path => {
        magicSource.replace({
          start: path.node.start,
          end: path.node.end,
          replacement: replaceMap[key]
        });
      });
    });
    return magicSource.toContentAndSourcemap();
  };

  return {
    name: "jsenv:commonjs_globals",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformCommonJsGlobals,
      js_module: transformCommonJsGlobals
    }
  };
}; // heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c

const babelPluginMetadataExpressionPaths = (babel, {
  replaceMap = {},
  allowConflictingReplacements = false
}) => {
  const {
    traverse,
    parse,
    types
  } = babel;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();
  return {
    name: "metadata-replace",
    pre: state => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = value => {
        const expressionNode = parse(value, state.opts).program.body[0].expression;
        traverse.removeProperties(expressionNode);
        return expressionNode;
      };

      Object.keys(replaceMap).forEach(key => {
        const keyExpressionNode = parseExpression(key);
        const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
        const value = replaceMap[key];
        const valueExpressionNode = parseExpression(value);
        const equivalentKeyExpressionIndex = candidateArray.findIndex(candidate => types.isNodesEquivalent(candidate.keyExpressionNode, keyExpressionNode));

        if (!allowConflictingReplacements && equivalentKeyExpressionIndex > -1) {
          throw new Error(`Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`);
        }

        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode
        };

        if (equivalentKeyExpressionIndex > -1) {
          candidateArray[equivalentKeyExpressionIndex] = newCandidate;
        } else {
          candidateArray.push(newCandidate);
        }

        replacementMap.set(keyExpressionNode.type, candidateArray);
      });
      replacementMap.forEach(candidateArray => {
        candidateArray.forEach(candidate => {
          valueExpressionSet.add(candidate.valueExpressionNode);
        });
      });
    },
    visitor: {
      Program: (programPath, state) => {
        const expressionPaths = {};
        programPath.traverse({
          Expression(path) {
            if (valueExpressionSet.has(path.node)) {
              path.skip();
              return;
            }

            const candidateArray = replacementMap.get(path.node.type);

            if (!candidateArray) {
              return;
            }

            const candidateFound = candidateArray.find(candidate => {
              return types.isNodesEquivalent(candidate.keyExpressionNode, path.node);
            });

            if (candidateFound) {
              try {
                types.validate(path.parent, path.key, candidateFound.valueExpressionNode);
              } catch (err) {
                if (err instanceof TypeError) {
                  path.skip();
                  return;
                }

                throw err;
              }

              const paths = expressionPaths[candidateFound.key];

              if (paths) {
                expressionPaths[candidateFound.key] = [...paths, path];
              } else {
                expressionPaths[candidateFound.key] = [path];
              }

              return;
            }
          }

        });
        state.file.metadata.expressionPaths = expressionPaths;
      }
    }
  };
};

/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.test
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.test but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 */
const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, {
        scenario
      }) => {
        if (!urlInfo.content.includes("import.meta.dev") && !urlInfo.content.includes("import.meta.test") && !urlInfo.content.includes("import.meta.build")) {
          return null;
        }

        const {
          metadata
        } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          urlInfo
        });
        const {
          dev = [],
          test = [],
          build = []
        } = metadata.importMetaScenarios;
        const replacements = [];

        const replace = (path, value) => {
          replacements.push({
            path,
            value
          });
        };

        if (scenario === "dev") {
          dev.forEach(path => {
            replace(path, "true");
          });
        } else if (scenario === "test") {
          // test is also considered a dev environment
          // just like the dev server can be used to debug test files
          // without this people would have to write
          // if (import.meta.dev || import.meta.test) or if (!import.meta.build)
          dev.forEach(path => {
            replace(path, "true");
          });
          test.forEach(path => {
            replace(path, "true");
          });
        } else if (scenario === "build") {
          // replacing by undefined might not be required
          // as I suppose rollup would consider them as undefined
          // but let's make it explicit to ensure code is properly tree-shaked
          dev.forEach(path => {
            replace(path, "undefined");
          });
          test.forEach(path => {
            replace(path, "undefined");
          });
          build.forEach(path => {
            replace(path, "true");
          });
        }

        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({
          path,
          value
        }) => {
          magicSource.replace({
            start: path.node.start,
            end: path.node.end,
            replacement: value
          });
        });
        return magicSource.toContentAndSourcemap();
      }
    }
  };
};

const babelPluginMetadataImportMetaScenarios = () => {
  return {
    name: "metadata-import-meta-scenarios",
    visitor: {
      Program(programPath, state) {
        const importMetas = {};
        programPath.traverse({
          MemberExpression(path) {
            const {
              node
            } = path;
            const {
              object
            } = node;

            if (object.type !== "MetaProperty") {
              return;
            }

            const {
              property: objectProperty
            } = object;

            if (objectProperty.name !== "meta") {
              return;
            }

            const {
              property
            } = node;
            const {
              name
            } = property;
            const importMetaPaths = importMetas[name];

            if (importMetaPaths) {
              importMetaPaths.push(path);
            } else {
              importMetas[name] = [path];
            }
          }

        });
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          test: importMetas.test,
          build: importMetas.build
        };
      }

    }
  };
};

const jsenvPluginInjectGlobals = (globals = {}) => {
  if (Object.keys(globals).length === 0) {
    return [];
  }

  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transformUrlContent: {
      html: injectGlobals,
      js_classic: injectGlobals,
      js_module: injectGlobals
    }
  };
};
const injectGlobals = (urlInfo, globals) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtmlEntryPoint(urlInfo, globals);
  }

  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJsEntryPoints(urlInfo, globals);
  }

  throw new Error(`cannot inject globals into "${urlInfo.type}"`);
};

const globalInjectorOnHtmlEntryPoint = async (urlInfo, globals) => {
  if (!urlInfo.data.isEntryPoint) {
    return null;
  } // ideally we would inject an importmap but browser support is too low
  // (even worse for worker/service worker)
  // so for now we inject code into entry points


  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false
  });
  const clientCode = generateClientCodeForGlobals({
    globals,
    isWebWorker: false
  });
  injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
    "tagName": "script",
    "textContent": clientCode,
    "injected-by": "jsenv:inject_globals"
  }));
  return stringifyHtmlAst(htmlAst);
};

const globalsInjectorOnJsEntryPoints = async (urlInfo, globals) => {
  if (!urlInfo.data.isEntryPoint && !urlInfo.data.isWebWorkerEntryPoint) {
    return null;
  }

  const clientCode = generateClientCodeForGlobals({
    globals,
    isWebWorker: isWebWorkerUrlInfo(urlInfo)
  });
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(clientCode);
  return magicSource.toContentAndSourcemap();
};

const generateClientCodeForGlobals = ({
  isWebWorker = false,
  globals
}) => {
  const globalName = isWebWorker ? "self" : "window";
  return `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`;
};

const jsenvPluginCssParcel = () => {
  return {
    name: "jsenv:css_parcel",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo, context) => {
        const {
          code,
          map
        } = transpileWithParcel(urlInfo, context);
        return {
          content: String(code),
          sourcemap: map
        };
      }
    }
  };
};

/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import assertions
 * But for now (as it is simpler) we let the browser throw the error
 */
const jsenvPluginImportAssertions = () => {
  const updateReference = (reference, searchParam) => {
    reference.expectedType = "js_module";
    reference.filename = `${urlToFilename(reference.url)}.js`;

    reference.mutation = magicSource => {
      magicSource.remove({
        start: reference.assertNode.start,
        end: reference.assertNode.end
      });
    };

    const newUrl = injectQueryParams(reference.url, {
      [searchParam]: ""
    });
    return newUrl;
  };

  const importAssertions = {
    name: "jsenv:import_assertions",
    appliesDuring: "*",
    redirectUrl: {
      js_import_export: (reference, context) => {
        if (!reference.assert) {
          return null;
        } // during build always replace import assertions with the js:
        // - avoid rollup to see import assertions
        //   We would have to tell rollup to ignore import with assertion
        // - means rollup can bundle more js file together
        // - means url versioning can work for css inlined in js


        if (reference.assert.type === "json") {
          if (context.scenario !== "build" && context.isSupportedOnCurrentClients("import_type_json")) {
            return null;
          }

          return updateReference(reference, "as_json_module");
        }

        if (reference.assert.type === "css") {
          if (context.scenario !== "build" && context.isSupportedOnCurrentClients("import_type_css")) {
            return null;
          }

          return updateReference(reference, "as_css_module");
        }

        if (reference.assert.type === "text") {
          if (context.scenario !== "build" && context.isSupportedOnCurrentClients("import_type_text")) {
            return null;
          }

          return updateReference(reference, "as_text_module");
        }

        return null;
      }
    }
  };
  return [importAssertions, ...jsenvPluginAsModules()];
};

const jsenvPluginAsModules = () => {
  const inlineContentClientFileUrl = new URL("./js/inline_content.js", import.meta.url).href;
  const asJsonModule = {
    name: `jsenv:as_json_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_json_module",
        expectedType: "json"
      });

      if (!originalUrlInfo) {
        return null;
      }

      const jsonText = JSON.stringify(originalUrlInfo.content.trim());
      return {
        type: "js_module",
        contentType: "text/javascript",
        // here we could `export default ${jsonText}`:
        // but js engine are optimized to recognize JSON.parse
        // and use a faster parsing strategy
        content: `export default JSON.parse(${jsonText})`
      };
    }
  };
  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_css_module",
        expectedType: "css"
      });

      if (!originalUrlInfo) {
        return null;
      }

      const cssText = JS_QUOTES.escapeSpecialChars(originalUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true
      });
      return {
        type: "js_module",
        contentType: "text/javascript",
        content: `import { InlineContent } from ${JSON.stringify(inlineContentClientFileUrl)}
  
  const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
  const stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(inlineContent.text)
  export default stylesheet`
      };
    }
  };
  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_text_module",
        expectedType: "text"
      });

      if (!originalUrlInfo) {
        return null;
      }

      const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true
      });
      return {
        type: "js_module",
        contentType: "text/javascript",
        content: `import { InlineContent } from ${JSON.stringify(inlineContentClientFileUrl)}
  
const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`
      };
    }
  };
  return [asJsonModule, asCssModule, asTextModule];
};

const babelPluginTransformImportMetaUrl = babel => {
  return {
    name: "transform-import-meta-url",
    visitor: {
      Program: programPath => {
        const currentUrlIdentifier = programPath.scope.generateUidIdentifier("currentUrl");
        let used = false;
        programPath.traverse({
          MemberExpression: path => {
            const node = path.node;

            if (node.object.type === "MetaProperty" && node.object.property.name === "meta" && node.property.name === "url") {
              // const node = babel.types.valueToNode(10)
              const identifier = babel.types.identifier(currentUrlIdentifier.name);
              const expressionStatement = babel.types.expressionStatement(identifier);
              path.replaceWith(expressionStatement);
              used = true;
            }
          }
        });

        if (used) {
          const ast = generateExpressionAst(`document.currentScript.src`);
          programPath.scope.push({
            id: currentUrlIdentifier,
            init: ast
          });
        }
      }
    }
  };
};

const generateExpressionAst = (expression, options) => {
  const {
    parseExpression
  } = babelParser;
  const ast = parseExpression(expression, options);
  return ast;
};

const jsenvPluginAsJsClassicHtml = ({
  systemJsInjection,
  systemJsClientFileUrl,
  generateJsClassicFilename
}) => {
  return {
    name: "jsenv:as_js_classic_html",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo, context) => {
        const shouldTransformScriptTypeModule = !context.isSupportedOnCurrentClients("script_type_module") || !context.isSupportedOnCurrentClients("import_dynamic");
        const htmlAst = parseHtmlString(urlInfo.content);
        const preloadAsScriptNodes = [];
        const modulePreloadNodes = [];
        const moduleScriptNodes = [];
        const classicScriptNodes = [];

        const visitLinkNodes = node => {
          if (node.nodeName !== "link") {
            return;
          }

          const relAttribute = getHtmlNodeAttributeByName(node, "rel");
          const rel = relAttribute ? relAttribute.value : undefined;

          if (rel === "modulepreload") {
            modulePreloadNodes.push(node);
            return;
          }

          if (rel === "preload") {
            const asAttribute = getHtmlNodeAttributeByName(node, "as");
            const asValue = asAttribute ? asAttribute.value : undefined;

            if (asValue === "script") {
              preloadAsScriptNodes.push(node);
            }

            return;
          }
        };

        const visitScriptNodes = node => {
          if (node.nodeName !== "script") {
            return;
          }

          const typeAttribute = getHtmlNodeAttributeByName(node, "type");
          const type = typeAttribute ? typeAttribute.value : undefined;

          if (type === "module") {
            moduleScriptNodes.push(node);
            return;
          }

          if (type === undefined || type === "text/javascript") {
            classicScriptNodes.push(node);
            return;
          }
        };

        visitHtmlAst(htmlAst, node => {
          visitLinkNodes(node);
          visitScriptNodes(node);
        });
        const actions = [];
        const jsModuleUrls = [];
        const convertedUrls = [];

        const getReferenceAsJsClassic = async (reference, {
          // we don't cook ressource hints
          // because they might refer to ressource that will be modified during build
          // It also means something else HAVE to reference that url in order to cook it
          // so that the preload is deleted by "resync_ressource_hints.js" otherwise
          cookIt = false
        } = {}) => {
          const newReferenceProps = {
            expectedType: "js_classic",
            specifier: injectQueryParamsIntoSpecifier(reference.specifier, {
              as_js_classic: ""
            }),
            filename: generateJsClassicFilename(reference.url)
          };
          const [newReference, newUrlInfo] = context.referenceUtils.update(reference, newReferenceProps);
          const convertedUrl = newUrlInfo.url;

          if (!convertedUrls.includes(convertedUrl)) {
            convertedUrls.push(convertedUrl);
          }

          if (cookIt) {
            // during dev it means js modules will be cooked before server sends the HTML
            // it's ok because:
            // - during dev script_type_module are supported (dev use a recent browser)
            // - even if browser is not supported it still works it's jus a bit slower
            //   because it needs to decide if systemjs will be injected or not
            await context.cook(newUrlInfo, {
              reference: newReference
            });
          }

          return [newReference, newUrlInfo];
        };

        classicScriptNodes.forEach(classicScriptNode => {
          const srcAttribute = getHtmlNodeAttributeByName(classicScriptNode, "src");

          if (srcAttribute) {
            const reference = urlInfo.references.find(ref => ref.generatedSpecifier === srcAttribute.value && ref.type === "script_src");
            const urlObject = new URL(reference.url);

            if (urlObject.searchParams.has("as_js_classic")) {
              const convertedUrl = urlObject.href;
              convertedUrls.push(convertedUrl);
              urlObject.searchParams.delete("as_js_classic");
              const jsModuleUrl = urlObject.href;
              jsModuleUrls.push(jsModuleUrl);
              actions.push(async () => {
                const urlInfo = context.urlGraph.getUrlInfo(convertedUrl);
                await context.cook(urlInfo, {
                  reference
                });
              });
            }
          }
        });
        moduleScriptNodes.forEach(moduleScriptNode => {
          const srcAttribute = getHtmlNodeAttributeByName(moduleScriptNode, "src");

          if (srcAttribute) {
            const reference = urlInfo.references.find(ref => ref.generatedSpecifier === srcAttribute.value && ref.type === "script_src" && ref.expectedType === "js_module");
            jsModuleUrls.push(reference.url);

            if (shouldTransformScriptTypeModule) {
              actions.push(async () => {
                const [newReference] = await getReferenceAsJsClassic(reference, {
                  cookIt: true
                });
                removeHtmlNodeAttributeByName(moduleScriptNode, "type");
                srcAttribute.value = newReference.generatedSpecifier;
              });
            }

            return;
          }

          if (shouldTransformScriptTypeModule) {
            const textNode = getHtmlNodeTextNode(moduleScriptNode);
            actions.push(async () => {
              const {
                line,
                column,
                lineEnd,
                columnEnd,
                isOriginal
              } = htmlNodePosition.readNodePosition(moduleScriptNode, {
                preferOriginal: true
              });
              let inlineScriptUrl = generateInlineContentUrl({
                url: urlInfo.url,
                extension: ".js",
                line,
                column,
                lineEnd,
                columnEnd
              });
              const [inlineReference] = context.referenceUtils.foundInline({
                node: moduleScriptNode,
                type: "script_src",
                expectedType: "js_module",
                isOriginalPosition: isOriginal,
                // we remove 1 to the line because imagine the following html:
                // <script>console.log('ok')</script>
                // -> content starts same line as <script>
                specifierLine: line - 1,
                specifierColumn: column,
                specifier: inlineScriptUrl,
                contentType: "application/javascript",
                content: textNode.value
              });
              const [, newUrlInfo] = await getReferenceAsJsClassic(inlineReference, {
                cookIt: true
              });
              removeHtmlNodeAttributeByName(moduleScriptNode, "type");
              setHtmlNodeGeneratedText(moduleScriptNode, {
                generatedText: newUrlInfo.content,
                generatedBy: "jsenv:as_js_classic_html"
              });
            });
          }
        });

        if (shouldTransformScriptTypeModule) {
          preloadAsScriptNodes.forEach(preloadAsScriptNode => {
            const hrefAttribute = getHtmlNodeAttributeByName(preloadAsScriptNode, "href");
            const href = hrefAttribute.value;
            const reference = urlInfo.references.find(ref => ref.generatedSpecifier === href && ref.type === "link_href" && ref.expectedType === undefined);
            const expectedScriptType = jsModuleUrls.includes(reference.url) ? "module" : "classic";

            if (expectedScriptType === "module") {
              actions.push(async () => {
                // reference modified by <script type="module"> conversion
                let newReference;

                if (reference.next) {
                  newReference = reference.next;
                } else {
                  [newReference] = await getReferenceAsJsClassic(reference);
                }

                assignHtmlNodeAttributes(preloadAsScriptNode, {
                  href: newReference.generatedSpecifier
                });
                removeHtmlNodeAttributeByName(preloadAsScriptNode, "crossorigin");
              });
            }
          });
          modulePreloadNodes.forEach(modulePreloadNode => {
            const hrefAttribute = getHtmlNodeAttributeByName(modulePreloadNode, "href");
            const href = hrefAttribute.value;
            const reference = urlInfo.references.find(ref => ref.generatedSpecifier === href && ref.type === "link_href" && ref.expectedType === "js_module");
            actions.push(async () => {
              let newReference;

              if (reference.next) {
                newReference = reference.next;
              } else {
                [newReference] = await getReferenceAsJsClassic(reference);
              }

              assignHtmlNodeAttributes(modulePreloadNode, {
                rel: "preload",
                as: "script",
                href: newReference.generatedSpecifier
              });
            });
          });
        }

        if (actions.length === 0) {
          return null;
        }

        await Promise.all(actions.map(action => action()));

        if (systemJsInjection) {
          const needsSystemJs = convertedUrls.some(convertedUrl => context.urlGraph.getUrlInfo(convertedUrl).data.jsClassicFormat === "system");

          if (needsSystemJs) {
            const [systemJsReference] = context.referenceUtils.inject({
              type: "script_src",
              expectedType: "js_classic",
              specifier: systemJsClientFileUrl
            });
            injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
              "tagName": "script",
              "src": systemJsReference.generatedSpecifier,
              "injected-by": "jsenv:as_js_classic_html"
            }));
          }
        }

        return stringifyHtmlAst(htmlAst);
      }
    }
  };
};

const jsenvPluginAsJsClassicWorkers = ({
  generateJsClassicFilename
}) => {
  const updateReference = reference => {
    reference.filename = generateJsClassicFilename(reference.url);

    reference.mutation = magicSource => {
      magicSource.replace({
        start: reference.typePropertyNode.value.start,
        end: reference.typePropertyNode.value.end,
        replacement: JSON.stringify("classic")
      });
    };

    reference.expectedType = "js_classic";
    return injectQueryParams(reference.url, {
      as_js_classic: ""
    });
  };

  return {
    name: "jsenv:as_js_classic_workers",
    appliesDuring: "*",
    redirectUrl: {
      js_url_specifier: (reference, context) => {
        if (reference.expectedType !== "js_module") {
          return null;
        }

        if (reference.expectedSubtype === "worker") {
          if (context.isSupportedOnCurrentClients("worker_type_module")) {
            return null;
          }

          return updateReference(reference);
        }

        if (reference.expectedSubtype === "service_worker") {
          if (context.isSupportedOnCurrentClients("service_worker_type_module")) {
            return null;
          }

          return updateReference(reference);
        }

        if (reference.expectedSubtype === "shared_worker") {
          if (context.isSupportedOnCurrentClients("shared_worker_type_module")) {
            return null;
          }

          return updateReference(reference);
        }

        return null;
      }
    }
  };
};

/*
 * Something to keep in mind:
 * When systemjs format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * So without minification these specifier are long and dependent
 * on where the files are on the filesystem.
 * This is mitigated by minification that will shorten them
 * But ideally babel should not generate this in the first place
 * and prefer to unique identifier based solely on the specifier basename for instance
 */

const require$3 = createRequire(import.meta.url);

const jsenvPluginAsJsClassic = ({
  systemJsInjection
}) => {
  const systemJsClientFileUrl = new URL("./js/s.js", import.meta.url).href;
  return [jsenvPluginAsJsClassicConversion({
    systemJsInjection,
    systemJsClientFileUrl
  }), jsenvPluginAsJsClassicHtml({
    systemJsInjection,
    systemJsClientFileUrl,
    generateJsClassicFilename
  }), jsenvPluginAsJsClassicWorkers({
    generateJsClassicFilename
  })];
}; // propagate ?as_js_classic to referenced urls
// and perform the conversion during fetchUrlContent

const jsenvPluginAsJsClassicConversion = ({
  systemJsInjection,
  systemJsClientFileUrl
}) => {
  const propagateJsClassicSearchParam = (reference, context) => {
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);

    if (!parentUrlInfo || !new URL(parentUrlInfo.url).searchParams.has("as_js_classic")) {
      return null;
    }

    const urlTransformed = injectQueryParams(reference.url, {
      as_js_classic: ""
    });
    reference.filename = generateJsClassicFilename(reference.url);
    return urlTransformed;
  };

  return {
    name: "jsenv:as_js_classic_conversion",
    appliesDuring: "*",
    redirectUrl: {
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline ressources
      // or specifiers inside new URL()...
      js_import_export: propagateJsClassicSearchParam,
      js_url_specifier: (reference, context) => {
        if (reference.subtype === "system_register_arg" || reference.subtype === "system_import_arg") {
          return propagateJsClassicSearchParam(reference, context);
        }

        return null;
      }
    },
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_js_classic",
        // override the expectedType to "js_module"
        // because when there is ?as_js_classic it means the underlying ressource
        // is a js_module
        expectedType: "js_module"
      });

      if (!originalUrlInfo) {
        return null;
      }

      const isJsEntryPoint = // in general html files are entry points
      // but during build js can be sepcified as an entry point
      // (meaning there is no html file where we can inject systemjs)
      // in that case we need to inject systemjs in the js file
      originalUrlInfo.data.isEntryPoint || // In thoose case we need to inject systemjs the worker js file
      originalUrlInfo.data.isWebWorkerEntryPoint; // if it's an entry point without dependency (it does not use import)
      // then we can use UMD, otherwise we have to use systemjs
      // because it is imported by systemjs

      const jsClassicFormat = isJsEntryPoint && !originalUrlInfo.data.usesImport ? "umd" : "system";
      const {
        content,
        sourcemap
      } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo: originalUrlInfo,
        isJsEntryPoint,
        jsClassicFormat
      });
      urlInfo.data.jsClassicFormat = jsClassicFormat;
      return {
        type: "js_classic",
        contentType: "text/javascript",
        content,
        sourcemap
      };
    }
  };
};

const generateJsClassicFilename = url => {
  const filename = urlToFilename(url);
  let [basename, extension] = splitFileExtension$1(filename);
  const {
    searchParams
  } = new URL(url);

  if (searchParams.has("as_json_module") || searchParams.has("as_css_module") || searchParams.has("as_text_module")) {
    extension = ".js";
  }

  return `${basename}.es5${extension}`;
};

const splitFileExtension$1 = filename => {
  const dotLastIndex = filename.lastIndexOf(".");

  if (dotLastIndex === -1) {
    return [filename, ""];
  }

  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  isJsEntryPoint,
  jsClassicFormat
}) => {
  const {
    code,
    map
  } = await applyBabelPlugins({
    babelPlugins: [...(jsClassicFormat === "system" ? [// propposal-dynamic-import required with systemjs for babel8:
    // https://github.com/babel/babel/issues/10746
    require$3("@babel/plugin-proposal-dynamic-import"), [requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
      topLevelAwait: "return"
    }], require$3("@babel/plugin-transform-modules-systemjs")] : [[requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
      topLevelAwait: "simple"
    }], babelPluginTransformImportMetaUrl, require$3("@babel/plugin-transform-modules-umd")])],
    urlInfo
  });

  if (systemJsInjection && jsClassicFormat === "system" && isJsEntryPoint) {
    const magicSource = createMagicSource(code);
    const systemjsCode = readFileSync$1(systemJsClientFileUrl, {
      as: "string"
    });
    magicSource.prepend(`${systemjsCode}\n\n`);
    const {
      content,
      sourcemap
    } = magicSource.toContentAndSourcemap();
    return {
      content,
      sourcemap: await composeTwoSourcemaps(map, sourcemap)
    };
  }

  return {
    content: code,
    sourcemap: map
  };
};

const jsenvPluginTopLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        if (context.isSupportedOnCurrentClients("top_level_await")) {
          return null;
        }

        const usesTLA = await usesTopLevelAwait(urlInfo);

        if (!usesTLA) {
          return null;
        }

        const {
          code,
          map
        } = await applyBabelPlugins({
          urlInfo,
          babelPlugins: [[requireBabelPlugin("babel-plugin-transform-async-to-promises"), {
            // Maybe we could pass target: "es6" when we support arrow function
            // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
            topLevelAwait: "simple" // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
            // externalHelpers: true,
            // externalHelpersPath: JSON.parse(
            //   context.referenceUtils.inject({
            //     type: "js_import_export",
            //     expectedType: "js_module",
            //     specifier:
            //       "babel-plugin-transform-async-to-promises/helpers.mjs",
            //   })[0],
            // ),

          }]]
        });
        return {
          content: code,
          sourcemap: map
        };
      }
    }
  };
};

const usesTopLevelAwait = async urlInfo => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }

  const {
    metadata
  } = await applyBabelPlugins({
    urlInfo,
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait]
  });
  return metadata.usesTopLevelAwait;
};

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false;
        programPath.traverse({
          AwaitExpression: path => {
            const closestFunction = path.getFunctionParent();

            if (!closestFunction) {
              usesTopLevelAwait = true;
              path.stop();
            }
          }
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      }
    }
  };
};

/*
 * Transforms code to make it compatible with browser that would not be able to
 * run it otherwise. For instance:
 * - const -> var
 * - async/await -> promises
 * Anything that is not standard (import.meta.dev for instance) is outside the scope
 * of this plugin
 */
const jsenvPluginTranspilation = ({
  importAssertions = true,
  css = true,
  jsModuleAsJsClassic = true,
  systemJsInjection = true,
  topLevelAwait = true,
  babelHelpersAsImport = true,
  getCustomBabelPlugins
}) => {
  return [// import assertions we want it all the time
  ...(importAssertions ? [jsenvPluginImportAssertions()] : []), // babel also so that rollup can bundle babel helpers for instance
  jsenvPluginBabel({
    topLevelAwait,
    getCustomBabelPlugins,
    babelHelpersAsImport
  }), // but the conversion from js_module to js_classic
  // we want to do it after bundling
  // so the build function will disable jsModuleAsJsClassic during build
  // and enable it manually during postbuild
  ...(jsModuleAsJsClassic ? [jsenvPluginAsJsClassic({
    systemJsInjection
  })] : []), // topLevelAwait must come after js_module_as_js_classic because it's related to the module format
  // so we want to wait to know the module format before transforming things related to top level await
  ...(topLevelAwait ? [jsenvPluginTopLevelAwait()] : []), ...(css ? [jsenvPluginCssParcel()] : [])];
};

const jsenvPluginNodeRuntime = ({
  runtimeCompat
}) => {
  const nodeFound = Object.keys(runtimeCompat).includes("node");

  if (!nodeFound) {
    return [];
  } // what do we need to do?


  return {
    name: "jsenv:node_runtime",
    appliesDuring: "*"
  };
};

/*
 * Each @import found in css is replaced by the file content
 * - There is no need to worry about urls (such as background-image: url())
 *   because they are absolute (file://*) and will be made relative again by jsenv build
 * - The sourcemap are not generated but ideally they should be
 *   It can be quite challenging, see "bundle_sourcemap.js"
 */

const bundleCss = async ({
  cssUrlInfos,
  context
}) => {
  const bundledCssUrlInfos = {};
  const cssBundleInfos = await performCssBundling({
    cssEntryUrlInfos: cssUrlInfos,
    context
  });
  cssUrlInfos.forEach(cssUrlInfo => {
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        generatedBy: "parcel"
      },
      contentType: "text/css",
      content: cssBundleInfos[cssUrlInfo.url].bundleContent
    };
  });
  return bundledCssUrlInfos;
};

const performCssBundling = async ({
  cssEntryUrlInfos,
  context
}) => {
  const cssBundleInfos = await loadCssUrls({
    cssEntryUrlInfos,
    context
  });
  const cssUrlsSorted = sortByDependencies(cssBundleInfos);
  cssUrlsSorted.forEach(cssUrl => {
    const cssBundleInfo = cssBundleInfos[cssUrl];
    const magicSource = createMagicSource(cssBundleInfo.content);
    cssBundleInfo.cssUrls.forEach(cssUrl => {
      if (cssUrl.type === "@import") {
        magicSource.replace({
          start: cssUrl.atRuleStart,
          end: cssUrl.atRuleEnd,
          replacement: cssBundleInfos[cssUrl.url].bundleContent
        });
      }
    });
    const {
      content
    } = magicSource.toContentAndSourcemap();
    cssBundleInfo.bundleContent = content.trim();
  });
  return cssBundleInfos;
};

const parseCssUrls = async ({
  css,
  url
}) => {
  const cssUrls = [];
  await applyPostCss({
    sourcemaps: false,
    plugins: [postCssPluginUrlVisitor({
      urlVisitor: ({
        type,
        specifier,
        specifierStart,
        specifierEnd,
        atRuleStart,
        atRuleEnd
      }) => {
        cssUrls.push({
          type,
          url: new URL(specifier, url).href,
          specifierStart,
          specifierEnd,
          atRuleStart,
          atRuleEnd
        });
      }
    })],
    url,
    content: css
  });
  return cssUrls;
};

const loadCssUrls = async ({
  cssEntryUrlInfos,
  context
}) => {
  const cssBundleInfos = {};
  const promises = [];
  const promiseMap = new Map();

  const load = cssUrlInfo => {
    const promiseFromData = promiseMap.get(cssUrlInfo.url);
    if (promiseFromData) return promiseFromData;

    const promise = _load(cssUrlInfo);

    promises.push(promise);
    promiseMap.set(cssUrlInfo.url, promise);
    return promise;
  };

  const _load = async cssUrlInfo => {
    const cssUrls = await parseCssUrls({
      css: cssUrlInfo.content,
      url: cssUrlInfo.url
    });
    const cssBundleInfo = {
      content: cssUrlInfo.content,
      cssUrls,
      dependencies: []
    };
    cssBundleInfos[cssUrlInfo.url] = cssBundleInfo;
    cssUrls.forEach(cssUrl => {
      if (cssUrl.type === "@import") {
        cssBundleInfo.dependencies.push(cssUrl.url);
        const importedCssUrlInfo = context.urlGraph.getUrlInfo(cssUrl.url);
        load(importedCssUrlInfo);
      }
    });
  };

  cssEntryUrlInfos.forEach(cssEntryUrlInfo => {
    load(cssEntryUrlInfo);
  });

  const waitAll = async () => {
    if (promises.length === 0) {
      return;
    }

    const promisesToWait = promises.slice();
    promises.length = 0;
    await Promise.all(promisesToWait);
    await waitAll();
  };

  await waitAll();
  promiseMap.clear();
  return cssBundleInfos;
};

/*
 * TODO:
 * for each js_classic where subtype is a worker
 * take the url info and find importScripts calls
 * and replace them with the corresponding url info file content
 * we'll ikely need to save the importScripts node location to be able to do that
 */
// import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
const bundleJsClassicWorkers = () => {
  return {};
};

const fileUrlConverter = {
  asFilePath: fileUrl => {
    const filePath = urlToFileSystemPath(fileUrl);
    const urlObject = new URL(fileUrl);
    const {
      searchParams
    } = urlObject;
    return `${filePath}${stringifyQuery(searchParams)}`;
  },
  asFileUrl: filePath => {
    return decodeURIComponent(fileSystemPathToUrl(filePath)).replace(/[=](?=&|$)/g, "");
  }
};

const stringifyQuery = searchParams => {
  const search = searchParams.toString();
  return search ? `?${search}` : "";
};

const globalThisClientFileUrl = new URL("./js/global_this.js", import.meta.url).href;
const jsenvBabelPluginDirectoryUrl = new URL("./src/plugins/transpilation/babel/", import.meta.url).href;
const bundleJsModule = async ({
  jsModuleUrlInfos,
  context,
  options
}) => {
  const {
    signal,
    logger,
    rootDirectoryUrl,
    buildDirectoryUrl,
    urlGraph,
    runtimeCompat,
    sourcemaps
  } = context;
  const {
    jsModuleBundleUrlInfos
  } = await buildWithRollup({
    signal,
    logger,
    rootDirectoryUrl,
    buildDirectoryUrl,
    urlGraph,
    jsModuleUrlInfos,
    runtimeCompat,
    sourcemaps,
    options
  });
  return jsModuleBundleUrlInfos;
};
const buildWithRollup = async ({
  signal,
  logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,
  runtimeCompat,
  sourcemaps,
  options
}) => {
  const resultRef = {
    current: null
  };

  try {
    await applyRollupPlugins({
      rollupPlugins: [rollupPluginJsenv({
        signal,
        logger,
        rootDirectoryUrl,
        buildDirectoryUrl,
        urlGraph,
        jsModuleUrlInfos,
        runtimeCompat,
        sourcemaps,
        options,
        resultRef
      })],
      inputOptions: {
        input: [],
        onwarn: warning => {
          if (warning.code === "CIRCULAR_DEPENDENCY") {
            return;
          }

          if (warning.code === "THIS_IS_UNDEFINED" && pathToFileURL(warning.id).href === globalThisClientFileUrl) {
            return;
          }

          if (warning.code === "EVAL") {
            // ideally we should disable only for jsenv files
            return;
          }

          logger.warn(String(warning));
        }
      }
    });
    return resultRef.current;
  } catch (e) {
    if (e.code === "MISSING_EXPORT") {
      const detailedMessage = createDetailedMessage(e.message, {
        frame: e.frame
      });
      throw new Error(detailedMessage, {
        cause: e
      });
    }

    throw e;
  }
};

const rollupPluginJsenv = ({
  // logger,
  rootDirectoryUrl,
  buildDirectoryUrl,
  urlGraph,
  jsModuleUrlInfos,
  sourcemaps,
  options,
  resultRef
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented");
  };

  const emitChunk = chunk => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk
    });
  };

  let importCanBeBundled = () => true;

  if (options.include) {
    const bundleIncludeConfig = normalizeStructuredMetaMap({
      bundle: options.include
    }, rootDirectoryUrl);

    importCanBeBundled = url => {
      return urlToMeta({
        url,
        structuredMetaMap: bundleIncludeConfig
      }).bundle;
    };
  }

  const urlImporters = {};
  return {
    name: "jsenv",

    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      let previousNonEntryPointModuleId;
      jsModuleUrlInfos.forEach(jsModuleUrlInfo => {
        const id = jsModuleUrlInfo.url;

        if (jsModuleUrlInfo.data.isEntryPoint) {
          emitChunk({
            id
          });
          return;
        }

        emitChunk({
          id,
          implicitlyLoadedAfterOneOf: previousNonEntryPointModuleId ? [previousNonEntryPointModuleId] : null // preserveSignature: "allow-extension",

        });
        previousNonEntryPointModuleId = id;
      });
    },

    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args);

      const jsModuleBundleUrlInfos = {};
      Object.keys(rollupResult).forEach(fileName => {
        const rollupFileInfo = rollupResult[fileName]; // there is 3 types of file: "placeholder", "asset", "chunk"

        if (rollupFileInfo.type === "chunk") {
          const jsModuleBundleUrlInfo = {
            data: {
              generatedBy: "rollup",
              bundleRelativeUrl: rollupFileInfo.fileName,
              usesImport: rollupFileInfo.imports.length > 0 || rollupFileInfo.dynamicImports.length > 0,
              usesExport: rollupFileInfo.exports.length > 0
            },
            contentType: "text/javascript",
            content: rollupFileInfo.code,
            sourcemap: rollupFileInfo.map
          };
          let url;

          if (rollupFileInfo.facadeModuleId) {
            url = fileUrlConverter.asFileUrl(rollupFileInfo.facadeModuleId);
          } else {
            url = new URL(rollupFileInfo.fileName, buildDirectoryUrl).href;
          }

          jsModuleBundleUrlInfos[url] = jsModuleBundleUrlInfo;
        }
      });
      resultRef.current = {
        jsModuleBundleUrlInfos
      };
    },

    outputOptions: outputOptions => {
      // const sourcemapFile = buildDirectoryUrl
      Object.assign(outputOptions, {
        format: "esm",
        dir: fileUrlConverter.asFilePath(buildDirectoryUrl),
        sourcemap: sourcemaps === "file" || sourcemaps === "inline",
        // sourcemapFile,
        sourcemapPathTransform: relativePath => {
          return new URL(relativePath, buildDirectoryUrl).href;
        },
        entryFileNames: () => {
          return `[name].js`;
        },
        chunkFileNames: chunkInfo => {
          const insideJs = willBeInsideJsDirectory({
            chunkInfo,
            fileUrlConverter,
            jsModuleUrlInfos
          });
          let nameFromUrlInfo;

          if (chunkInfo.facadeModuleId) {
            const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId);
            const urlInfo = jsModuleUrlInfos.find(jsModuleUrlInfo => jsModuleUrlInfo.url === url);

            if (urlInfo) {
              nameFromUrlInfo = urlInfo.filename;
            }
          }

          const name = nameFromUrlInfo || `${chunkInfo.name}.js`;
          return insideJs ? `js/${name}` : `${name}`;
        },
        manualChunks: id => {
          const fileUrl = fileUrlConverter.asFileUrl(id);

          if (fileUrl.endsWith("babel-plugin-transform-async-to-promises/helpers.mjs")) {
            return "babel_helpers";
          }

          if (babelHelperNameFromUrl(fileUrl)) {
            return "babel_helpers";
          }

          if (urlIsInsideOf(fileUrl, jsenvBabelPluginDirectoryUrl)) {
            return "babel_helpers";
          }

          return null;
        } // https://rollupjs.org/guide/en/#outputpaths
        // paths: (id) => {
        //   return id
        // },

      });
    },
    resolveId: (specifier, importer = rootDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = fileUrlConverter.asFileUrl(importer);
      }

      const url = new URL(specifier, importer).href;
      const existingImporter = urlImporters[url];

      if (!existingImporter) {
        urlImporters[url] = importer;
      }

      if (!url.startsWith("file:")) {
        return {
          id: url,
          external: true
        };
      }

      if (!importCanBeBundled(url)) {
        return {
          id: url,
          external: true
        };
      }

      const urlInfo = urlGraph.getUrlInfo(url);

      if (!urlInfo) {
        // happen when excluded by urlAnalysis.include
        return {
          id: url,
          external: true
        };
      }

      if (!urlInfo.shouldHandle) {
        return {
          id: url,
          external: true
        };
      }

      const filePath = fileUrlConverter.asFilePath(url);
      return filePath;
    },

    async load(rollupId) {
      const fileUrl = fileUrlConverter.asFileUrl(rollupId);
      const urlInfo = urlGraph.getUrlInfo(fileUrl);
      return {
        code: urlInfo.content,
        map: urlInfo.sourcemap ? sourcemapConverter.toFilePaths(urlInfo.sourcemap) : null
      };
    }

  };
};

const willBeInsideJsDirectory = ({
  chunkInfo,
  fileUrlConverter,
  jsModuleUrlInfos
}) => {
  // if the chunk is generated dynamically by rollup
  // for an entry point jsenv will put that file inside js/ directory
  // if it's generated dynamically for a file already in js/ directory
  // both will be inside the js/ directory
  if (!chunkInfo.facadeModuleId) {
    // generated by rollup
    return true;
  }

  const url = fileUrlConverter.asFileUrl(chunkInfo.facadeModuleId);
  const jsModuleUrlInfo = jsModuleUrlInfos.find(jsModuleUrlInfo => jsModuleUrlInfo.url === url);

  if (!jsModuleUrlInfo) {
    // generated by rollup
    return true;
  }

  if (!jsModuleUrlInfo.data.isEntryPoint && !jsModuleUrlInfo.data.isWebWorkerEntryPoint) {
    // not an entry point, jsenv will put it inside js/ directory
    return true;
  }

  return false;
};

const jsenvPluginBundling = bundling => {
  if (typeof bundling === "boolean") {
    bundling = {
      css: bundling,
      js_classic_workers: bundling,
      js_module: bundling
    };
  } else if (typeof bundling !== "object") {
    throw new Error(`bundling must be a boolean or an object, got ${bundling}`);
  }

  Object.keys(bundling).forEach(key => {
    if (bundling[key] === true) bundling[key] = {};
  });
  return {
    name: "jsenv:bundling",
    appliesDuring: {
      build: true
    },
    bundle: {
      css: bundling.css ? (cssUrlInfos, context) => {
        return bundleCss({
          cssUrlInfos,
          context,
          options: bundling.css
        });
      } : undefined,
      js_classic: bundling.js_classic ? (jsClassicUrlInfos, context) => {
        return bundleJsClassicWorkers({
          jsClassicUrlInfos,
          context,
          options: bundling.js_classic_workers
        });
      } : undefined,
      js_module: bundling.js_module ? (jsModuleUrlInfos, context) => {
        return bundleJsModule({
          jsModuleUrlInfos,
          context,
          options: bundling.js_module
        });
      } : undefined
    }
  };
};

const require$2 = createRequire(import.meta.url); // https://github.com/kangax/html-minifier#options-quick-reference


const minifyHtml = ({
  htmlUrlInfo,
  options
} = {}) => {
  const {
    collapseWhitespace = true,
    removeComments = true
  } = options;

  const {
    minify
  } = require$2("html-minifier");

  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    removeComments
  });
  return htmlMinified;
};

const minifyCss = ({
  cssUrlInfo,
  context
}) => {
  const {
    code,
    map
  } = minifyWithParcel(cssUrlInfo, context);
  return {
    content: String(code),
    sourcemap: map
  };
};

// https://github.com/terser-js/terser#minify-options
const minifyJs = async ({
  jsUrlInfo,
  options
}) => {
  const url = jsUrlInfo.url;
  const content = jsUrlInfo.content;
  const sourcemap = jsUrlInfo.sourcemap;
  const isJsModule = jsUrlInfo.type === "js_module";
  const {
    minify
  } = await import("terser");
  const terserResult = await minify({
    [url]: content
  }, {
    sourceMap: { ...(sourcemap ? {
        content: JSON.stringify(sourcemap)
      } : {}),
      asObject: true,
      includeSources: true
    },
    module: isJsModule,
    // We need to preserve "new InlineContent()" calls to be able to recognize them
    // after minification in order to version urls inside inline content text
    keep_fnames: /InlineContent/,
    ...options
  });
  return {
    content: terserResult.code,
    sourcemap: terserResult.map
  };
};

const minifyJson = ({
  jsonUrlInfo
}) => {
  const {
    content
  } = jsonUrlInfo;

  if (content.startsWith("{\n")) {
    const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content));
    return jsonWithoutWhitespaces;
  }

  return null;
};

const jsenvPluginMinification = minification => {
  if (typeof minification === "boolean") {
    minification = {
      html: minification,
      css: minification,
      js_classic: minification,
      js_module: minification,
      json: minification,
      svg: minification
    };
  } else if (typeof minification !== "object") {
    throw new Error(`minification must be a boolean or an object, got ${minification}`);
  }

  Object.keys(minification).forEach(key => {
    if (minification[key] === true) minification[key] = {};
  });
  const htmlOptimizer = minification.html ? (urlInfo, context) => minifyHtml({
    htmlUrlInfo: urlInfo,
    context,
    options: minification.html
  }) : null;
  const jsonOptimizer = minification.json ? (urlInfo, context) => minifyJson({
    jsonUrlInfo: urlInfo,
    context,
    options: minification.json
  }) : null;
  return {
    name: "jsenv:minification",
    appliesDuring: {
      build: true
    },
    optimizeUrlContent: {
      html: htmlOptimizer,
      svg: htmlOptimizer,
      css: minification.css ? (urlInfo, context) => minifyCss({
        cssUrlInfo: urlInfo,
        context,
        options: minification.css
      }) : null,
      js_classic: minification.js_classic ? (urlInfo, context) => minifyJs({
        jsUrlInfo: urlInfo,
        context,
        options: minification.js_classic
      }) : null,
      js_module: minification.js_module ? (urlInfo, context) => minifyJs({
        jsUrlInfo: urlInfo,
        context,
        options: minification.js_module
      }) : null,
      json: jsonOptimizer,
      importmap: jsonOptimizer,
      webmanifest: jsonOptimizer
    }
  };
};

// By default:
//   - hot reload on <img src="./image.png" />
//   - fullreload on <script src="./file.js" />
// Can be controlled by [hot-decline] and [hot-accept]:
//   - fullreload on <img src="./image.png" hot-decline />
//   - hot reload on <script src="./file.js" hot-accept />

const collectHotDataFromHtmlAst = htmlAst => {
  const hotReferences = [];

  const onSpecifier = ({
    specifier,
    node,
    attributeName,
    hotAccepted
  }) => {
    if ( // explicitely enabled with [hot-accept] attribute
    hotAccepted === true || htmlNodeCanHotReload(node)) {
      hotReferences.push({
        type: `${node.nodeName}_${attributeName}`,
        specifier
      });
    }
  };

  const visitUrlSpecifierAttribute = ({
    node,
    attributeName,
    hotAccepted
  }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName);
    const value = attribute ? attribute.value : undefined;

    if (value) {
      onSpecifier({
        specifier: value,
        node,
        attributeName,
        hotAccepted
      });
    }
  };

  const onNode = (node, {
    hotAccepted
  }) => {
    // explicitely disabled with [hot-decline] attribute
    if (hotAccepted === false) {
      return;
    }

    if (nodeNamesWithHref.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "href",
        hotAccepted
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "generated-from-href",
        hotAccepted
      });
    }

    if (nodeNamesWithSrc.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "src",
        hotAccepted
      });
      visitUrlSpecifierAttribute({
        node,
        attributeName: "generated-from-src",
        hotAccepted
      });
    }

    if (nodeNamesWithSrcset.includes(node.nodeName)) {
      const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset");
      const srcset = srcsetAttribute ? srcsetAttribute.value : undefined;

      if (srcset) {
        const srcCandidates = htmlAttributeSrcSet.parse(srcset);
        srcCandidates.forEach(srcCandidate => {
          onSpecifier({
            node,
            specifier: srcCandidate.specifier,
            attributeName: "srcset",
            hotAccepted
          });
        });
      }
    }
  };

  const iterate = (node, context) => {
    context = { ...context,
      ...getNodeContext(node)
    };
    onNode(node, context);
    const {
      childNodes
    } = node;

    if (childNodes) {
      let i = 0;

      while (i < childNodes.length) {
        const childNode = childNodes[i++];
        iterate(childNode, context);
      }
    }
  };

  iterate(htmlAst, {});
  return hotReferences;
};
const nodeNamesWithHref = ["link", "a", "image", "use"];
const nodeNamesWithSrc = ["script", "iframe", "img"];
const nodeNamesWithSrcset = ["img", "source"];

const getNodeContext = node => {
  const context = {};
  const hotAcceptAttribute = getHtmlNodeAttributeByName(node, "hot-accept");

  if (hotAcceptAttribute) {
    context.hotAccepted = true;
  }

  const hotDeclineAttribute = getHtmlNodeAttributeByName(node, "hot-decline");

  if (hotDeclineAttribute) {
    context.hotAccepted = false;
  }

  return context;
};

const htmlNodeCanHotReload = node => {
  if (node.nodeName === "link") {
    const {
      isStylesheet,
      isRessourceHint,
      rel
    } = parseLinkNode(node);

    if (isStylesheet) {
      // stylesheets can be hot replaced by default
      return true;
    }

    if (isRessourceHint) {
      // for ressource hints html will be notified the underlying ressource has changed
      // but we won't do anything (if the ressource is deleted we should?)
      return true;
    }

    if (rel === "icon") {
      return true;
    }

    return false;
  }

  return [// "script_src", // script src cannot hot reload
  "a", // Iframe will have their own event source client
  // and can hot reload independently
  // But if the iframe communicates with the parent iframe
  // then we canot know for sure if the communication is broken
  // ideally, if the iframe full-reload the page must full-reload too
  // if the iframe hot-reload we don't know but we could assume there is nothing to do
  // if there is [hot-accept] on the iframe
  "iframe", "img", "source", "image", "use"].includes(node.nodeName);
};

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7
const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        Object.assign(state.file.metadata, collectImportMetaProperties(programPath));
      }

    }
  };
};

const collectImportMetaProperties = programPath => {
  const importMetaHotPaths = [];
  let hotDecline = false;
  let hotAcceptSelf = false;
  let hotAcceptDependencies = [];
  programPath.traverse({
    MemberExpression(path) {
      const {
        node
      } = path;
      const {
        object
      } = node;

      if (object.type !== "MetaProperty") {
        return;
      }

      const {
        property: objectProperty
      } = object;

      if (objectProperty.name !== "meta") {
        return;
      }

      const {
        property
      } = node;
      const {
        name
      } = property;

      if (name === "hot") {
        importMetaHotPaths.push(path);
      }
    },

    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node;
        const args = callNode.arguments;

        if (args.length === 0) {
          hotAcceptSelf = true;
          return;
        }

        const firstArg = args[0];

        if (firstArg.type === "StringLiteral") {
          hotAcceptDependencies = [{
            specifierPath: path.get("arguments")[0]
          }];
          return;
        }

        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0];
          hotAcceptDependencies = firstArg.elements.map((arrayNode, index) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(`all array elements must be strings in "import.meta.hot.accept(array)"`);
            }

            return {
              specifierPath: firstArgPath.get(String(index))
            };
          });
          return;
        } // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.accept(cb)`


        hotAcceptSelf = true;
      }

      if (isImportMetaHotMethodCall(path, "decline")) {
        hotDecline = true;
      }
    }

  });
  return {
    importMetaHotPaths,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies
  };
};

const isImportMetaHotMethodCall = (path, methodName) => {
  const {
    property,
    object
  } = path.node.callee;
  return property && property.name === methodName && object && object.property && object.property.name === "hot" && object.object.type === "MetaProperty";
};

const jsenvPluginImportMetaHot = () => {
  const importMetaHotClientFileUrl = new URL("./js/import_meta_hot.js", import.meta.url).href;
  return {
    name: "jsenv:import_meta_hot",
    appliesDuring: "*",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        // during build we don't really care to parse html hot dependencies
        if (context.scenario === "build") {
          return;
        }

        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const hotReferences = collectHotDataFromHtmlAst(htmlAst);
        htmlUrlInfo.data.hotDecline = false;
        htmlUrlInfo.data.hotAcceptSelf = false;
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(({
          type,
          specifier
        }) => {
          const [reference] = context.referenceUtils.found({
            type,
            specifier
          });
          return reference.url;
        });
      },
      css: cssUrlInfo => {
        cssUrlInfo.data.hotDecline = false;
        cssUrlInfo.data.hotAcceptSelf = false;
        cssUrlInfo.data.hotAcceptDependencies = [];
      },
      js_module: async (urlInfo, context) => {
        if (!urlInfo.content.includes("import.meta.hot")) {
          return null;
        }

        const {
          metadata
        } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          urlInfo
        });
        const {
          importMetaHotPaths,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies
        } = metadata;
        urlInfo.data.hotDecline = hotDecline;
        urlInfo.data.hotAcceptSelf = hotAcceptSelf;
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies;

        if (importMetaHotPaths.length === 0) {
          return null;
        }

        if (context.scenario === "build") {
          return removeImportMetaHots(urlInfo, importMetaHotPaths);
        }

        return injectImportMetaHot(urlInfo, context, importMetaHotClientFileUrl);
      }
    }
  };
};

const removeImportMetaHots = (urlInfo, importMetaHotPaths) => {
  const magicSource = createMagicSource(urlInfo.content);
  importMetaHotPaths.forEach(path => {
    magicSource.replace({
      start: path.node.start,
      end: path.node.end,
      replacement: "undefined"
    });
  });
  return magicSource.toContentAndSourcemap();
}; // For some reason using magic source here produce
// better sourcemap than doing the equivalent with babel
// I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
// which is likely not well supported by babel


const injectImportMetaHot = (urlInfo, context, importMetaHotClientFileUrl) => {
  const [importMetaHotClientFileReference] = context.referenceUtils.inject({
    parentUrl: urlInfo.url,
    type: "js_import_export",
    expectedType: "js_module",
    specifier: importMetaHotClientFileUrl
  });
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(`import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier}
import.meta.hot = createImportMetaHot(import.meta.url)
`);
  return magicSource.toContentAndSourcemap();
};

const jsenvPluginHmr = () => {
  return {
    name: "jsenv:hmr",
    appliesDuring: {
      dev: true
    },
    redirectUrl: reference => {
      const urlObject = new URL(reference.url);

      if (!urlObject.searchParams.has("hmr")) {
        reference.data.hmr = false;
        return null;
      }

      reference.data.hmr = true; // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)

      urlObject.searchParams.delete("hmr");
      urlObject.searchParams.delete("v");
      return urlObject.href;
    },
    transformUrlSearchParams: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);

      if (!parentUrlInfo || !parentUrlInfo.data.hmr) {
        return null;
      }

      const urlInfo = context.urlGraph.getUrlInfo(reference.url);

      if (!urlInfo.modifiedTimestamp) {
        return null;
      }

      return {
        hmr: "",
        v: urlInfo.modifiedTimestamp
      };
    }
  };
};

const jsenvPluginDevSSEClient = () => {
  const eventSourceClientFileUrl = new URL("./js/event_source_client.js", import.meta.url).href;
  return {
    name: "jsenv:dev_sse_client",
    appliesDuring: {
      dev: true
    },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const [eventSourceClientReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: eventSourceClientFileUrl
        });
        injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
          "tagName": "script",
          "type": "module",
          "src": eventSourceClientReference.generatedSpecifier,
          "injected-by": "jsenv:dev_sse_client"
        }));
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

const jsenvPluginDevSSEServer = ({
  rootDirectoryUrl,
  urlGraph,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
}) => {
  const serverEventCallbackList = createCallbackList();
  const sseService = createSSEService({
    serverEventCallbackList
  });

  const notifyDeclined = ({
    cause,
    reason,
    declinedBy
  }) => {
    serverEventCallbackList.notify({
      type: "reload",
      data: JSON.stringify({
        cause,
        type: "full",
        typeReason: reason,
        declinedBy
      })
    });
  };

  const notifyAccepted = ({
    cause,
    reason,
    instructions
  }) => {
    serverEventCallbackList.notify({
      type: "reload",
      data: JSON.stringify({
        cause,
        type: "hot",
        typeReason: reason,
        hotInstructions: instructions
      })
    });
  };

  const propagateUpdate = firstUrlInfo => {
    const urlInfos = urlGraph.urlInfos;

    const iterate = (urlInfo, trace) => {
      if (urlInfo.data.hotAcceptSelf) {
        return {
          accepted: true,
          reason: urlInfo === firstUrlInfo ? `file accepts hot reload` : `a dependent file accepts hot reload`,
          instructions: [{
            type: urlInfo.type,
            boundary: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl),
            acceptedBy: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl)
          }]
        };
      }

      const {
        dependents
      } = urlInfo;
      const instructions = [];

      for (const dependentUrl of dependents) {
        const dependentUrlInfo = urlInfos[dependentUrl];

        if (dependentUrlInfo.data.hotDecline) {
          return {
            declined: true,
            reason: `a dependent file declines hot reload`,
            declinedBy: dependentUrl
          };
        }

        const {
          hotAcceptDependencies = []
        } = dependentUrlInfo.data;

        if (hotAcceptDependencies.includes(urlInfo.url)) {
          instructions.push({
            type: dependentUrlInfo.type,
            boundary: urlToRelativeUrl(dependentUrl, rootDirectoryUrl),
            acceptedBy: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl)
          });
          continue;
        }

        if (trace.includes(dependentUrl)) {
          return {
            declined: true,
            reason: "circular dependency",
            declinedBy: urlToRelativeUrl(dependentUrl, rootDirectoryUrl)
          };
        }

        const dependentPropagationResult = iterate(dependentUrlInfo, [...trace, dependentUrl]);

        if (dependentPropagationResult.accepted) {
          instructions.push(...dependentPropagationResult.instructions);
          continue;
        }

        if ( // declined explicitely by an other file, it must decline the whole update
        dependentPropagationResult.declinedBy) {
          return dependentPropagationResult;
        } // declined by absence of boundary, we can keep searching


        continue;
      }

      if (instructions.length === 0) {
        return {
          declined: true,
          reason: `there is no file accepting hot reload while propagating update`
        };
      }

      return {
        accepted: true,
        reason: `${instructions.length} dependent file(s) accepts hot reload`,
        instructions
      };
    };

    const trace = [];
    return iterate(firstUrlInfo, trace);
  };

  clientFileChangeCallbackList.push(({
    url,
    event
  }) => {
    const urlInfo = urlGraph.getUrlInfo(url); // file not part of dependency graph

    if (!urlInfo) {
      return;
    }

    const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
    const hotUpdate = propagateUpdate(urlInfo);

    if (hotUpdate.declined) {
      notifyDeclined({
        cause: `${relativeUrl} ${event}`,
        reason: hotUpdate.reason,
        declinedBy: hotUpdate.declinedBy
      });
    } else {
      notifyAccepted({
        cause: `${relativeUrl} ${event}`,
        reason: hotUpdate.reason,
        instructions: hotUpdate.instructions
      });
    }
  });
  clientFilesPruneCallbackList.push(({
    prunedUrlInfos,
    firstUrlInfo
  }) => {
    const mainHotUpdate = propagateUpdate(firstUrlInfo);
    const cause = `following files are no longer referenced: ${prunedUrlInfos.map(prunedUrlInfo => urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl))}`; // now check if we can hot update the main ressource
    // then if we can hot update all dependencies

    if (mainHotUpdate.declined) {
      notifyDeclined({
        cause,
        reason: mainHotUpdate.reason,
        declinedBy: mainHotUpdate.declinedBy
      });
      return;
    } // main can hot update


    let i = 0;
    const instructions = [];

    while (i < prunedUrlInfos.length) {
      const prunedUrlInfo = prunedUrlInfos[i++];

      if (prunedUrlInfo.data.hotDecline) {
        notifyDeclined({
          cause,
          reason: `a pruned file declines hot reload`,
          declinedBy: urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl)
        });
        return;
      }

      instructions.push({
        type: "prune",
        boundary: urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl),
        acceptedBy: urlToRelativeUrl(firstUrlInfo.url, rootDirectoryUrl)
      });
    }

    notifyAccepted({
      cause,
      reason: mainHotUpdate.reason,
      instructions
    });
  });
  return {
    name: "jsenv:sse_server",
    appliesDuring: {
      dev: true
    },
    serve: request => {
      if (request.ressource === "/__graph__") {
        const graphJson = JSON.stringify(urlGraph.toJSON(rootDirectoryUrl));
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson)
          },
          body: graphJson
        };
      }

      const {
        accept
      } = request.headers;

      if (accept && accept.includes("text/event-stream")) {
        const room = sseService.getOrCreateSSERoom(request);
        return room.join(request);
      }

      return null;
    },
    destroy: () => {
      sseService.destroy();
    }
  };
};

const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  scenario,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
}) => {
  if (scenario === "build") {
    return [];
  }

  return [jsenvPluginHmr(), jsenvPluginDevSSEClient(), jsenvPluginDevSSEServer({
    rootDirectoryUrl,
    urlGraph,
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList
  })];
};

const jsenvPluginCacheControl = () => {
  return {
    name: "jsenv:cache_control",
    appliesDuring: {
      dev: true,
      test: true
    },
    augmentResponse: ({
      reference
    }, context) => {
      if (context.scenario === "test") {
        // During dev, all files are put into browser cache for 1 hour because:
        // 1: Browser cache is a temporary directory created by playwright
        // 2: We assume source files won't be modified while tests are running
        return {
          headers: {
            "cache-control": `private,max-age=3600,immutable`
          }
        };
      }

      if (reference.searchParams.has("v") && !reference.searchParams.has("hmr")) {
        return {
          headers: {
            "cache-control": `private,max-age=${SECONDS_IN_30_DAYS$1},immutable`
          }
        };
      }

      return null;
    }
  };
};
const SECONDS_IN_30_DAYS$1 = 60 * 60 * 24 * 30;

const getCorePlugins = ({
  rootDirectoryUrl,
  urlGraph,
  scenario,
  runtimeCompat,
  urlAnalysis = {},
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  directoryReferenceAllowed,
  injectedGlobals,
  transpilation = true,
  minification = false,
  bundling = false,
  clientAutoreload = false,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
} = {}) => {
  if (htmlSupervisor === true) {
    htmlSupervisor = {};
  }

  if (nodeEsmResolution === true) {
    nodeEsmResolution = {};
  }

  return [jsenvPluginUrlAnalysis({
    rootDirectoryUrl,
    ...urlAnalysis
  }), jsenvPluginTranspilation(transpilation), ...(htmlSupervisor ? [jsenvPluginHtmlSupervisor(htmlSupervisor)] : []), // before inline as it turns inline <script> into <script src>
  jsenvPluginInline(), // before "file urls" to resolve and load inline urls
  jsenvPluginImportmap(), // before node esm to handle bare specifiers before node esm
  jsenvPluginFileUrls({
    directoryReferenceAllowed,
    ...fileSystemMagicResolution
  }), jsenvPluginHttpUrls(), jsenvPluginLeadingSlash(), // before url resolution to handle "js_import_export" resolution
  jsenvPluginNodeEsmResolution({
    rootDirectoryUrl,
    runtimeCompat,
    ...nodeEsmResolution
  }), jsenvPluginUrlResolution(), jsenvPluginUrlVersion(), jsenvPluginInjectGlobals(injectedGlobals), jsenvPluginCommonJsGlobals(), jsenvPluginImportMetaScenarios(), jsenvPluginNodeRuntime({
    runtimeCompat
  }), jsenvPluginBundling(bundling), jsenvPluginMinification(minification), jsenvPluginImportMetaHot(), ...(clientAutoreload ? [jsenvPluginAutoreload({
    rootDirectoryUrl,
    urlGraph,
    scenario,
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList
  })] : []), jsenvPluginCacheControl()];
};

const urlSpecifierEncoding = {
  encode: reference => {
    const {
      generatedSpecifier
    } = reference;

    if (generatedSpecifier.then) {
      return generatedSpecifier.then(value => {
        reference.generatedSpecifier = value;
        return urlSpecifierEncoding.encode(reference);
      });
    } // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)


    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier();
    }

    const formatter = formatters[reference.type];
    const value = formatter ? formatter.encode(generatedSpecifier) : generatedSpecifier;

    if (reference.escape) {
      return reference.escape(value);
    }

    return value;
  },
  decode: reference => {
    const formatter = formatters[reference.type];
    return formatter ? formatter.decode(reference.generatedSpecifier) : reference.generatedSpecifier;
  }
};
const formatters = {
  "js_import_export": {
    encode: JSON.stringify,
    decode: JSON.parse
  },
  "js_url_specifier": {
    encode: JSON.stringify,
    decode: JSON.parse
  },
  "css_@import": {
    encode: JSON.stringify,
    code: JSON.stringify
  },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
    encode: url => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url); // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls

      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }

      return url;
    },
    decode: url => {
      const firstChar = url[0];
      const lastChar = url[url.length - 1];

      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1);
      }

      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1);
      }

      return url;
    }
  }
};

const createUrlGraph = ({
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList
} = {}) => {
  const urlInfos = {};

  const getUrlInfo = url => urlInfos[url];

  const deleteUrlInfo = url => {
    const urlInfo = urlInfos[url];

    if (urlInfo) {
      delete urlInfos[url];

      if (urlInfo.sourcemapReference) {
        deleteUrlInfo(urlInfo.sourcemapReference.url);
      }
    }
  };

  const reuseOrCreateUrlInfo = url => {
    const existingUrlInfo = urlInfos[url];
    if (existingUrlInfo) return existingUrlInfo;
    const urlInfo = createUrlInfo(url);
    urlInfos[url] = urlInfo;
    return urlInfo;
  };

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = urlInfos[parentUrl];

    if (!parentUrlInfo) {
      return null;
    }

    const firstReferenceOnThatUrl = parentUrlInfo.references.find(reference => {
      return urlSpecifierEncoding.decode(reference) === specifier;
    });
    return firstReferenceOnThatUrl;
  };

  const findDependent = (url, predicate) => {
    const urlInfo = urlInfos[url];

    if (!urlInfo) {
      return null;
    }

    const visitDependents = urlInfo => {
      for (const dependentUrl of urlInfo.dependents) {
        const dependent = urlInfos[dependentUrl];

        if (predicate(dependent)) {
          return dependent;
        }

        return visitDependents(dependent);
      }

      return null;
    };

    return visitDependents(urlInfo);
  };

  const updateReferences = (urlInfo, references) => {
    const dependencyUrls = [];
    references.forEach(reference => {
      if (reference.isRessourceHint) {
        // ressource hint are a special kind of reference.
        // They are a sort of weak reference to an url.
        // We ignore them so that url referenced only by ressource hints
        // have url.dependents.size === 0 and can be considered as not used
        // It means html won't consider url referenced solely
        // by <link> as dependency and it's fine
        return;
      }

      if (dependencyUrls.includes(reference.url)) {
        return;
      }

      dependencyUrls.push(reference.url);
    });
    pruneDependencies(urlInfo, Array.from(urlInfo.dependencies).filter(dep => !dependencyUrls.includes(dep)));
    urlInfo.references = references;
    dependencyUrls.forEach(dependencyUrl => {
      const dependencyUrlInfo = reuseOrCreateUrlInfo(dependencyUrl);
      urlInfo.dependencies.add(dependencyUrl);
      dependencyUrlInfo.dependents.add(urlInfo.url);
    });
    return urlInfo;
  };

  const pruneDependencies = (firstUrlInfo, urlsToRemove) => {
    const prunedUrlInfos = [];

    const removeDependencies = (urlInfo, urlsToPrune) => {
      urlsToPrune.forEach(urlToPrune => {
        urlInfo.dependencies.delete(urlToPrune);
        const dependency = urlInfos[urlToPrune];

        if (!dependency) {
          return;
        }

        dependency.dependents.delete(urlInfo.url);

        if (dependency.dependents.size === 0) {
          removeDependencies(dependency, Array.from(dependency.dependencies));
          prunedUrlInfos.push(dependency);
        }
      });
    };

    removeDependencies(firstUrlInfo, urlsToRemove);

    if (prunedUrlInfos.length === 0) {
      return;
    }

    prunedUrlInfos.forEach(prunedUrlInfo => {
      prunedUrlInfo.modifiedTimestamp = Date.now(); // should we delete?
      // delete urlInfos[prunedUrlInfo.url]
    });

    if (clientFilesPruneCallbackList) {
      clientFilesPruneCallbackList.forEach(callback => {
        callback({
          firstUrlInfo,
          prunedUrlInfos
        });
      });
    }
  };

  if (clientFileChangeCallbackList) {
    const updateModifiedTimestamp = (urlInfo, modifiedTimestamp) => {
      const seen = [];

      const iterate = urlInfo => {
        if (seen.includes(urlInfo.url)) {
          return;
        }

        seen.push(urlInfo.url);
        urlInfo.modifiedTimestamp = modifiedTimestamp;
        urlInfo.dependents.forEach(dependentUrl => {
          const dependentUrlInfo = urlInfos[dependentUrl];
          const {
            hotAcceptDependencies = []
          } = dependentUrlInfo.data;

          if (!hotAcceptDependencies.includes(urlInfo.url)) {
            iterate(dependentUrlInfo);
          }
        });
      };

      iterate(urlInfo);
    };

    clientFileChangeCallbackList.push(({
      url
    }) => {
      const urlInfo = urlInfos[url];

      if (urlInfo) {
        updateModifiedTimestamp(urlInfo, Date.now());
        urlInfo.contentEtag = null;
      }
    });
  }

  return {
    urlInfos,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    inferReference,
    findDependent,
    updateReferences,
    toJSON: rootDirectoryUrl => {
      const data = {};
      Object.keys(urlInfos).forEach(url => {
        const dependencyUrls = Array.from(urlInfos[url].dependencies);

        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
          data[relativeUrl] = dependencyUrls.map(dependencyUrl => urlToRelativeUrl(dependencyUrl, rootDirectoryUrl));
        }
      });
      return data;
    }
  };
};

const createUrlInfo = url => {
  return {
    modifiedTimestamp: 0,
    data: {},
    // plugins can put whatever they want here
    references: [],
    dependencies: new Set(),
    dependents: new Set(),
    type: undefined,
    // "html", "css", "js_classic", "js_module", "importmap", "json", "webmanifest", ...
    subtype: undefined,
    // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    contentType: "",
    // "text/html", "text/css", "text/javascript", "application/json", ...
    url,
    filename: "",
    generatedUrl: null,
    isInline: false,
    inlineUrlSite: null,
    shouldHandle: undefined,
    originalContent: undefined,
    content: undefined,
    contentEtag: null,
    sourcemap: null,
    sourcemapReference: null,
    timing: {},
    responseHeaders: {}
  };
};

const createPluginController = ({
  plugins,
  scenario,
  hooks = ["resolveUrl", "redirectUrl", "fetchUrlContent", "transformUrlContent", "transformUrlSearchParams", "formatUrl", "finalizeUrlContent", "cooked", "destroy"]
}) => {
  plugins = flattenAndFilterPlugins(plugins, {
    scenario
  }); // precompute a list of hooks per hookName
  // For one major reason:
  // - When debugging, there is less iteration
  // And also it should increase perf as there is less work to do

  const hookGroups = {};

  const addHook = hookName => {
    const hooks = [];
    plugins.forEach(plugin => {
      const hook = plugin[hookName];

      if (hook) {
        hooks.push({
          plugin,
          hookName,
          value: hook
        });
      }
    });
    hookGroups[hookName] = hooks;
    return hooks;
  };

  hooks.forEach(hookName => {
    addHook(hookName);
  });
  let currentPlugin = null;
  let currentHookName = null;

  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);

    if (!hookFn) {
      return null;
    }

    currentPlugin = hook.plugin;
    currentHookName = hook.hookName;
    const timeEnd = timeStart(`${currentHookName}-${currentPlugin.name.replace("jsenv:", "")}`);
    let valueReturned = hookFn(info, context);

    if (info.timing) {
      Object.assign(info.timing, timeEnd());
    }

    valueReturned = assertAndNormalizeReturnValue(hook.hookName, valueReturned);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };

  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);

    if (!hookFn) {
      return null;
    }

    currentPlugin = hook.plugin;
    currentHookName = hook.hookName;
    const timeEnd = timeStart(`${currentHookName}-${currentPlugin.name.replace("jsenv:", "")}`);
    let valueReturned = await hookFn(info, context);

    if (info.timing) {
      Object.assign(info.timing, timeEnd());
    }

    valueReturned = assertAndNormalizeReturnValue(hook.hookName, valueReturned);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };

  const callHooks = (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName];

    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context);

      if (returnValue) {
        callback(returnValue);
      }
    }
  };

  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName];
    await hooks.reduce(async (previous, hook) => {
      await previous;
      const returnValue = await callAsyncHook(hook, info, context);

      if (returnValue && callback) {
        await callback(returnValue);
      }
    }, Promise.resolve());
  };

  const callHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName];

    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context);

      if (returnValue) {
        return returnValue;
      }
    }

    return null;
  };

  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName];

    if (hooks.length === 0) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const visit = index => {
        if (index >= hooks.length) {
          return resolve();
        }

        const hook = hooks[index];
        const returnValue = callAsyncHook(hook, info, context);
        return Promise.resolve(returnValue).then(output => {
          if (output) {
            return resolve(output);
          }

          return visit(index + 1);
        }, reject);
      };

      visit(0);
    });
  };

  return {
    plugins,
    addHook,
    getHookFunction,
    callHook,
    callAsyncHook,
    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,
    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName
  };
};

const flattenAndFilterPlugins = (pluginsRaw, {
  scenario
}) => {
  const plugins = [];

  const visitPluginEntry = pluginEntry => {
    if (Array.isArray(pluginEntry)) {
      pluginEntry.forEach(value => visitPluginEntry(value));
      return;
    }

    if (typeof pluginEntry === "object" && pluginEntry !== null) {
      if (!pluginEntry.name) {
        pluginEntry.name = "anonymous";
      }

      const {
        appliesDuring
      } = pluginEntry;

      if (appliesDuring === undefined) {
        console.warn(`"appliesDuring" is undefined on ${pluginEntry.name}`);
        return;
      }

      if (appliesDuring === "*") {
        plugins.push(pluginEntry);
        return;
      }

      if (typeof appliesDuring === "string") {
        if (!["dev", "build", "test"].includes(appliesDuring)) {
          throw new Error(`"appliesDuring" must be "dev", "test" or "build", got ${appliesDuring}`);
        }

        if (appliesDuring === scenario) {
          plugins.push(pluginEntry);
        }

        return;
      }

      if (typeof appliesDuring !== "object") {
        throw new Error(`"appliesDuring" must be an object or a string, got ${appliesDuring}`);
      }

      if (appliesDuring[scenario]) {
        plugins.push(pluginEntry);
        return;
      }

      if (pluginEntry.destroy) {
        pluginEntry.destroy();
      }

      return;
    }

    throw new Error(`plugin must be objects, got ${pluginEntry}`);
  };

  pluginsRaw.forEach(plugin => visitPluginEntry(plugin));
  return plugins;
};

const getHookFunction = (hook, // can be undefined, reference, or urlInfo
info = {}) => {
  const hookValue = hook.value;

  if (typeof hookValue === "object") {
    const hookForType = hookValue[info.type] || hookValue["*"];

    if (!hookForType) {
      return null;
    }

    return hookForType;
  }

  return hookValue;
};

const assertAndNormalizeReturnValue = (hookName, returnValue) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue;
  }

  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hookName)) {
      continue;
    }

    const assertionResult = returnValueAssertion.assertion(returnValue);

    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult;
      break;
    }
  }

  return returnValue;
};

const returnValueAssertions = [{
  name: "url_assertion",
  appliesTo: ["resolveUrl", "redirectUrl"],
  assertion: valueReturned => {
    if (valueReturned instanceof URL) {
      return valueReturned.href;
    }

    if (typeof valueReturned === "string") {
      return undefined;
    }

    throw new Error(`Unexpected value returned by plugin: it must be a string; got ${valueReturned}`);
  }
}, {
  name: "content_assertion",
  appliesTo: ["fetchUrlContent", "transformUrlContent", "finalizeUrlContent", "optimizeUrlContent"],
  assertion: valueReturned => {
    if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
      return {
        content: valueReturned
      };
    }

    if (typeof valueReturned === "object") {
      const {
        shouldHandle,
        content
      } = valueReturned;

      if (shouldHandle === false) {
        return undefined;
      }

      if (typeof content !== "string" && !Buffer.isBuffer(content)) {
        throw new Error(`Unexpected "content" returned by plugin: it must be a string or a buffer; got ${content}`);
      }

      return undefined;
    }

    throw new Error(`Unexpected value returned by plugin: it must be a string, a buffer or an object; got ${valueReturned}`);
  }
}];

const createUrlInfoTransformer = ({
  logger,
  sourcemaps,
  sourcemapsSourcesContent,
  sourcemapsRelativeSources,
  urlGraph,
  injectSourcemapPlaceholder,
  foundSourcemap
}) => {
  const sourcemapsEnabled = sourcemaps === "inline" || sourcemaps === "file" || sourcemaps === "programmatic";

  const normalizeSourcemap = (urlInfo, sourcemap) => {
    const wantSourcesContent = // for inline content (<script> insdide html)
    // chrome won't be able to fetch the file as it does not exists
    // so sourcemap must contain sources
    sourcemapsSourcesContent || urlInfo.isInline || sourcemap.sources && sourcemap.sources.some(source => !source || !source.startsWith("file:"));

    if (sourcemap.sources && sourcemap.sources.length > 1) {
      sourcemap.sources = sourcemap.sources.map(source => new URL(source, urlInfo.data.rawUrl || urlInfo.url).href);

      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined;
      }

      return sourcemap;
    }

    sourcemap.sources = [urlInfo.data.rawUrl || urlInfo.url];
    sourcemap.sourcesContent = [urlInfo.originalContent];

    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined;
    }

    return sourcemap;
  };

  const initTransformations = async (urlInfo, context) => {
    if (!sourcemapsEnabled) {
      return;
    }

    if (!SOURCEMAP.enabledOnContentType(urlInfo.contentType)) {
      return;
    } // sourcemap is a special kind of reference:
    // It's a reference to a content generated dynamically the content itself.
    // For this reason sourcemap are not added to urlInfo.references
    // Instead they are stored into urlInfo.sourcemapReference
    // create a placeholder reference for the sourcemap that will be generated
    // when jsenv is done cooking the file
    //   during build it's urlInfo.url to be inside the build
    //   but otherwise it's generatedUrl to be inside .jsenv/ directory


    urlInfo.sourcemapGeneratedUrl = generateSourcemapUrl(urlInfo.generatedUrl);
    const [sourcemapReference, sourcemapUrlInfo] = injectSourcemapPlaceholder({
      urlInfo,
      specifier: urlInfo.sourcemapGeneratedUrl
    });
    urlInfo.sourcemapReference = sourcemapReference;
    sourcemapUrlInfo.isInline = sourcemaps === "inline"; // already loaded during "load" hook (happens during build)

    if (urlInfo.sourcemap) {
      return;
    } // check for existing sourcemap for this content


    const sourcemapFound = SOURCEMAP.readComment({
      contentType: urlInfo.contentType,
      content: urlInfo.content
    });

    if (sourcemapFound) {
      const {
        type,
        line,
        column,
        specifier
      } = sourcemapFound;
      const [sourcemapReference, sourcemapUrlInfo] = foundSourcemap({
        urlInfo,
        type,
        specifier,
        specifierLine: line,
        specifierColumn: column
      });

      try {
        await context.cook(sourcemapUrlInfo, {
          reference: sourcemapReference
        });
        const sourcemap = JSON.parse(sourcemapUrlInfo.content);
        urlInfo.sourcemap = normalizeSourcemap(urlInfo, sourcemap);
      } catch (e) {
        logger.error(`Error while handling existing sourcemap: ${e.message}`);
        return;
      }
    }
  };

  const applyIntermediateTransformations = async (urlInfo, transformations) => {
    if (!transformations) {
      return;
    }

    const {
      type,
      contentType,
      content,
      sourcemap
    } = transformations;

    if (type) {
      urlInfo.type = type;
    }

    if (contentType) {
      urlInfo.contentType = contentType;
    }

    if (content) {
      urlInfo.content = content;
    }

    if (sourcemapsEnabled && sourcemap) {
      const sourcemapNormalized = normalizeSourcemap(urlInfo, sourcemap);
      const finalSourcemap = await composeTwoSourcemaps(urlInfo.sourcemap, sourcemapNormalized);
      const finalSourcemapNormalized = normalizeSourcemap(urlInfo, finalSourcemap);
      urlInfo.sourcemap = finalSourcemapNormalized;
    }
  };

  const applyFinalTransformations = async (urlInfo, transformations) => {
    if (transformations) {
      await applyIntermediateTransformations(urlInfo, transformations);
    }

    if (sourcemapsEnabled && urlInfo.sourcemap) {
      // during build this function can be called after the file is cooked
      // - to update content and sourcemap after "optimize" hook
      // - to inject versioning into the entry point content
      // in this scenarion we don't want to call injectSourcemap
      // just update the content and the
      const sourcemapReference = urlInfo.sourcemapReference;
      const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url);
      sourcemapUrlInfo.contentType = "application/json";
      const sourcemap = urlInfo.sourcemap;

      if (sourcemapsRelativeSources) {
        sourcemap.sources = sourcemap.sources.map(source => {
          const sourceRelative = urlToRelativeUrl(source, urlInfo.url);
          return sourceRelative;
        });
      }

      sourcemapUrlInfo.content = JSON.stringify(sourcemap, null, "  ");

      if (sourcemaps === "inline") {
        sourcemapReference.generatedSpecifier = sourcemapToBase64Url(sourcemap);
      }

      if (sourcemaps === "file" || sourcemaps === "inline") {
        urlInfo.content = SOURCEMAP.writeComment({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier: sourcemaps === "file" && sourcemapsRelativeSources ? urlToRelativeUrl(sourcemapReference.url, urlInfo.url) : sourcemapReference.generatedSpecifier
        });
      }
    }

    urlInfo.contentEtag = bufferToEtag(Buffer.from(urlInfo.content));
  };

  return {
    initTransformations,
    applyIntermediateTransformations,
    applyFinalTransformations
  };
};

const createResolveUrlError = ({
  pluginController,
  reference,
  error
}) => {
  const createFailedToResolveUrlError = ({
    code = error.code || "RESOLVE_URL_ERROR",
    reason,
    ...details
  }) => {
    const resolveError = new Error(createDetailedMessage(`Failed to resolve url reference`, {
      reason,
      ...details,
      "specifier": `"${reference.specifier}"`,
      "specifier trace": reference.trace,
      ...detailsFromPluginController(pluginController)
    }));
    resolveError.name = "RESOLVE_URL_ERROR";
    resolveError.code = code;
    resolveError.reason = reason;
    return resolveError;
  };

  if (error.message === "NO_RESOLVE") {
    return createFailedToResolveUrlError({
      reason: `no plugin has handled the specifier during "resolveUrl" hook`
    });
  }

  return createFailedToResolveUrlError({
    reason: `An error occured during specifier resolution`,
    ...detailsFromValueThrown(error)
  });
};
const createFetchUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  const createFailedToFetchUrlContentError = ({
    code = error.code || "FETCH_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const fetchContentError = new Error(createDetailedMessage(`Failed to fetch url content`, {
      reason,
      ...details,
      "url": urlInfo.url,
      "url reference trace": reference.trace,
      ...detailsFromPluginController(pluginController)
    }));
    fetchContentError.name = "FETCH_URL_CONTENT_ERROR";
    fetchContentError.code = code;
    fetchContentError.reason = reason;
    return fetchContentError;
  };

  if (error.code === "EPERM") {
    return createFailedToFetchUrlContentError({
      code: "NOT_ALLOWED",
      reason: `not allowed to read entry on filesystem`
    });
  }

  if (error.code === "EISDIR") {
    return createFailedToFetchUrlContentError({
      code: "EISDIR",
      reason: `found a directory on filesystem`
    });
  }

  if (error.code === "ENOENT") {
    return createFailedToFetchUrlContentError({
      code: "NOT_FOUND",
      reason: "no entry on filesystem"
    });
  }

  return createFailedToFetchUrlContentError({
    reason: `An error occured during "fetchUrlContent"`,
    ...detailsFromValueThrown(error)
  });
};
const createTransformUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  const createFailedToTransformError = ({
    code = error.code || "TRANSFORM_URL_CONTENT_ERROR",
    reason,
    ...details
  }) => {
    const transformError = new Error(createDetailedMessage(`Failed to transform url content of "${urlInfo.type}"`, {
      reason,
      ...details,
      "url": urlInfo.url,
      "url reference trace": reference.trace,
      ...detailsFromPluginController(pluginController)
    }));
    transformError.name = "TRANSFORM_URL_CONTENT_ERROR";
    transformError.code = code;
    transformError.reason = reason;
    return transformError;
  };

  return createFailedToTransformError({
    reason: `An error occured during "transformUrlContent"`,
    ...detailsFromValueThrown(error)
  });
};
const createFinalizeUrlContentError = ({
  pluginController,
  reference,
  urlInfo,
  error
}) => {
  const finalizeError = new Error(createDetailedMessage(`Failed to finalize ${urlInfo.type} url content`, {
    "reason": `An error occured during "finalizeUrlContent"`,
    ...detailsFromValueThrown(error),
    "url": urlInfo.url,
    "url reference trace": reference.trace,
    ...detailsFromPluginController(pluginController)
  }));
  finalizeError.name = "FINALIZE_URL_CONTENT_ERROR";
  finalizeError.reason = `An error occured during "finalizeUrlContent"`;
  return finalizeError;
};

const detailsFromPluginController = pluginController => {
  const currentPlugin = pluginController.getCurrentPlugin();

  if (!currentPlugin) {
    return null;
  }

  return {
    "plugin name": `"${currentPlugin.name}"`
  };
};

const detailsFromValueThrown = valueThrownByPlugin => {
  if (valueThrownByPlugin && valueThrownByPlugin instanceof Error) {
    return {
      "error stack": valueThrownByPlugin.stack
    };
  }

  if (valueThrownByPlugin === undefined) {
    return {
      error: "undefined"
    };
  }

  return {
    error: JSON.stringify(valueThrownByPlugin)
  };
};

const assertFetchedContentCompliance = ({
  reference,
  urlInfo
}) => {
  const {
    expectedContentType
  } = reference;

  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(`Unexpected content-type on url: got "${urlInfo.contentType}" instead of "${expectedContentType}"`);
  }

  const {
    expectedType
  } = reference;

  if (expectedType && urlInfo.type !== expectedType) {
    throw new Error(`Unexpected type on url: got "${urlInfo.type}" instead of "${expectedType}"`);
  }

  const {
    integrity
  } = reference;

  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: urlInfo.content
    });
  }
};

const createKitchen = ({
  signal,
  logger,
  rootDirectoryUrl,
  urlGraph,
  plugins,
  scenario,
  sourcemaps = {
    dev: "inline",
    // "programmatic" and "file" also allowed
    test: "inline",
    build: "none"
  }[scenario],
  sourcemapsSourcesContent = {
    // during dev/test, chrome is able to find the sourcemap sources
    // as long as they use file:// protocol in the sourcemap files
    dev: false,
    test: false,
    build: true
  }[scenario],
  sourcemapsRelativeSources,
  runtimeCompat,
  writeGeneratedFiles
}) => {
  const pluginController = createPluginController({
    plugins,
    scenario
  });
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href;
  const kitchenContext = {
    signal,
    logger,
    rootDirectoryUrl,
    sourcemaps,
    urlGraph,
    scenario,
    runtimeCompat,
    isSupportedOnFutureClients: feature => {
      return RUNTIME_COMPAT.isSupported(runtimeCompat, feature);
    }
  };

  const createReference = ({
    data = {},
    node,
    trace,
    parentUrl,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filename,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    baseUrl,
    isOriginalPosition,
    shouldHandle,
    isInline = false,
    injected = false,
    isRessourceHint = false,
    content,
    contentType,
    assert,
    assertNode,
    typePropertyNode
  }) => {
    if (typeof specifier !== "string") {
      throw new TypeError(`"specifier" must be a string, got ${specifier}`);
    }

    return {
      original: null,
      prev: null,
      next: null,
      data,
      node,
      trace,
      parentUrl,
      type,
      subtype,
      expectedContentType,
      expectedType,
      expectedSubtype,
      filename,
      integrity,
      crossorigin,
      specifier,
      specifierStart,
      specifierEnd,
      specifierLine,
      specifierColumn,
      baseUrl,
      isOriginalPosition,
      shouldHandle,
      isInline,
      injected,
      isRessourceHint,
      // for inline ressources the reference contains the content
      content,
      contentType,
      timing: {},
      assert,
      assertNode,
      typePropertyNode
    };
  };

  const mutateReference = (reference, newReference) => {
    reference.next = newReference;
    newReference.prev = reference;
    newReference.original = reference.original || reference;
  };

  const resolveReference = reference => {
    try {
      let resolvedUrl = pluginController.callHooksUntil("resolveUrl", reference, kitchenContext);

      if (!resolvedUrl) {
        throw new Error(`NO_RESOLVE`);
      }

      resolvedUrl = normalizeUrl(resolvedUrl);
      reference.url = resolvedUrl;
      pluginController.callHooks("redirectUrl", reference, kitchenContext, returnValue => {
        const normalizedReturnValue = normalizeUrl(returnValue);

        if (normalizedReturnValue === reference.url) {
          return;
        }

        const previousReference = { ...reference
        };
        reference.url = normalizedReturnValue;
        mutateReference(previousReference, reference);
      });
      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url);
      applyReferenceEffectsOnUrlInfo(reference, urlInfo, kitchenContext);
      const referenceUrlObject = new URL(reference.url);
      reference.searchParams = referenceUrlObject.searchParams;
      reference.generatedUrl = reference.url; // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other ressource, it is considered as
      // the same ressource under the hood

      pluginController.callHooks("transformUrlSearchParams", reference, kitchenContext, returnValue => {
        Object.keys(returnValue).forEach(key => {
          referenceUrlObject.searchParams.set(key, returnValue[key]);
        });
        reference.generatedUrl = normalizeUrl(referenceUrlObject.href);
      });
      const returnValue = pluginController.callHooksUntil("formatUrl", reference, kitchenContext);
      reference.generatedSpecifier = returnValue || reference.generatedUrl;
      reference.generatedSpecifier = urlSpecifierEncoding.encode(reference);
      return urlInfo;
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error
      });
    }
  };

  kitchenContext.resolveReference = resolveReference;
  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSourcesContent,
    sourcemapsRelativeSources,
    injectSourcemapPlaceholder: ({
      urlInfo,
      specifier
    }) => {
      const sourcemapReference = createReference({
        trace: `sourcemap comment placeholder for ${urlInfo.url}`,
        type: "sourcemap_comment",
        subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
        parentUrl: urlInfo.url,
        specifier
      });
      const sourcemapUrlInfo = resolveReference(sourcemapReference);
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    },
    foundSourcemap: ({
      urlInfo,
      type,
      specifier,
      specifierLine,
      specifierColumn
    }) => {
      const sourcemapReference = createReference({
        trace: stringifyUrlSite(adjustUrlSite(urlInfo, {
          urlGraph,
          url: urlInfo.url,
          line: specifierLine,
          column: specifierColumn
        })),
        type,
        parentUrl: urlInfo.url,
        specifier,
        specifierLine,
        specifierColumn
      });
      const sourcemapUrlInfo = resolveReference(sourcemapReference);
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    }
  });

  const fetchUrlContent = async (urlInfo, {
    reference,
    context
  }) => {
    try {
      const fetchUrlContentReturnValue = await pluginController.callAsyncHooksUntil("fetchUrlContent", urlInfo, context);

      if (!fetchUrlContentReturnValue) {
        logger.warn(createDetailedMessage(`no plugin has handled url during "fetchUrlContent" hook -> url will be ignored`, {
          "url": urlInfo.url,
          "url reference trace": reference.trace
        }));
        return;
      }

      const {
        data,
        type,
        subtype,
        contentType = "application/octet-stream",
        originalContent,
        content,
        sourcemap,
        filename
      } = fetchUrlContentReturnValue;
      urlInfo.type = type || reference.expectedType || inferUrlInfoType({
        url: urlInfo.url,
        contentType
      });
      urlInfo.subtype = subtype || reference.expectedSubtype || inferUrlInfoSubtype({
        url: urlInfo.url,
        type: urlInfo.type,
        subtype: urlInfo.subtype
      });
      urlInfo.contentType = contentType; // during build urls info are reused and load returns originalContent

      urlInfo.originalContent = originalContent === undefined ? content : originalContent;
      urlInfo.content = content;
      urlInfo.sourcemap = sourcemap;

      if (data) {
        Object.assign(urlInfo.data, data);
      }

      if (filename) {
        urlInfo.filename = filename;
      }

      assertFetchedContentCompliance({
        reference,
        urlInfo
      });
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        reference,
        error
      });
    }

    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      urlInfo,
      context
    });
    await urlInfoTransformer.initTransformations(urlInfo, context);
  };

  const _cook = async (urlInfo, dishContext) => {
    // during dev/test clientRuntimeCompat is a single runtime
    // during build clientRuntimeCompat is runtimeCompat
    const {
      clientRuntimeCompat = runtimeCompat
    } = dishContext;

    kitchenContext.isSupportedOnCurrentClients = feature => {
      return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature);
    };

    const context = { ...kitchenContext,
      ...dishContext,
      clientRuntimeCompat
    };
    const {
      cookDuringCook = cook
    } = dishContext;

    context.cook = (urlInfo, nestedDishContext) => {
      return cookDuringCook(urlInfo, {
        outDirectoryUrl: dishContext.outDirectoryUrl,
        clientRuntimeCompat: dishContext.clientRuntimeCompat,
        ...nestedDishContext
      });
    };

    context.fetchUrlContent = (urlInfo, {
      reference
    }) => {
      return fetchUrlContent(urlInfo, {
        reference,
        context
      });
    };

    if (urlInfo.shouldHandle) {
      // "fetchUrlContent" hook
      await fetchUrlContent(urlInfo, {
        reference: context.reference,
        context
      }); // parsing

      const references = [];

      const addReference = props => {
        const reference = createReference({
          parentUrl: urlInfo.url,
          ...props
        });
        references.push(reference);
        const referencedUrlInfo = resolveReference(reference);
        return [reference, referencedUrlInfo];
      };

      const referenceUtils = {
        readGeneratedSpecifier: async reference => {
          // "formatReferencedUrl" can be async BUT this is an exception
          // for most cases it will be sync. We want to favor the sync signature to keep things simpler
          // The only case where it needs to be async is when
          // the specifier is a `data:*` url
          // in this case we'll wait for the promise returned by
          // "formatReferencedUrl"
          if (reference.generatedSpecifier.then) {
            return reference.generatedSpecifier.then(value => {
              reference.generatedSpecifier = value;
              return value;
            });
          }

          return reference.generatedSpecifier;
        },
        found: ({
          trace,
          ...rest
        }) => {
          if (trace === undefined) {
            trace = stringifyUrlSite(adjustUrlSite(urlInfo, {
              urlGraph,
              url: urlInfo.url,
              line: rest.specifierLine,
              column: rest.specifierColumn
            }));
          } // console.log(trace)


          return addReference({
            trace,
            ...rest
          });
        },
        foundInline: ({
          isOriginalPosition,
          line,
          column,
          ...rest
        }) => {
          const parentUrl = isOriginalPosition ? urlInfo.url : urlInfo.generatedUrl;
          const parentContent = isOriginalPosition ? urlInfo.originalContent : urlInfo.content;
          return addReference({
            trace: stringifyUrlSite({
              url: parentUrl,
              content: parentContent,
              line,
              column
            }),
            isOriginalPosition,
            line,
            column,
            isInline: true,
            ...rest
          });
        },
        update: (currentReference, newReferenceParams) => {
          const index = references.indexOf(currentReference);

          if (index === -1) {
            throw new Error(`reference do not exists`);
          }

          const previousReference = currentReference;
          const nextReference = createReference({ ...previousReference,
            ...newReferenceParams
          });
          references[index] = nextReference;
          mutateReference(previousReference, nextReference);
          const newUrlInfo = resolveReference(nextReference);
          const currentUrlInfo = context.urlGraph.getUrlInfo(currentReference.url);

          if (currentUrlInfo && currentUrlInfo !== newUrlInfo && currentUrlInfo.dependents.size === 0) {
            context.urlGraph.deleteUrlInfo(currentReference.url);
          }

          return [nextReference, newUrlInfo];
        },
        becomesInline: (reference, {
          isOriginalPosition,
          specifier,
          specifierLine,
          specifierColumn,
          contentType,
          content
        }) => {
          const parentUrl = isOriginalPosition ? urlInfo.url : urlInfo.generatedUrl;
          const parentContent = isOriginalPosition ? urlInfo.originalContent : urlInfo.content;
          return referenceUtils.update(reference, {
            trace: stringifyUrlSite({
              url: parentUrl,
              content: parentContent,
              line: specifierLine,
              column: specifierColumn
            }),
            isOriginalPosition,
            isInline: true,
            specifier,
            specifierLine,
            specifierColumn,
            contentType,
            content
          });
        },
        inject: ({
          trace,
          ...rest
        }) => {
          if (trace === undefined) {
            const {
              url,
              line,
              column
            } = getCallerPosition();
            trace = stringifyUrlSite({
              url,
              line,
              column
            });
          }

          return addReference({
            trace,
            injected: true,
            ...rest
          });
        },
        findByGeneratedSpecifier: generatedSpecifier => {
          const reference = references.find(ref => ref.generatedSpecifier === generatedSpecifier);

          if (!reference) {
            throw new Error(`No reference found using the following generatedSpecifier: "${generatedSpecifier}"`);
          }

          return reference;
        }
      }; // "transform" hook

      urlInfo.references = references;
      context.referenceUtils = referenceUtils;

      try {
        await pluginController.callAsyncHooks("transformUrlContent", urlInfo, context, async transformReturnValue => {
          await urlInfoTransformer.applyIntermediateTransformations(urlInfo, transformReturnValue);
        });
      } catch (error) {
        throw createTransformUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error
        });
      } // after "transform" all references from originalContent
      // and the one injected by plugin are known


      urlGraph.updateReferences(urlInfo, references); // "finalize" hook

      try {
        const finalizeReturnValue = await pluginController.callAsyncHooksUntil("finalizeUrlContent", urlInfo, context);
        await urlInfoTransformer.applyFinalTransformations(urlInfo, finalizeReturnValue);
      } catch (error) {
        throw createFinalizeUrlContentError({
          pluginController,
          reference: context.reference,
          urlInfo,
          error
        });
      }
    } // "cooked" hook


    pluginController.callHooks("cooked", urlInfo, context, cookedReturnValue => {
      if (typeof cookedReturnValue === "function") {
        const removePrunedCallback = urlGraph.prunedCallbackList.add(({
          prunedUrlInfos,
          firstUrlInfo
        }) => {
          const pruned = prunedUrlInfos.find(prunedUrlInfo => prunedUrlInfo.url === urlInfo.url);

          if (pruned) {
            removePrunedCallback();
            cookedReturnValue(firstUrlInfo);
          }
        });
      }
    });
  };

  const cook = memoizeCook(async (urlInfo, context) => {
    if (!writeGeneratedFiles || !context.outDirectoryUrl) {
      await _cook(urlInfo, context);
      return;
    } // writing result inside ".jsenv" directory (debug purposes)


    try {
      await _cook(urlInfo, context);
    } finally {
      const {
        generatedUrl
      } = urlInfo;

      if (generatedUrl && generatedUrl.startsWith("file:")) {
        if (urlInfo.type === "directory") ; else {
          writeFileSync(new URL(generatedUrl), urlInfo.content);
          const {
            sourcemapGeneratedUrl,
            sourcemap
          } = urlInfo;

          if (sourcemapGeneratedUrl && sourcemap) {
            writeFileSync(new URL(sourcemapGeneratedUrl), JSON.stringify(sourcemap, null, "  "));
          }
        }
      }
    }
  });
  kitchenContext.fetchUrlContent = fetchUrlContent;
  kitchenContext.cook = cook;

  const prepareEntryPoint = params => {
    const entryReference = createReference(params);
    const entryUrlInfo = resolveReference(entryReference);
    return [entryReference, entryUrlInfo];
  };

  const injectReference = params => {
    const ref = createReference(params);
    const urlInfo = resolveReference(ref);
    return [ref, urlInfo];
  };

  return {
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    jsenvDirectoryUrl,
    kitchenContext,
    cook,
    prepareEntryPoint,
    injectReference
  };
};

const memoizeCook = cook => {
  const pendingDishes = new Map();
  return async (urlInfo, context) => {
    const {
      url,
      modifiedTimestamp
    } = urlInfo;
    const pendingDish = pendingDishes.get(url);

    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }

      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise;
        return;
      }

      pendingDishes.delete(url);
    }

    const timestamp = Date.now();
    const promise = cook(urlInfo, context);
    pendingDishes.set(url, {
      timestamp,
      promise
    });

    try {
      await promise;
    } finally {
      pendingDishes.delete(url);
    }
  };
};

const applyReferenceEffectsOnUrlInfo = (reference, urlInfo, context) => {
  if (reference.shouldHandle) {
    urlInfo.shouldHandle = true;
  }

  Object.assign(urlInfo.data, reference.data);
  Object.assign(urlInfo.timing, reference.timing);

  if (reference.injected) {
    urlInfo.data.injected = true;
  }

  if (reference.filename) {
    urlInfo.filename = reference.filename;
  }

  if (reference.isInline) {
    urlInfo.isInline = true;
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
    urlInfo.inlineUrlSite = {
      url: parentUrlInfo.url,
      content: reference.isOriginalPosition ? parentUrlInfo.originalContent : parentUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn
    };
    urlInfo.contentType = reference.contentType;
    urlInfo.originalContent = context === "build" ? urlInfo.originalContent === undefined ? reference.content : urlInfo.originalContent : reference.content;
    urlInfo.content = reference.content;
  }

  if (isWebWorkerEntryPointReference(reference)) {
    urlInfo.data.isWebWorkerEntryPoint = true;
  }
};

const adjustUrlSite = (urlInfo, {
  urlGraph,
  url,
  line,
  column
}) => {
  const isOriginal = url === urlInfo.url;

  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }

    const inlineUrlSite = urlInfo.inlineUrlSite;

    if (!inlineUrlSite) {
      return urlSite;
    }

    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url);
    return adjust({
      isOriginal: true,
      url: inlineUrlSite.url,
      content: inlineUrlSite.content,
      line: inlineUrlSite.line + urlSite.line,
      column: inlineUrlSite.column + urlSite.column
    }, parentUrlInfo);
  };

  return adjust({
    isOriginal,
    url,
    content: isOriginal ? urlInfo.originalContent : urlInfo.content,
    line,
    column
  }, urlInfo);
};

const inferUrlInfoType = ({
  url,
  contentType
}) => {
  if (contentType === "text/html") {
    return "html";
  }

  if (contentType === "text/css") {
    return "css";
  }

  if (contentType === "text/javascript") {
    const urlObject = new URL(url);

    if (urlObject.searchParams.has("js_classic")) {
      return "js_classic";
    }

    return "js_module";
  }

  if (contentType === "application/importmap+json") {
    return "importmap";
  }

  if (contentType === "application/manifest+json") {
    return "webmanifest";
  }

  if (contentType === "image/svg+xml") {
    return "svg";
  }

  if (CONTENT_TYPE.isJson(contentType)) {
    return "json";
  }

  if (CONTENT_TYPE.isTextual(contentType)) {
    return "text";
  }

  return "other";
};

const inferUrlInfoSubtype = ({
  type,
  subtype,
  url
}) => {
  if (type === "js_classic" || type === "js_module") {
    const urlObject = new URL(url);

    if (urlObject.searchParams.has("worker")) {
      return "worker";
    }

    if (urlObject.searchParams.has("service_worker")) {
      return "service_worker";
    }

    if (urlObject.searchParams.has("shared_worker")) {
      return "shared_worker";
    } // if we are currently inside a worker, all deps are consider inside worker too


    return subtype;
  }

  return "";
};

const determineFileUrlForOutDirectory = ({
  urlInfo,
  context
}) => {
  if (!context.outDirectoryUrl) {
    return urlInfo.url;
  }

  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url;
  }

  let url = urlInfo.url;

  if (!urlIsInsideOf(urlInfo.url, context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url);
    url = `${context.rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
  }

  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename);
  }

  return moveUrl({
    url,
    from: context.rootDirectoryUrl,
    to: context.outDirectoryUrl,
    preferAbsolute: true
  });
}; // import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"
// const getUrlSite = async (
//   urlInfo,
//   { line, column, originalLine, originalColumn },
// ) => {
//   if (typeof originalLine === "number") {
//     return {
//       url: urlInfo.url,
//       line: originalLine,
//       column: originalColumn,
//     }
//   }
//   if (urlInfo.content === urlInfo.originalContent) {
//     return {
//       url: urlInfo.url,
//       line,
//       column,
//     }
//   }
//   // at this point things were transformed: line and column are generated
//   // no sourcemap -> cannot map back to original file
//   const { sourcemap } = urlInfo
//   if (!sourcemap) {
//     return {
//       url: urlInfo.generatedUrl,
//       content: urlInfo.content,
//       line,
//       column,
//     }
//   }
//   const originalPosition = await getOriginalPosition({
//     sourcemap,
//     line,
//     column,
//   })
//   // cannot map back to original file
//   if (!originalPosition || originalPosition.line === null) {
//     return {
//       url: urlInfo.generatedUrl,
//       line,
//       column,
//     }
//   }
//   return {
//     url: urlInfo.url,
//     line: originalPosition.line,
//     column: originalPosition.column,
//   }
// }

const require$1 = createRequire(import.meta.url);

const parseUserAgentHeader = memoizeByFirstArgument(userAgent => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1)
    };
  }

  const UA = require$1("@financial-times/polyfill-useragent-normaliser");

  const {
    ua
  } = new UA(userAgent);
  const {
    family,
    major,
    minor,
    patch
  } = ua;
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion: family === "Other" ? "unknown" : `${major}.${minor}${patch}`
  };
});

const createFileService = ({
  rootDirectoryUrl,
  urlGraph,
  kitchen,
  scenario
}) => {
  kitchen.pluginController.addHook("serve");
  kitchen.pluginController.addHook("augmentResponse");
  const serveContext = {
    rootDirectoryUrl,
    urlGraph,
    scenario
  };
  const augmentResponseContext = {
    rootDirectoryUrl,
    urlGraph,
    scenario
  };

  const getResponse = async request => {
    // serve file inside ".jsenv" directory
    const requestFileUrl = new URL(request.ressource.slice(1), rootDirectoryUrl).href;

    if (urlIsInsideOf(requestFileUrl, kitchen.jsenvDirectoryUrl)) {
      return fetchFileSystem(requestFileUrl, {
        headers: request.headers
      });
    }

    const responseFromPlugin = await kitchen.pluginController.callAsyncHooksUntil("serve", request, serveContext);

    if (responseFromPlugin) {
      return responseFromPlugin;
    }

    let reference;
    const parentUrl = inferParentFromRequest(request, rootDirectoryUrl);

    if (parentUrl) {
      reference = urlGraph.inferReference(request.ressource, parentUrl);
    }

    if (!reference) {
      const entryPoint = kitchen.prepareEntryPoint({
        trace: parentUrl || rootDirectoryUrl,
        parentUrl: parentUrl || rootDirectoryUrl,
        type: "entry_point",
        specifier: request.ressource
      });
      reference = entryPoint[0];
    }

    const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url);
    const ifNoneMatch = request.headers["if-none-match"];

    if (ifNoneMatch && urlInfo.contentEtag === ifNoneMatch) {
      return {
        status: 304,
        headers: {
          "cache-control": `private,max-age=0,must-revalidate`,
          ...urlInfo.responseHeaders
        }
      };
    }

    try {
      // urlInfo objects are reused, they must be "reset" before cooking them again
      if (urlInfo.contentEtag && !urlInfo.isInline && urlInfo.type !== "sourcemap") {
        urlInfo.sourcemap = null;
        urlInfo.sourcemapReference = null;
        urlInfo.content = null;
        urlInfo.originalContent = null;
        urlInfo.type = null;
        urlInfo.subtype = null;
        urlInfo.timing = {};
        urlInfo.responseHeaders = {};
      }

      const {
        runtimeName,
        runtimeVersion
      } = parseUserAgentHeader(request.headers["user-agent"]);
      await kitchen.cook(urlInfo, {
        request,
        reference,
        clientRuntimeCompat: {
          [runtimeName]: runtimeVersion
        },
        outDirectoryUrl: scenario === "dev" ? `${rootDirectoryUrl}.jsenv/${runtimeName}@${runtimeVersion}/` : `${rootDirectoryUrl}.jsenv/${scenario}/${runtimeName}@${runtimeVersion}/`
      });
      let {
        response,
        contentType,
        content,
        contentEtag
      } = urlInfo;

      if (response) {
        return response;
      }

      response = {
        url: reference.url,
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(content),
          "cache-control": `private,max-age=0,must-revalidate`,
          "eTag": contentEtag,
          ...urlInfo.responseHeaders
        },
        body: content,
        timing: urlInfo.timing
      };
      kitchen.pluginController.callHooks("augmentResponse", {
        reference,
        urlInfo
      }, augmentResponseContext, returnValue => {
        response = composeTwoResponses(response, returnValue);
      });
      return response;
    } catch (e) {
      const code = e.code;

      if (code === "PARSE_ERROR") {
        // let the browser re-throw the syntax error
        return {
          url: reference.url,
          status: 200,
          statusText: e.reason,
          statusMessage: e.message,
          headers: {
            "content-type": urlInfo.contentType,
            "content-length": Buffer.byteLength(urlInfo.content),
            "cache-control": "no-store"
          },
          body: urlInfo.content
        };
      }

      if (code === "EISDIR") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html"
          },
          canReadDirectory: true,
          rootDirectoryUrl
        });
      }

      if (code === "NOT_ALLOWED") {
        return {
          url: reference.url,
          status: 403,
          statusText: e.reason
        };
      }

      if (code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: e.reason,
          statusMessage: e.message
        };
      }

      return {
        url: reference.url,
        status: 500,
        statusText: e.reason,
        statusMessage: e.stack
      };
    }
  };

  return async request => {
    let response = await getResponse(request);
    return response;
  };
};

const inferParentFromRequest = (request, rootDirectoryUrl) => {
  const {
    referer
  } = request.headers;

  if (!referer) {
    return null;
  }

  const refererUrlObject = new URL(referer);
  refererUrlObject.searchParams.delete("hmr");
  refererUrlObject.searchParams.delete("v");
  const {
    pathname,
    search
  } = refererUrlObject;

  if (pathname.startsWith("/@fs/")) {
    const fsRootRelativeUrl = pathname.slice("/@fs/".length);
    return `file:///${fsRootRelativeUrl}${search}`;
  }

  return moveUrl({
    url: referer,
    from: `${request.origin}/`,
    to: rootDirectoryUrl,
    preferAbsolute: true
  });
};

const startOmegaServer = async ({
  signal,
  handleSIGINT,
  logLevel,
  protocol = "http",
  http2 = protocol === "https",
  privateKey,
  certificate,
  listenAnyIp,
  ip,
  port = 0,
  keepProcessAlive = false,
  onStop = () => {},
  serverPlugins,
  services,
  rootDirectoryUrl,
  scenario,
  urlGraph,
  kitchen
}) => {
  const serverStopCallbackList = createCallbackListNotifiedOnce();
  const coreServices = {
    "service:file": createFileService({
      rootDirectoryUrl,
      urlGraph,
      kitchen,
      scenario
    })
  };
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel,
    startLog: false,
    protocol,
    http2,
    certificate,
    privateKey,
    listenAnyIp,
    ip,
    port,
    plugins: { ...serverPlugins,
      ...pluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [...jsenvAccessControlAllowedHeaders, "x-jsenv-execution-id"],
        accessControlAllowCredentials: true
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000
      })
    },
    sendErrorDetails: true,
    errorToResponse: (error, {
      request
    }) => {
      const getResponseForError = () => {
        if (error && error.asResponse) {
          return error.asResponse();
        }

        if (error && error.statusText === "Unexpected directory operation") {
          return {
            status: 403
          };
        }

        return convertFileSystemErrorToResponseProperties(error);
      };

      const response = getResponseForError();

      if (!response) {
        return null;
      }

      const isInspectRequest = new URL(request.ressource, request.origin).searchParams.has("__inspect__");

      if (!isInspectRequest) {
        return response;
      }

      const body = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body
      });
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        },
        body
      };
    },
    requestToResponse: composeServices({ ...services,
      ...coreServices
    }),
    onStop: reason => {
      onStop();
      serverStopCallbackList.notify(reason);
    }
  });
  return { ...server
  };
};

const jsenvPluginExplorer = ({
  groups
}) => {
  const htmlClientFileUrl = new URL("./html/explorer.html", import.meta.url);
  const faviconClientFileUrl = new URL("./other/jsenv.png", import.meta.url);
  return {
    name: "jsenv:explorer",
    appliesDuring: {
      dev: true
    },
    serve: async (request, {
      rootDirectoryUrl
    }) => {
      if (request.ressource !== "/") {
        return null;
      }

      const structuredMetaMapRelativeForExplorable = {};
      Object.keys(groups).forEach(groupName => {
        const groupConfig = groups[groupName];
        structuredMetaMapRelativeForExplorable[groupName] = {
          "**/.jsenv/": false,
          // avoid visting .jsenv directory in jsenv itself
          ...groupConfig
        };
      });
      const structuredMetaMapForExplorable = normalizeStructuredMetaMap(structuredMetaMapRelativeForExplorable, rootDirectoryUrl);
      const matchingFileResultArray = await collectFiles({
        directoryUrl: rootDirectoryUrl,
        structuredMetaMap: structuredMetaMapForExplorable,
        predicate: meta => Object.keys(meta).some(group => Boolean(meta[group]))
      });
      const files = matchingFileResultArray.map(({
        relativeUrl,
        meta
      }) => ({
        relativeUrl,
        meta
      }));
      let html = String(readFileSync(new URL(htmlClientFileUrl)));
      html = html.replace("FAVICON_HREF", DataUrl.stringify({
        contentType: CONTENT_TYPE.fromUrlExtension(faviconClientFileUrl),
        base64Flag: true,
        data: readFileSync(new URL(faviconClientFileUrl)).toString("base64")
      }));
      html = html.replace("SERVER_PARAMS", JSON.stringify({
        rootDirectoryUrl,
        groups,
        files
      }, null, "  "));
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/html",
          "content-length": Buffer.byteLength(html)
        },
        body: html
      };
    }
  };
};

const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT,
  logLevel = "info",
  omegaServerLogLevel = "warn",
  port = 3456,
  protocol = "http",
  listenAnyIp,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,
  keepProcessAlive = true,
  rootDirectoryUrl,
  devServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true
  },
  devServerMainFile = getCallerPosition().url,
  // force disable server autoreload when this code is executed:
  // - inside a forked child process
  // - inside a worker thread
  // (because node cluster won't work)
  devServerAutoreload = typeof process.send !== "function" && !parentPort && !process.debugPort,
  clientFiles = {
    "./**": true,
    "./**/.*/": false,
    // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./**/dist/": false,
    "./**/node_modules/": false
  },
  cooldownBetweenFileEvents,
  clientAutoreload = true,
  sourcemaps = "inline",
  // default runtimeCompat assume dev server will be request by recent browsers
  // Used by "jsenv_plugin_node_runtime.js" to deactivate itself
  // If dev server can be requested by Node.js to exec files
  // we would add "node" to the potential runtimes. For now it's out of the scope of the dev server
  // and "jsenv_plugin_node_runtime.js" applies only during build made for node.js
  runtimeCompat = {
    chrome: "100",
    firefox: "100",
    safari: "15.5"
  },
  plugins = [],
  urlAnalysis = {},
  htmlSupervisor = true,
  injectedGlobals,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  explorerGroups = {
    source: {
      "./*.html": true,
      "./src/**/*.html": true
    },
    test: {
      "./test/**/*.test.html": true
    }
  },
  // toolbar = false,
  writeGeneratedFiles = true
}) => {
  const logger = createLogger({
    logLevel
  });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  const reloadableProcess = await initReloadableProcess({
    signal,
    handleSIGINT,
    ...(devServerAutoreload ? {
      enabled: true,
      logLevel: "warn",
      fileToRestart: devServerMainFile
    } : {
      enabled: false
    })
  });

  if (reloadableProcess.isPrimary) {
    const devServerFileChangeCallback = ({
      relativeUrl,
      event
    }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href;

      if (devServerAutoreload) {
        logger.info(`file ${event} ${url} -> restarting server...`);
        reloadableProcess.reload();
      }
    };

    const unregisterDevServerFilesWatcher = registerDirectoryLifecycle(rootDirectoryUrl, {
      watchPatterns: {
        [devServerMainFile]: true,
        ...devServerFiles
      },
      cooldownBetweenFileEvents,
      keepProcessAlive: false,
      recursive: true,
      added: ({
        relativeUrl
      }) => {
        devServerFileChangeCallback({
          relativeUrl,
          event: "added"
        });
      },
      updated: ({
        relativeUrl
      }) => {
        devServerFileChangeCallback({
          relativeUrl,
          event: "modified"
        });
      },
      removed: ({
        relativeUrl
      }) => {
        devServerFileChangeCallback({
          relativeUrl,
          event: "removed"
        });
      }
    });
    signal.addEventListener("abort", () => {
      unregisterDevServerFilesWatcher();
    });
    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        unregisterDevServerFilesWatcher();
        reloadableProcess.stop();
      }
    };
  }

  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !loggerToLevels(logger).info
  });
  const clientFileChangeCallbackList = [];
  const clientFilesPruneCallbackList = [];

  const clientFileChangeCallback = ({
    relativeUrl,
    event
  }) => {
    const url = new URL(relativeUrl, rootDirectoryUrl).href;
    clientFileChangeCallbackList.forEach(callback => {
      callback({
        url,
        event
      });
    });
  };

  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFiles,
    cooldownBetweenFileEvents,
    keepProcessAlive: false,
    recursive: true,
    added: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        event: "added",
        relativeUrl
      });
    },
    updated: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        event: "modified",
        relativeUrl
      });
    },
    removed: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        event: "removed",
        relativeUrl
      });
    }
  });
  const urlGraph = createUrlGraph({
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList
  });
  const kitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph,
    scenario: "dev",
    runtimeCompat,
    sourcemaps,
    writeGeneratedFiles,
    plugins: [...plugins, ...getCorePlugins({
      rootDirectoryUrl,
      urlGraph,
      scenario: "dev",
      runtimeCompat,
      urlAnalysis,
      htmlSupervisor,
      injectedGlobals,
      nodeEsmResolution,
      fileSystemMagicResolution,
      transpilation,
      clientAutoreload,
      clientFileChangeCallbackList,
      clientFilesPruneCallbackList
    }), jsenvPluginExplorer({
      groups: explorerGroups
    }) // ...(toolbar ? [jsenvPluginToolbar(toolbar)] : []),
    ]
  });
  const server = await startOmegaServer({
    logLevel: omegaServerLogLevel,
    keepProcessAlive,
    listenAnyIp,
    port,
    protocol,
    http2,
    certificate,
    privateKey,
    rootDirectoryUrl,
    urlGraph,
    kitchen,
    scenario: "dev"
  });
  startDevServerTask.done();
  logger.info(``);
  Object.keys(server.origins).forEach(key => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  server.addEffect(() => {
    return () => {
      kitchen.pluginController.callHooks("destroy", {});
    };
  });
  return {
    origin: server.origin,
    stop: () => {
      stopWatchingClientFiles();
      server.stop();
    }
  };
};

const run = async ({
  signal = new AbortController().signal,
  logger,
  allocatedMs,
  keepRunning = false,
  mirrorConsole = false,
  collectConsole = false,
  collectCoverage = false,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams
}) => {
  const onConsoleRef = {
    current: () => {}
  };
  const stopSignal = {
    notify: () => {}
  };

  let resultTransformer = result => result;

  const runtimeLabel = `${runtime.name}/${runtime.version}`;
  const runOperation = Abort.startOperation();
  runOperation.addAbortSignal(signal);

  if (typeof allocatedMs === "number" && allocatedMs !== Infinity) {
    const timeoutAbortSource = runOperation.timeout(allocatedMs);
    resultTransformer = composeTransformer$1(resultTransformer, result => {
      if (result.status === "errored" && Abort.isAbortError(result.error) && timeoutAbortSource.signal.aborted) {
        return createTimedoutResult();
      }

      return result;
    });
  }

  resultTransformer = composeTransformer$1(resultTransformer, result => {
    if (result.status === "errored" && Abort.isAbortError(result.error)) {
      return createAbortedResult();
    }

    return result;
  });
  const consoleCalls = [];

  onConsoleRef.current = ({
    type,
    text
  }) => {
    if (mirrorConsole) {
      if (type === "error") {
        process.stderr.write(text);
      } else {
        process.stdout.write(text);
      }
    }

    if (collectConsole) {
      consoleCalls.push({
        type,
        text
      });
    }
  };

  if (collectConsole) {
    resultTransformer = composeTransformer$1(resultTransformer, result => {
      result.consoleCalls = consoleCalls;
      return result;
    });
  }

  if (collectCoverage) {
    resultTransformer = composeTransformer$1(resultTransformer, async result => {
      // we do not keep coverage in memory, it can grow very big
      // instead we store it on the filesystem
      // and they can be read later at "coverageFileUrl"
      const {
        coverage
      } = result;

      if (coverage) {
        const coverageFileUrl = resolveUrl(`./${runtime.name}/${cuid()}`, coverageTempDirectoryUrl);
        await writeFile(coverageFileUrl, JSON.stringify(coverage, null, "  "));
        result.coverageFileUrl = coverageFileUrl;
        delete result.coverage;
      }

      return result;
    });
  } else {
    resultTransformer = composeTransformer$1(resultTransformer, result => {
      // as collectCoverage is disabled
      // executionResult.coverage is undefined or {}
      // we delete it just to have a cleaner object
      delete result.coverage;
      return result;
    });
  }

  const startMs = Date.now();
  resultTransformer = composeTransformer$1(resultTransformer, result => {
    result.duration = Date.now() - startMs;
    return result;
  });

  try {
    logger.debug(`run() ${runtimeLabel}`);
    runOperation.throwIfAborted();
    const winnerPromise = new Promise(resolve => {
      raceCallbacks({
        aborted: cb => {
          runOperation.signal.addEventListener("abort", cb);
          return () => {
            runOperation.signal.removeEventListener("abort", cb);
          };
        },
        runned: async cb => {
          try {
            const result = await runtime.run({
              signal: runOperation.signal,
              logger,
              ...runtimeParams,
              collectPerformance,
              keepRunning,
              stopSignal,
              onConsole: log => onConsoleRef.current(log)
            });
            cb(result);
          } catch (e) {
            cb({
              status: "errored",
              error: e
            });
          }
        }
      }, resolve);
    });
    const winner = await winnerPromise;

    if (winner.name === "aborted") {
      runOperation.throwIfAborted();
    }

    let result = winner.data;
    result = await resultTransformer(result);
    return result;
  } catch (e) {
    let result = {
      status: "errored",
      error: e
    };
    result = await resultTransformer(result);
    return result;
  } finally {
    await runOperation.end();
  }
};

const composeTransformer$1 = (previousTransformer, transformer) => {
  return async value => {
    const transformedValue = await previousTransformer(value);
    return transformer(transformedValue);
  };
};

const createAbortedResult = () => {
  return {
    status: "aborted"
  };
};

const createTimedoutResult = () => {
  return {
    status: "timedout"
  };
};

const ensureGlobalGc = () => {
  if (!global.gc) {
    v8.setFlagsFromString("--expose_gc");
    global.gc = runInNewContext("gc");
  }
};

const generateExecutionSteps = async (plan, {
  signal,
  rootDirectoryUrl
}) => {
  const structuredMetaMap = {
    filePlan: plan
  };
  const fileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    structuredMetaMap,
    predicate: ({
      filePlan
    }) => filePlan
  });
  const executionSteps = [];
  fileResultArray.forEach(({
    relativeUrl,
    meta
  }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan
    });
    executionSteps.push(...fileExecutionSteps);
  });
  return executionSteps;
};
const generateFileExecutionSteps = ({
  fileRelativeUrl,
  filePlan
}) => {
  const fileExecutionSteps = [];
  Object.keys(filePlan).forEach(executionName => {
    const stepConfig = filePlan[executionName];

    if (stepConfig === null || stepConfig === undefined) {
      return;
    }

    if (typeof stepConfig !== "object") {
      throw new TypeError(createDetailedMessage(`found unexpected value in plan, they must be object`, {
        ["file relative path"]: fileRelativeUrl,
        ["execution name"]: executionName,
        ["value"]: stepConfig
      }));
    }

    fileExecutionSteps.push({
      executionName,
      fileRelativeUrl,
      ...stepConfig
    });
  });
  return fileExecutionSteps;
};

const EXECUTION_COLORS = {
  executing: ANSI.BLUE,
  aborted: ANSI.MAGENTA,
  timedout: ANSI.MAGENTA,
  errored: ANSI.RED,
  completed: ANSI.GREEN,
  cancelled: ANSI.GREY
};

const createExecutionLog = ({
  executionIndex,
  fileRelativeUrl,
  runtimeName,
  runtimeVersion,
  executionParams,
  executionResult,
  startMs,
  endMs
}, {
  completedExecutionLogAbbreviation,
  counters,
  timeEllapsed,
  memoryHeap
}) => {
  const {
    status
  } = executionResult;
  const descriptionFormatter = descriptionFormatters[status];
  const description = descriptionFormatter({
    index: executionIndex,
    total: counters.total,
    executionParams
  });
  const summary = createIntermediateSummary({
    executionIndex,
    counters,
    timeEllapsed,
    memoryHeap
  });

  if (completedExecutionLogAbbreviation && status === "completed") {
    return `${description}${summary}`;
  }

  const {
    consoleCalls = [],
    error
  } = executionResult;
  const consoleOutput = formatConsoleCalls(consoleCalls);
  return formatExecution({
    label: `${description}${summary}`,
    details: {
      file: fileRelativeUrl,
      runtime: `${runtimeName}/${runtimeVersion}`,
      duration: status === "executing" ? msAsEllapsedTime(Date.now() - startMs) : msAsDuration(endMs - startMs),
      ...(error ? {
        error: error.stack || error.message || error
      } : {})
    },
    consoleOutput
  });
};
const createSummaryLog = summary => `-------------- summary -----------------
${createAllExecutionsSummary(summary)}
total duration: ${msAsDuration(summary.duration)}
----------------------------------------`;

const createAllExecutionsSummary = ({
  counters
}) => {
  if (counters.total === 0) {
    return `no execution`;
  }

  const executionLabel = counters.total === 1 ? `1 execution` : `${counters.total} executions`;
  return `${executionLabel}: ${createStatusSummary({
    counters
  })}`;
};

const createIntermediateSummary = ({
  executionIndex,
  counters,
  memoryHeap,
  timeEllapsed
}) => {
  const parts = [];

  if (executionIndex > 0 || counters.done > 0) {
    parts.push(createStatusSummary({
      counters: { ...counters,
        total: executionIndex + 1
      }
    }));
  }

  if (timeEllapsed) {
    parts.push(`duration: ${msAsEllapsedTime(timeEllapsed)}`);
  }

  if (memoryHeap) {
    parts.push(`memory heap: ${byteAsMemoryUsage(memoryHeap)}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return ` (${parts.join(` / `)})`;
};

const createStatusSummary = ({
  counters
}) => {
  if (counters.aborted === counters.total) {
    return `all ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`;
  }

  if (counters.timedout === counters.total) {
    return `all ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`;
  }

  if (counters.errored === counters.total) {
    return `all ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`;
  }

  if (counters.completed === counters.total) {
    return `all ${ANSI.color(`completed`, EXECUTION_COLORS.completed)}`;
  }

  if (counters.cancelled === counters.total) {
    return `all ${ANSI.color(`cancelled`, EXECUTION_COLORS.cancelled)}`;
  }

  return createMixedDetails({
    counters
  });
};

const createMixedDetails = ({
  counters
}) => {
  const parts = [];

  if (counters.timedout) {
    parts.push(`${counters.timedout} ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`);
  }

  if (counters.errored) {
    parts.push(`${counters.errored} ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`);
  }

  if (counters.completed) {
    parts.push(`${counters.completed} ${ANSI.color(`completed`, EXECUTION_COLORS.completed)}`);
  }

  if (counters.aborted) {
    parts.push(`${counters.aborted} ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`);
  }

  if (counters.cancelled) {
    parts.push(`${counters.cancelled} ${ANSI.color(`cancelled`, EXECUTION_COLORS.cancelled)}`);
  }

  return `${parts.join(", ")}`;
};

const descriptionFormatters = {
  executing: ({
    index,
    total
  }) => {
    return ANSI.color(`executing ${index + 1} of ${total}`, EXECUTION_COLORS.executing);
  },
  aborted: ({
    index,
    total
  }) => {
    return ANSI.color(`${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} aborted`, EXECUTION_COLORS.aborted);
  },
  timedout: ({
    index,
    total,
    executionParams
  }) => {
    return ANSI.color(`${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} timeout after ${executionParams.allocatedMs}ms`, EXECUTION_COLORS.timedout);
  },
  errored: ({
    index,
    total
  }) => {
    return ANSI.color(`${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} errored`, EXECUTION_COLORS.errored);
  },
  completed: ({
    index,
    total
  }) => {
    return ANSI.color(`${UNICODE.OK_RAW} execution ${index + 1} of ${total} completed`, EXECUTION_COLORS.completed);
  },
  cancelled: ({
    index,
    total
  }) => {
    return ANSI.color(`${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} cancelled`, EXECUTION_COLORS.cancelled);
  }
};

const formatConsoleCalls = consoleCalls => {
  const consoleOutput = consoleCalls.reduce((previous, {
    text
  }) => {
    return `${previous}${text}`;
  }, "");
  const consoleOutputTrimmed = consoleOutput.trim();

  if (consoleOutputTrimmed === "") {
    return "";
  }

  return `${ANSI.color(`-------- console output --------`, ANSI.GREY)}
${consoleOutputTrimmed}
${ANSI.color(`-------------------------`, ANSI.GREY)}`;
};

const formatExecution = ({
  label,
  details = {},
  consoleOutput
}) => {
  let message = ``;
  message += label;
  Object.keys(details).forEach(key => {
    message += `
${key}: ${details[key]}`;
  });

  if (consoleOutput) {
    message += `
${consoleOutput}`;
  }

  return message;
};

const executePlan = async (plan, {
  signal,
  handleSIGINT,
  logger,
  logSummary,
  logTimeUsage,
  logMemoryHeapUsage,
  logFileRelativeUrl,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  rootDirectoryUrl,
  keepRunning,
  defaultMsAllocatedPerExecution,
  maxExecutionsInParallel,
  failFast,
  gcBetweenExecutions,
  cooldownBetweenExecutions,
  coverage,
  coverageConfig,
  coverageIncludeMissing,
  coverageForceIstanbul,
  coverageV8ConflictWarning,
  coverageTempDirectoryRelativeUrl,
  scenario,
  sourcemaps,
  plugins,
  injectedGlobals,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  writeGeneratedFiles,
  protocol,
  privateKey,
  certificate,
  ip,
  port,
  beforeExecutionCallback = () => {},
  afterExecutionCallback = () => {}
} = {}) => {
  const stopAfterAllSignal = {
    notify: () => {}
  };
  let someNeedsServer = false;
  const runtimes = {};
  Object.keys(plan).forEach(filePattern => {
    const filePlan = plan[filePattern];
    Object.keys(filePlan).forEach(executionName => {
      const executionConfig = filePlan[executionName];
      const {
        runtime
      } = executionConfig;

      if (runtime) {
        runtimes[runtime.name] = runtime.version;

        if (runtime.needsServer) {
          someNeedsServer = true;
        }
      }
    });
  });
  logger.debug(createDetailedMessage(`Prepare executing plan`, {
    runtimes: JSON.stringify(runtimes, null, "  ")
  }));
  const multipleExecutionsOperation = Abort.startOperation();
  multipleExecutionsOperation.addAbortSignal(signal);

  if (handleSIGINT) {
    multipleExecutionsOperation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, () => {
        logger.debug(`SIGINT abort`);
        abort();
      });
    });
  }

  const failFastAbortController = new AbortController();

  if (failFast) {
    multipleExecutionsOperation.addAbortSignal(failFastAbortController.signal);
  }

  try {
    let runtimeParams = {
      rootDirectoryUrl,
      collectCoverage: coverage,
      coverageForceIstanbul,
      stopAfterAllSignal
    };

    if (someNeedsServer) {
      const urlGraph = createUrlGraph();
      const kitchen = createKitchen({
        signal,
        logger,
        rootDirectoryUrl,
        urlGraph,
        scenario,
        sourcemaps,
        runtimeCompat: runtimes,
        writeGeneratedFiles,
        plugins: [...plugins, ...getCorePlugins({
          rootDirectoryUrl,
          urlGraph,
          scenario,
          runtimeCompat: runtimes,
          htmlSupervisor: true,
          nodeEsmResolution,
          fileSystemMagicResolution,
          injectedGlobals,
          transpilation: { ...transpilation,
            getCustomBabelPlugins: ({
              clientRuntimeCompat
            }) => {
              if (coverage && Object.keys(clientRuntimeCompat)[0] !== "chrome") {
                return {
                  "transform-instrument": [babelPluginInstrument, {
                    rootDirectoryUrl,
                    coverageConfig
                  }]
                };
              }

              return {};
            }
          }
        })]
      });
      const server = await startOmegaServer({
        signal: multipleExecutionsOperation.signal,
        logLevel: "warn",
        rootDirectoryUrl,
        urlGraph,
        kitchen,
        scenario,
        keepProcessAlive: false,
        port,
        ip,
        protocol,
        certificate,
        privateKey
      });
      multipleExecutionsOperation.addEndCallback(async () => {
        await server.stop();
      });
      runtimeParams = { ...runtimeParams,
        server
      };
    }

    logger.debug(`Generate executions`);
    const executionSteps = await getExecutionAsSteps({
      plan,
      multipleExecutionsOperation,
      rootDirectoryUrl
    });
    logger.debug(`${executionSteps.length} executions planned`);

    if (completedExecutionLogMerging && !process.stdout.isTTY) {
      completedExecutionLogMerging = false;
      logger.debug(`Force completedExecutionLogMerging to false because process.stdout.isTTY is false`);
    }

    const debugLogsEnabled = loggerToLevels(logger).debug;
    const executionLogsEnabled = loggerToLevels(logger).info;
    const executionSpinner = !debugLogsEnabled && executionLogsEnabled && process.stdout.isTTY && // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable spinner only when !process.exitCode (no error so far)
    !process.exitCode;
    const startMs = Date.now();
    const report = {};
    let rawOutput = "";

    let transformReturnValue = value => value;

    if (gcBetweenExecutions) {
      ensureGlobalGc();
    }

    const coverageTempDirectoryUrl = new URL(coverageTempDirectoryRelativeUrl, rootDirectoryUrl).href;

    if (coverage) {
      const structuredMetaMapForCover = normalizeStructuredMetaMap({
        cover: coverageConfig
      }, rootDirectoryUrl);

      const urlShouldBeCovered = url => {
        return urlToMeta({
          url: new URL(url, rootDirectoryUrl).href,
          structuredMetaMap: structuredMetaMapForCover
        }).cover;
      };

      runtimeParams.urlShouldBeCovered = urlShouldBeCovered; // in case runned multiple times, we don't want to keep writing lot of files in this directory

      if (!process.env.NODE_V8_COVERAGE) {
        await ensureEmptyDirectory(coverageTempDirectoryUrl);
      }

      if (runtimes.node) {
        // v8 coverage is written in a directoy and auto propagate to subprocesses
        // through process.env.NODE_V8_COVERAGE.
        if (!coverageForceIstanbul && !process.env.NODE_V8_COVERAGE) {
          const v8CoverageDirectory = new URL(`./node_v8/${cuid()}`, coverageTempDirectoryUrl).href;
          await writeDirectory(v8CoverageDirectory, {
            allowUseless: true
          });
          process.env.NODE_V8_COVERAGE = urlToFileSystemPath(v8CoverageDirectory);
        }
      }

      transformReturnValue = async value => {
        if (multipleExecutionsOperation.signal.aborted) {
          // don't try to do the coverage stuff
          return value;
        }

        try {
          value.coverage = await reportToCoverage(value.report, {
            signal: multipleExecutionsOperation.signal,
            logger,
            rootDirectoryUrl,
            coverageConfig,
            coverageIncludeMissing,
            coverageForceIstanbul,
            urlShouldBeCovered,
            coverageV8ConflictWarning
          });
        } catch (e) {
          if (Abort.isAbortError(e)) {
            return value;
          }

          throw e;
        }

        return value;
      };
    }

    logger.info("");
    let executionLog = createLog({
      newLine: ""
    });
    const counters = {
      total: executionSteps.length,
      aborted: 0,
      timedout: 0,
      errored: 0,
      completed: 0,
      done: 0
    };
    await executeInParallel({
      multipleExecutionsOperation,
      maxExecutionsInParallel,
      cooldownBetweenExecutions,
      executionSteps,
      start: async paramsFromStep => {
        const executionIndex = executionSteps.indexOf(paramsFromStep);
        const {
          executionName,
          fileRelativeUrl,
          runtime
        } = paramsFromStep;
        const runtimeName = runtime.name;
        const runtimeVersion = runtime.version;
        const executionParams = {
          measurePerformance: false,
          collectPerformance: false,
          collectConsole: true,
          allocatedMs: defaultMsAllocatedPerExecution,
          ...paramsFromStep,
          runtimeParams: {
            fileRelativeUrl,
            ...paramsFromStep.runtimeParams
          }
        };
        const beforeExecutionInfo = {
          fileRelativeUrl,
          runtimeName,
          runtimeVersion,
          executionIndex,
          executionParams,
          startMs: Date.now(),
          executionResult: {
            status: "executing"
          }
        };
        let spinner;

        if (executionSpinner) {
          const renderSpinnerText = () => createExecutionLog(beforeExecutionInfo, {
            counters,
            ...(logTimeUsage ? {
              timeEllapsed: Date.now() - startMs
            } : {}),
            ...(logMemoryHeapUsage ? {
              memoryHeap: memoryUsage().heapUsed
            } : {})
          });

          spinner = startSpinner({
            log: executionLog,
            text: renderSpinnerText(),
            update: renderSpinnerText
          });
        }

        beforeExecutionCallback(beforeExecutionInfo);
        const fileUrl = `${rootDirectoryUrl}${fileRelativeUrl}`;
        let executionResult;

        if (existsSync(new URL(fileUrl))) {
          executionResult = await run({
            signal: multipleExecutionsOperation.signal,
            logger,
            allocatedMs: executionParams.allocatedMs,
            keepRunning,
            mirrorConsole: false,
            // file are executed in parallel, log would be a mess to read
            collectConsole: executionParams.collectConsole,
            collectCoverage: coverage,
            coverageTempDirectoryUrl,
            runtime: executionParams.runtime,
            runtimeParams: { ...runtimeParams,
              ...executionParams.runtimeParams
            }
          });
        } else {
          executionResult = {
            status: "errored",
            error: new Error(`No file at ${fileRelativeUrl} for execution "${executionName}"`)
          };
        }

        counters.done++;
        const fileReport = report[fileRelativeUrl];

        if (fileReport) {
          fileReport[executionName] = executionResult;
        } else {
          report[fileRelativeUrl] = {
            [executionName]: executionResult
          };
        }

        const afterExecutionInfo = { ...beforeExecutionInfo,
          endMs: Date.now(),
          executionResult
        };
        afterExecutionCallback(afterExecutionInfo);

        if (executionResult.status === "aborted") {
          counters.aborted++;
        } else if (executionResult.status === "timedout") {
          counters.timedout++;
        } else if (executionResult.status === "errored") {
          counters.errored++;
        } else if (executionResult.status === "completed") {
          counters.completed++;
        }

        if (gcBetweenExecutions) {
          global.gc();
        }

        if (executionLogsEnabled) {
          let log = createExecutionLog(afterExecutionInfo, {
            completedExecutionLogAbbreviation,
            counters,
            ...(logTimeUsage ? {
              timeEllapsed: Date.now() - startMs
            } : {}),
            ...(logMemoryHeapUsage ? {
              memoryHeap: memoryUsage().heapUsed
            } : {})
          });
          log = `${log}
  
`;
          const {
            columns = 80
          } = process.stdout;
          log = wrapAnsi(log, columns, {
            trim: false,
            hard: true,
            wordWrap: false
          }); // replace spinner with this execution result

          if (spinner) spinner.stop();
          executionLog.write(log);
          rawOutput += stripAnsi(log);
          const canOverwriteLog = canOverwriteLogGetter({
            completedExecutionLogMerging,
            executionResult
          });

          if (canOverwriteLog) {// nothing to do, we reuse the current executionLog object
          } else {
            executionLog.destroy();
            executionLog = createLog({
              newLine: ""
            });
          }
        }

        if (failFast && executionResult.status !== "completed" && counters.done < counters.total) {
          logger.info(`"failFast" enabled -> cancel remaining executions`);
          failFastAbortController.abort();
        }
      }
    });

    if (!keepRunning) {
      await stopAfterAllSignal.notify();
    }

    counters.cancelled = counters.total - counters.done;
    const summary = {
      counters,
      // when execution is aborted, the remaining executions are "cancelled"
      duration: Date.now() - startMs
    };

    if (logSummary) {
      const summaryLog = createSummaryLog(summary);
      rawOutput += stripAnsi(summaryLog);
      logger.info(summaryLog);
    }

    if (summary.counters.total !== summary.counters.completed) {
      const logFileUrl = new URL(logFileRelativeUrl, rootDirectoryUrl).href;
      writeFileSync(logFileUrl, rawOutput);
      logger.info(`-> ${urlToFileSystemPath(logFileUrl)}`);
    }

    const result = await transformReturnValue({
      summary,
      report
    });
    return {
      aborted: multipleExecutionsOperation.signal.aborted,
      planSummary: result.summary,
      planReport: result.report,
      planCoverage: result.coverage
    };
  } finally {
    await multipleExecutionsOperation.end();
  }
};

const getExecutionAsSteps = async ({
  plan,
  multipleExecutionsOperation,
  rootDirectoryUrl
}) => {
  try {
    const executionSteps = await generateExecutionSteps(plan, {
      signal: multipleExecutionsOperation.signal,
      rootDirectoryUrl
    });
    return executionSteps;
  } catch (e) {
    if (Abort.isAbortError(e)) {
      return {
        aborted: true,
        planSummary: {},
        planReport: {},
        planCoverage: null
      };
    }

    throw e;
  }
};

const canOverwriteLogGetter = ({
  completedExecutionLogMerging,
  executionResult
}) => {
  if (!completedExecutionLogMerging) {
    return false;
  }

  if (executionResult.status === "aborted") {
    return true;
  }

  if (executionResult.status !== "completed") {
    return false;
  }

  const {
    consoleCalls = []
  } = executionResult;

  if (consoleCalls.length > 0) {
    return false;
  }

  return true;
};

const executeInParallel = async ({
  multipleExecutionsOperation,
  maxExecutionsInParallel,
  cooldownBetweenExecutions,
  executionSteps,
  start
}) => {
  const executionResults = [];
  let progressionIndex = 0;
  let remainingExecutionCount = executionSteps.length;

  const nextChunk = async () => {
    if (multipleExecutionsOperation.signal.aborted) {
      return;
    }

    const outputPromiseArray = [];

    while (remainingExecutionCount > 0 && outputPromiseArray.length < maxExecutionsInParallel) {
      remainingExecutionCount--;
      const outputPromise = executeOne(progressionIndex);
      progressionIndex++;
      outputPromiseArray.push(outputPromise);
    }

    if (outputPromiseArray.length) {
      await Promise.all(outputPromiseArray);

      if (remainingExecutionCount > 0) {
        await nextChunk();
      }
    }
  };

  const executeOne = async index => {
    const input = executionSteps[index];
    const output = await start(input);

    if (!multipleExecutionsOperation.signal.aborted) {
      executionResults[index] = output;
    }

    if (cooldownBetweenExecutions) {
      await new Promise(resolve => setTimeout(resolve, cooldownBetweenExecutions));
    }
  };

  await nextChunk();
  return executionResults;
};

const defaultCoverageConfig = {
  "./index.js": true,
  "./main.js": true,
  "./src/**/*.js": true,
  "./**/*.test.*": false,
  // contains .test. -> nope
  "./**/test/": false // inside a test folder -> nope,

};
/**
 * Execute a list of files and log how it goes
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.rootDirectoryUrl Root directory of the project
 * @param {Object} testPlanParameters.testPlan Object associating patterns leading to files to runtimes where they should be executed
 * @param {boolean} [testPlanParameters.completedExecutionLogAbbreviation=false] Abbreviate completed execution information to shorten terminal output
 * @param {boolean} [testPlanParameters.completedExecutionLogMerging=false] Merge completed execution logs to shorten terminal output
 * @param {number} [testPlanParameters.maxExecutionsInParallel=1] Maximum amount of execution in parallel
 * @param {number} [testPlanParameters.defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {boolean} [testPlanParameters.failFast=false] Fails immediatly when a test execution fails
 * @param {number} [testPlanParameters.cooldownBetweenExecutions=0] Millisecond to wait between each execution
 * @param {boolean} [testPlanParameters.logMemoryHeapUsage=false] Add memory heap usage during logs
 * @param {boolean} [testPlanParameters.coverage=false] Controls if coverage is collected during files executions
 * @param {boolean} [testPlanParameters.coverageV8ConflictWarning=true] Warn when coverage from 2 executions cannot be merged
 * @return {Object} An object containing the result of all file executions
 */

const executeTestPlan = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  logSummary = true,
  logTimeUsage = false,
  logMemoryHeapUsage = false,
  logFileRelativeUrl = ".jsenv/test_plan_debug.txt",
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  rootDirectoryUrl,
  testPlan,
  updateProcessExitCode = true,
  maxExecutionsInParallel = 1,
  defaultMsAllocatedPerExecution = 30000,
  failFast = false,
  // keepRunning: false to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and console output
  // passsing true means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  keepRunning = false,
  cooldownBetweenExecutions = 0,
  gcBetweenExecutions = logMemoryHeapUsage,
  coverage = process.argv.includes("--cover") || process.argv.includes("--coverage"),
  coverageTempDirectoryRelativeUrl = "./.coverage/tmp/",
  coverageConfig = defaultCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageForceIstanbul = false,
  coverageV8ConflictWarning = true,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./.coverage/coverage.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./.coverage/",
  coverageHtmlDirectoryIndexLog = true,
  // skip empty means empty files won't appear in the coverage reports (log and html)
  coverageSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (log and html)
  coverageSkipFull = false,
  sourcemaps = "inline",
  plugins = [],
  injectedGlobals,
  nodeEsmResolution,
  fileSystemMagicResolution,
  writeGeneratedFiles = false,
  protocol,
  privateKey,
  certificate,
  ip,
  port
}) => {
  const logger = createLogger({
    logLevel
  });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);

  if (typeof testPlan !== "object") {
    throw new Error(`testPlan must be an object, got ${testPlan}`);
  }

  if (coverage) {
    if (typeof coverageConfig !== "object") {
      throw new TypeError(`coverageConfig must be an object, got ${coverageConfig}`);
    }

    if (Object.keys(coverageConfig).length === 0) {
      logger.warn(`coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`);
    }

    if (!coverageAndExecutionAllowed) {
      const structuredMetaMapForExecute = normalizeStructuredMetaMap({
        execute: testPlan
      }, "file:///");
      const structuredMetaMapForCover = normalizeStructuredMetaMap({
        cover: coverageConfig
      }, "file:///");
      const patternsMatchingCoverAndExecute = Object.keys(structuredMetaMapForExecute.execute).filter(testPlanPattern => {
        return urlToMeta({
          url: testPlanPattern,
          structuredMetaMap: structuredMetaMapForCover
        }).cover;
      });

      if (patternsMatchingCoverAndExecute.length) {
        // It would be strange, for a given file to be both covered and executed
        throw new Error(createDetailedMessage(`some file will be both covered and executed`, {
          patterns: patternsMatchingCoverAndExecute
        }));
      }
    }
  }

  const result = await executePlan(testPlan, {
    signal,
    handleSIGINT,
    logger,
    logLevel,
    logSummary,
    logTimeUsage,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    rootDirectoryUrl,
    maxExecutionsInParallel,
    defaultMsAllocatedPerExecution,
    failFast,
    keepRunning,
    cooldownBetweenExecutions,
    gcBetweenExecutions,
    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,
    scenario: "test",
    sourcemaps,
    plugins,
    injectedGlobals,
    nodeEsmResolution,
    fileSystemMagicResolution,
    writeGeneratedFiles,
    protocol,
    privateKey,
    certificate,
    ip,
    port
  });

  if (updateProcessExitCode && result.planSummary.counters.total !== result.planSummary.counters.completed) {
    process.exitCode = 1;
  }

  const planCoverage = result.planCoverage; // planCoverage can be null when execution is aborted

  if (planCoverage) {
    const promises = []; // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before

    if (coverage && coverageHtmlDirectory) {
      const coverageHtmlDirectoryUrl = resolveDirectoryUrl(coverageHtmlDirectoryRelativeUrl, rootDirectoryUrl);
      await ensureEmptyDirectory(coverageHtmlDirectoryUrl);

      if (coverageHtmlDirectoryIndexLog) {
        const htmlCoverageDirectoryIndexFileUrl = `${coverageHtmlDirectoryUrl}index.html`;
        logger.info(`-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`);
      }

      promises.push(generateCoverageHtmlDirectory(planCoverage, {
        rootDirectoryUrl,
        coverageHtmlDirectoryRelativeUrl
      }));
    }

    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = new URL(coverageJsonFileRelativeUrl, rootDirectoryUrl).href;
      promises.push(generateCoverageJsonFile({
        coverage: result.planCoverage,
        coverageJsonFileUrl,
        coverageJsonFileLog,
        logger
      }));
    }

    if (coverage && coverageTextLog) {
      promises.push(generateCoverageTextLog(result.planCoverage, {
        coverageSkipEmpty,
        coverageSkipFull
      }));
    }

    await Promise.all(promises);
  }

  return {
    testPlanAborted: result.aborted,
    testPlanSummary: result.planSummary,
    testPlanReport: result.planReport,
    testPlanCoverage: planCoverage
  };
};

const createRuntimeFromPlaywright = ({
  browserName,
  browserVersion,
  coveragePlaywrightAPIAvailable = false,
  ignoreErrorHook = () => false,
  transformErrorHook = error => error,
  isolatedTab = false
}) => {
  const runtime = {
    name: browserName,
    version: browserVersion,
    needsServer: true
  };
  let browserAndContextPromise;

  runtime.run = async ({
    signal = new AbortController().signal,
    // logger,
    rootDirectoryUrl,
    fileRelativeUrl,
    server,
    // measurePerformance,
    collectPerformance,
    collectCoverage = false,
    coverageForceIstanbul,
    urlShouldBeCovered,
    stopAfterAllSignal,
    stopSignal,
    keepRunning,
    onConsole,
    executablePath,
    headful = false,
    ignoreHTTPSErrors = true
  }) => {
    const cleanupCallbackList = createCallbackListNotifiedOnce();
    const cleanup = memoize(async reason => {
      await cleanupCallbackList.notify({
        reason
      });
    });
    const isBrowserDedicatedToExecution = isolatedTab || !stopAfterAllSignal;

    if (isBrowserDedicatedToExecution || !browserAndContextPromise) {
      browserAndContextPromise = (async () => {
        const browser = await launchBrowserUsingPlaywright({
          signal,
          browserName,
          stopOnExit: true,
          playwrightOptions: {
            headless: !headful,
            executablePath
          }
        });
        const browserContext = await browser.newContext({
          ignoreHTTPSErrors
        });
        return {
          browser,
          browserContext
        };
      })();
    }

    const {
      browser,
      browserContext
    } = await browserAndContextPromise;

    const closeBrowser = async () => {
      const disconnected = browser.isConnected() ? new Promise(resolve => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback);
          resolve();
        };

        browser.on("disconnected", disconnectedCallback);
      }) : Promise.resolve(); // for some reason without this 100ms timeout
      // browser.close() never resolves (playwright does not like something)

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await browser.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }

        throw e;
      }

      await disconnected;
    };

    const page = await browserContext.newPage();

    const closePage = async () => {
      try {
        await page.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }

        throw e;
      }
    };

    let resultTransformer = result => result;

    if (collectCoverage) {
      if (coveragePlaywrightAPIAvailable && !coverageForceIstanbul) {
        await page.coverage.startJSCoverage({// reportAnonymousScripts: true,
        });
        resultTransformer = composeTransformer(resultTransformer, async result => {
          const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage(); // we convert urls starting with http:// to file:// because we later
          // convert the url to filesystem path in istanbulCoverageFromV8Coverage function

          const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(v8CoveragesWithWebUrl => {
            const fsUrl = moveUrl({
              url: v8CoveragesWithWebUrl.url,
              from: `${server.origin}/`,
              to: rootDirectoryUrl,
              preferAbsolute: true
            });
            return { ...v8CoveragesWithWebUrl,
              url: fsUrl
            };
          });
          const coverage = filterV8Coverage({
            result: v8CoveragesWithFsUrls
          }, {
            urlShouldBeCovered
          });
          return { ...result,
            coverage
          };
        });
      } else {
        resultTransformer = composeTransformer(resultTransformer, async result => {
          const scriptExecutionResults = result.namespace;

          if (scriptExecutionResults) {
            result.coverage = generateCoverageForPage(scriptExecutionResults);
          }

          return result;
        });
      }
    } else {
      resultTransformer = composeTransformer(resultTransformer, result => {
        const scriptExecutionResults = result.namespace;

        if (scriptExecutionResults) {
          Object.keys(scriptExecutionResults).forEach(fileRelativeUrl => {
            delete scriptExecutionResults[fileRelativeUrl].coverage;
          });
        }

        return result;
      });
    }

    if (collectPerformance) {
      resultTransformer = composeTransformer(resultTransformer, async result => {
        const performance = await page.evaluate(
        /* eslint-disable no-undef */

        /* istanbul ignore next */
        () => {
          const {
            performance
          } = window;

          if (!performance) {
            return null;
          }

          const measures = {};
          const measurePerfEntries = performance.getEntriesByType("measure");
          measurePerfEntries.forEach(measurePerfEntry => {
            measures[measurePerfEntry.name] = measurePerfEntry.duration;
          });
          return {
            timeOrigin: performance.timeOrigin,
            timing: performance.timing.toJSON(),
            navigation: performance.navigation.toJSON(),
            measures
          };
        }
        /* eslint-enable no-undef */
        );
        result.performance = performance;
        return result;
      });
    }

    const fileClientUrl = new URL(fileRelativeUrl, `${server.origin}/`).href; // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console

    const removeConsoleListener = registerEvent({
      object: page,
      eventType: "console",
      // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
      callback: async consoleMessage => {
        onConsole({
          type: consoleMessage.type(),
          text: `${extractTextFromConsoleMessage(consoleMessage)}
    `
        });
      }
    });
    cleanupCallbackList.add(removeConsoleListener);
    const actionOperation = Abort.startOperation();
    actionOperation.addAbortSignal(signal);
    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks({
        aborted: cb => {
          return actionOperation.addAbortCallback(cb);
        },
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
        error: cb => {
          return registerEvent({
            object: page,
            eventType: "error",
            callback: error => {
              if (ignoreErrorHook(error)) {
                return;
              }

              cb(transformErrorHook(error));
            }
          });
        },
        // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror
        pageerror: cb => {
          return registerEvent({
            object: page,
            eventType: "pageerror",
            callback: error => {
              if (ignoreErrorHook(error)) {
                return;
              }

              cb(transformErrorHook(error));
            }
          });
        },
        closed: cb => {
          // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
          if (isBrowserDedicatedToExecution) {
            browser.on("disconnected", async () => {
              cb({
                reason: "browser disconnected"
              });
            });
            cleanupCallbackList.add(closePage);
            cleanupCallbackList.add(closeBrowser);
          } else {
            const disconnectedCallback = async () => {
              throw new Error("browser disconnected during execution");
            };

            browser.on("disconnected", disconnectedCallback);
            page.on("close", () => {
              cb({
                reason: "page closed"
              });
            });
            cleanupCallbackList.add(closePage);
            cleanupCallbackList.add(() => {
              browser.removeListener("disconnected", disconnectedCallback);
            });
            const notifyPrevious = stopAfterAllSignal.notify;

            stopAfterAllSignal.notify = async () => {
              await notifyPrevious();
              browser.removeListener("disconnected", disconnectedCallback);
              await closeBrowser();
            };
          }
        },
        response: async cb => {
          try {
            await page.goto(fileClientUrl, {
              timeout: 0
            });
            const result = await page.evaluate(
            /* eslint-disable no-undef */

            /* istanbul ignore next */
            () => {
              if (!window.__html_supervisor__) {
                throw new Error(`window.__html_supervisor__ not found`);
              }

              return window.__html_supervisor__.getScriptExecutionResults();
            }
            /* eslint-enable no-undef */
            );
            const {
              status,
              scriptExecutionResults
            } = result;

            if (status === "errored") {
              const {
                exceptionSource
              } = result;
              const error = evalException(exceptionSource, {
                rootDirectoryUrl,
                server,
                transformErrorHook
              });
              cb({
                status: "errored",
                error,
                namespace: scriptExecutionResults
              });
            } else {
              cb({
                status: "completed",
                namespace: scriptExecutionResults
              });
            }
          } catch (e) {
            reject(e);
          }
        }
      }, resolve);
    });

    const getResult = async () => {
      const winner = await winnerPromise;

      if (winner.name === "aborted") {
        return {
          status: "aborted"
        };
      }

      if (winner.name === "error" || winner.name === "pageerror") {
        const error = winner.data;
        return {
          status: "errored",
          error
        };
      }

      if (winner.name === "closed") {
        return {
          status: "errored",
          error: isBrowserDedicatedToExecution ? new Error(`browser disconnected during execution`) : new Error(`page closed during execution`)
        };
      }

      return winner.data;
    };

    let result;

    try {
      result = await getResult();
      result = await resultTransformer(result);
    } catch (e) {
      result = {
        status: "errored",
        error: e
      };
    }

    if (keepRunning) {
      stopSignal.notify = cleanup;
    } else {
      await cleanup("execution done");
    }

    return result;
  };

  if (!isolatedTab) {
    runtime.isolatedTab = createRuntimeFromPlaywright({
      browserName,
      browserVersion,
      coveragePlaywrightAPIAvailable,
      ignoreErrorHook,
      transformErrorHook,
      isolatedTab: true
    });
  }

  return runtime;
};

const generateCoverageForPage = scriptExecutionResults => {
  let istanbulCoverageComposed = null;
  Object.keys(scriptExecutionResults).forEach(fileRelativeUrl => {
    const istanbulCoverage = scriptExecutionResults[fileRelativeUrl].coverage;
    istanbulCoverageComposed = istanbulCoverageComposed ? composeTwoFileByFileIstanbulCoverages(istanbulCoverageComposed, istanbulCoverage) : istanbulCoverage;
  });
  return istanbulCoverageComposed;
};

const launchBrowserUsingPlaywright = async ({
  signal,
  browserName,
  stopOnExit,
  playwrightOptions
}) => {
  const launchBrowserOperation = Abort.startOperation();
  launchBrowserOperation.addAbortSignal(signal);
  const playwright = await importPlaywright({
    browserName
  });

  if (stopOnExit) {
    launchBrowserOperation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGHUP: true,
        SIGTERM: true,
        SIGINT: true,
        beforeExit: true,
        exit: true
      }, abort);
    });
  }

  const browserClass = playwright[browserName];

  try {
    const browser = await browserClass.launch({ ...playwrightOptions,
      // let's handle them to close properly browser + remove listener
      // instead of relying on playwright to do so
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    });
    launchBrowserOperation.throwIfAborted();
    return browser;
  } catch (e) {
    if (launchBrowserOperation.signal.aborted && isTargetClosedError(e)) {
      // rethrow the abort error
      launchBrowserOperation.throwIfAborted();
    }

    throw e;
  } finally {
    await launchBrowserOperation.end();
  }
};

const importPlaywright = async ({
  browserName
}) => {
  try {
    const namespace = await import("playwright");
    return namespace;
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(createDetailedMessage(`"playwright" not found. You need playwright in your dependencies to use "${browserName}"`, {
        suggestion: `npm install --save-dev playwright`
      }), {
        cause: e
      });
    }

    throw e;
  }
};

const isTargetClosedError = error => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true;
  }

  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true;
  }

  if (error.message.includes("browserContext.close: Browser closed")) {
    return true;
  }

  return false;
};

const composeTransformer = (previousTransformer, transformer) => {
  return async value => {
    const transformedValue = await previousTransformer(value);
    return transformer(transformedValue);
  };
};

const extractTextFromConsoleMessage = consoleMessage => {
  return consoleMessage.text(); // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
};

const registerEvent = ({
  object,
  eventType,
  callback
}) => {
  object.on(eventType, callback);
  return () => {
    object.removeListener(eventType, callback);
  };
};

const evalException = (exceptionSource, {
  rootDirectoryUrl,
  server,
  transformErrorHook
}) => {
  const script = new Script(exceptionSource, {
    filename: ""
  });
  const error = script.runInThisContext();

  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(escapeRegexpSpecialChars(`${server.origin}/`), "g");
    error.stack = error.stack.replace(remoteRootRegexp, rootDirectoryUrl);
    error.message = error.message.replace(remoteRootRegexp, rootDirectoryUrl);
  }

  return transformErrorHook(error);
};

const chromium = createRuntimeFromPlaywright({
  browserName: "chromium",
  browserVersion: "97.0.4666.0",
  coveragePlaywrightAPIAvailable: true
});
const chromiumIsolatedTab = chromium.isolatedTab;

const firefox = createRuntimeFromPlaywright({
  browserName: "firefox",
  browserVersion: "93.0"
});
const firefoxIsolatedTab = firefox.isolatedTab;

const webkit = createRuntimeFromPlaywright({
  browserName: "webkit",
  browserVersion: "15.4",
  ignoreErrorHook: error => {
    // we catch error during execution but safari throw unhandled rejection
    // in a non-deterministic way.
    // I suppose it's due to some race condition to decide if the promise is catched or not
    // for now we'll ignore unhandled rejection on wekbkit
    if (error.name === "Unhandled Promise Rejection") {
      return true;
    }

    return false;
  },
  transformErrorHook: error => {
    // Force error stack to contain the error message
    // because it's not the case on webkit
    error.stack = `${error.message}
    at ${error.stack}`;
    return error;
  }
});
const webkitIsolatedTab = webkit.isolatedTab;

const ExecOptions = {
  fromExecArgv: execArgv => {
    const execOptions = {};
    let i = 0;

    while (i < execArgv.length) {
      const execArg = execArgv[i];
      const option = execOptionFromExecArg(execArg);
      execOptions[option.name] = option.value;
      i++;
    }

    return execOptions;
  },
  toExecArgv: execOptions => {
    const execArgv = [];
    Object.keys(execOptions).forEach(optionName => {
      const optionValue = execOptions[optionName];

      if (optionValue === "unset") {
        return;
      }

      if (optionValue === "") {
        execArgv.push(optionName);
        return;
      }

      execArgv.push(`${optionName}=${optionValue}`);
    });
    return execArgv;
  }
};

const execOptionFromExecArg = execArg => {
  const equalCharIndex = execArg.indexOf("=");

  if (equalCharIndex === -1) {
    return {
      name: execArg,
      value: ""
    };
  }

  const name = execArg.slice(0, equalCharIndex);
  const value = execArg.slice(equalCharIndex + 1);
  return {
    name,
    value
  };
};

const createChildExecOptions = async ({
  signal = new AbortController().signal,
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(createDetailedMessage(`unexpected debug mode.`, {
      ["debug mode"]: debugMode,
      ["allowed debug mode"]: AVAILABLE_DEBUG_MODE
    }));
  }

  const childExecOptions = ExecOptions.fromExecArgv(processExecArgv);
  await mutateDebuggingOptions(childExecOptions, {
    signal,
    processDebugPort,
    debugMode,
    debugPort,
    debugModeInheritBreak
  });
  return childExecOptions;
};
const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"];

const mutateDebuggingOptions = async (childExecOptions, {
  // ensure multiline
  signal,
  processDebugPort,
  debugMode,
  debugPort,
  debugModeInheritBreak
}) => {
  const parentDebugInfo = getDebugInfo(childExecOptions);
  const parentDebugModeOptionName = parentDebugInfo.debugModeOptionName;
  const parentDebugPortOptionName = parentDebugInfo.debugPortOptionName;
  const childDebugModeOptionName = getChildDebugModeOptionName({
    parentDebugModeOptionName,
    debugMode,
    debugModeInheritBreak
  });

  if (!childDebugModeOptionName) {
    // remove debug mode and debug port fron child options
    if (parentDebugModeOptionName) {
      delete childExecOptions[parentDebugModeOptionName];
    }

    if (parentDebugPortOptionName) {
      delete childExecOptions[parentDebugPortOptionName];
    }

    return;
  } // replace child debug mode


  if (parentDebugModeOptionName && parentDebugModeOptionName !== childDebugModeOptionName) {
    delete childExecOptions[parentDebugModeOptionName];
  }

  childExecOptions[childDebugModeOptionName] = ""; // this is required because vscode does not
  // support assigning a child spawned without a specific port

  const childDebugPortOptionValue = debugPort === 0 ? await findFreePort(processDebugPort + 37, {
    signal
  }) : debugPort; // replace child debug port

  if (parentDebugPortOptionName) {
    delete childExecOptions[parentDebugPortOptionName];
  }

  childExecOptions[childDebugModeOptionName] = portToArgValue(childDebugPortOptionValue);
};

const getChildDebugModeOptionName = ({
  parentDebugModeOptionName,
  debugMode,
  debugModeInheritBreak
}) => {
  if (debugMode === "none") {
    return undefined;
  }

  if (debugMode !== "inherit") {
    return `--${debugMode}`;
  }

  if (!parentDebugModeOptionName) {
    return undefined;
  }

  if (!debugModeInheritBreak && parentDebugModeOptionName === "--inspect-brk") {
    return "--inspect";
  }

  if (!debugModeInheritBreak && parentDebugModeOptionName === "--debug-brk") {
    return "--debug";
  }

  return parentDebugModeOptionName;
};

const portToArgValue = port => {
  if (typeof port !== "number") return "";
  if (port === 0) return "";
  return port;
}; // https://nodejs.org/en/docs/guides/debugging-getting-started/


const getDebugInfo = processOptions => {
  const inspectOption = processOptions["--inspect"];

  if (inspectOption !== undefined) {
    return {
      debugModeOptionName: "--inspect",
      debugPortOptionName: "--inspect-port"
    };
  }

  const inspectBreakOption = processOptions["--inspect-brk"];

  if (inspectBreakOption !== undefined) {
    return {
      debugModeOptionName: "--inspect-brk",
      debugPortOptionName: "--inspect-port"
    };
  }

  const debugOption = processOptions["--debug"];

  if (debugOption !== undefined) {
    return {
      debugModeOptionName: "--debug",
      debugPortOptionName: "--debug-port"
    };
  }

  const debugBreakOption = processOptions["--debug-brk"];

  if (debugBreakOption !== undefined) {
    return {
      debugModeOptionName: "--debug-brk",
      debugPortOptionName: "--debug-port"
    };
  }

  return {};
}; // export const processIsExecutedByVSCode = () => {
//   return typeof process.env.VSCODE_PID === "string"
// }

const require = createRequire(import.meta.url); // see also https://github.com/sindresorhus/execa/issues/96


const killProcessTree = async (processId, {
  signal,
  timeout = 2000
}) => {
  const pidtree = require("pidtree");

  let descendantProcessIds;

  try {
    descendantProcessIds = await pidtree(processId);
  } catch (e) {
    if (e.message === "No matching pid found") {
      descendantProcessIds = [];
    } else {
      throw e;
    }
  }

  descendantProcessIds.forEach(descendantProcessId => {
    try {
      process.kill(descendantProcessId, signal);
    } catch (error) {// ignore
    }
  });

  try {
    process.kill(processId, signal);
  } catch (e) {
    if (e.code !== "ESRCH") {
      throw e;
    }
  }

  let remainingIds = [...descendantProcessIds, processId];

  const updateRemainingIds = () => {
    remainingIds = remainingIds.filter(remainingId => {
      try {
        process.kill(remainingId, 0);
        return true;
      } catch (e) {
        return false;
      }
    });
  };

  let timeSpentWaiting = 0;

  const check = async () => {
    updateRemainingIds();

    if (remainingIds.length === 0) {
      return;
    }

    if (timeSpentWaiting > timeout) {
      const timeoutError = new Error(`timed out waiting for ${remainingIds.length} process to exit (${remainingIds.join(" ")})`);
      timeoutError.code = "TIMEOUT";
      throw timeoutError;
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    timeSpentWaiting += 400;
    await check();
  };

  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
  await check();
};

const NODE_CONTROLLABLE_FILE_URL = new URL("./js/controllable_file.mjs", import.meta.url).href;
const nodeProcess = {
  name: "node",
  version: process.version.slice(1)
};

nodeProcess.run = async ({
  signal = new AbortController().signal,
  logger,
  logProcessCommand = false,
  rootDirectoryUrl,
  fileRelativeUrl,
  keepRunning,
  gracefulStopAllocatedMs = 4000,
  stopSignal,
  onConsole,
  collectCoverage = false,
  coverageForceIstanbul,
  collectPerformance,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  inheritProcessEnv = true,
  commandLineOptions = [],
  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe"
}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }

  env = { ...env,
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true
  };

  if (coverageForceIstanbul) {
    // if we want to force istanbul, we will set process.env.NODE_V8_COVERAGE = ''
    // into the child_process
    env.NODE_V8_COVERAGE = "";
  }

  commandLineOptions = ["--experimental-import-meta-resolve", ...commandLineOptions];
  const cleanupCallbackList = createCallbackListNotifiedOnce();

  const cleanup = async reason => {
    await cleanupCallbackList.notify({
      reason
    });
  };

  const childExecOptions = await createChildExecOptions({
    signal,
    debugPort,
    debugMode,
    debugModeInheritBreak
  });
  const execArgv = ExecOptions.toExecArgv({ ...childExecOptions,
    ...ExecOptions.fromExecArgv(commandLineOptions)
  });
  const envForChildProcess = { ...(inheritProcessEnv ? process.env : {}),
    ...env
  };
  logger[logProcessCommand ? "info" : "debug"](`${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(NODE_CONTROLLABLE_FILE_URL)}`);
  const childProcess = fork(urlToFileSystemPath(NODE_CONTROLLABLE_FILE_URL), {
    execArgv,
    // silent: true
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: envForChildProcess
  });
  logger.debug(createDetailedMessage(`child process forked (pid ${childProcess.pid})`, {
    "execArgv": execArgv.join(`\n`),
    "custom env": JSON.stringify(env, null, "  ")
  })); // if we pass stream, pipe them https://github.com/sindresorhus/execa/issues/81

  if (typeof stdin === "object") {
    stdin.pipe(childProcess.stdin);
  }

  if (typeof stdout === "object") {
    childProcess.stdout.pipe(stdout);
  }

  if (typeof stderr === "object") {
    childProcess.stderr.pipe(stderr);
  }

  const childProcessReadyPromise = new Promise(resolve => {
    onceProcessMessage(childProcess, "ready", resolve);
  });
  const removeOutputListener = installProcessOutputListener(childProcess, ({
    type,
    text
  }) => {
    onConsole({
      type,
      text
    });
  });
  const stop = memoize(async ({
    gracefulStopAllocatedMs
  } = {}) => {
    // all libraries are facing problem on windows when trying
    // to kill a process spawning other processes.
    // "killProcessTree" is theorically correct but sometimes keep process handing forever.
    // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
    // There is no satisfying solution to this problem so we stick to the basic
    // childProcess.kill()
    if (process.platform === "win32") {
      childProcess.kill();
      return;
    }

    if (gracefulStopAllocatedMs) {
      try {
        await killProcessTree(childProcess.pid, {
          signal: GRACEFUL_STOP_SIGNAL,
          timeout: gracefulStopAllocatedMs
        });
        return;
      } catch (e) {
        if (e.code === "TIMEOUT") {
          logger.debug(`kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`);
          await killProcessTree(childProcess.pid, {
            signal: GRACEFUL_STOP_FAILED_SIGNAL
          });
          return;
        }

        throw e;
      }
    }

    await killProcessTree(childProcess.pid, {
      signal: STOP_SIGNAL
    });
    return;
  });
  const actionOperation = Abort.startOperation();
  actionOperation.addAbortSignal(signal);
  const winnerPromise = new Promise(resolve => {
    raceCallbacks({
      aborted: cb => {
        return actionOperation.addAbortCallback(cb);
      },
      // https://nodejs.org/api/child_process.html#child_process_event_disconnect
      // disconnect: (cb) => {
      //   return onceProcessEvent(childProcess, "disconnect", cb)
      // },
      // https://nodejs.org/api/child_process.html#child_process_event_error
      error: cb => {
        return onceProcessEvent(childProcess, "error", cb);
      },
      exit: cb => {
        return onceProcessEvent(childProcess, "exit", (code, signal) => {
          cb({
            code,
            signal
          });
        });
      },
      response: cb => {
        onceProcessMessage(childProcess, "action-result", cb);
      }
    }, resolve);
  });

  const getResult = async () => {
    actionOperation.throwIfAborted();
    await childProcessReadyPromise;
    actionOperation.throwIfAborted();
    await sendToProcess(childProcess, "action", {
      actionType: "execute-using-dynamic-import",
      actionParams: {
        fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
        collectPerformance
      }
    });
    const winner = await winnerPromise;

    if (winner.name === "aborted") {
      return {
        status: "aborted"
      };
    }

    if (winner.name === "error") {
      const error = winner.data;
      removeOutputListener();
      return {
        status: "errored",
        error
      };
    }

    if (winner.name === "exit") {
      const {
        code
      } = winner.data;
      await cleanup("process exit");

      if (code === 12) {
        return {
          status: "errored",
          error: new Error(`node process exited with 12 (the forked child process wanted to use a non-available port for debug)`)
        };
      }

      if (code === null || code === 0 || code === SIGINT_EXIT_CODE || code === SIGTERM_EXIT_CODE || code === SIGABORT_EXIT_CODE) {
        return {
          status: "errored",
          error: new Error(`node process exited during execution`)
        };
      } // process.exit(1) in child process or process.exitCode = 1 + process.exit()
      // means there was an error even if we don't know exactly what.


      return {
        status: "errored",
        error: new Error(`node process exited with code ${code} during execution`)
      };
    }

    const {
      status,
      value
    } = winner.data;

    if (status === "action-failed") {
      return {
        status: "errored",
        error: value
      };
    }

    return {
      status: "completed",
      ...value
    };
  };

  let result;

  try {
    result = await getResult();
  } catch (e) {
    result = {
      status: "errored",
      error: e
    };
  }

  if (keepRunning) {
    stopSignal.notify = stop;
  } else {
    await stop({
      gracefulStopAllocatedMs
    });
  }

  await actionOperation.end();
  return result;
}; // https://nodejs.org/api/process.html#process_signal_events


const SIGINT_SIGNAL_NUMBER = 2;
const SIGABORT_SIGNAL_NUMBER = 6;
const SIGTERM_SIGNAL_NUMBER = 15;
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER;
const SIGABORT_EXIT_CODE = 128 + SIGABORT_SIGNAL_NUMBER;
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER; // http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472

const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL"; // it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL

const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";

const sendToProcess = async (childProcess, type, data) => {
  const source = uneval(data, {
    functionAllowed: true
  });
  return new Promise((resolve, reject) => {
    childProcess.send({
      type,
      data: source
    }, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const installProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = chunk => {
    callback({
      type: "log",
      text: String(chunk)
    });
  };

  childProcess.stdout.on("data", stdoutDataCallback);

  const stdErrorDataCallback = chunk => {
    callback({
      type: "error",
      text: String(chunk)
    });
  };

  childProcess.stderr.on("data", stdErrorDataCallback);
  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback);
    childProcess.stderr.removeListener("data", stdoutDataCallback);
  };
};

const onceProcessMessage = (childProcess, type, callback) => {
  const onmessage = message => {
    if (message.type === type) {
      childProcess.removeListener("message", onmessage); // eslint-disable-next-line no-eval

      callback(message.data ? eval(`(${message.data})`) : "");
    }
  };

  childProcess.on("message", onmessage);
  return () => {
    childProcess.removeListener("message", onmessage);
  };
};

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.once(type, callback);
  return () => {
    childProcess.removeListener(type, callback);
  };
};

const loadUrlGraph = async ({
  operation,
  urlGraph,
  kitchen,
  startLoading,
  writeGeneratedFiles,
  outDirectoryUrl,
  clientRuntimeCompat
}) => {
  if (writeGeneratedFiles && outDirectoryUrl) {
    await ensureEmptyDirectory(outDirectoryUrl);
  }

  const promises = [];
  const promiseMap = new Map();

  const cook = (urlInfo, context) => {
    const promiseFromData = promiseMap.get(urlInfo);
    if (promiseFromData) return promiseFromData;

    const promise = _cook(urlInfo, {
      outDirectoryUrl,
      clientRuntimeCompat,
      ...context
    });

    promises.push(promise);
    promiseMap.set(urlInfo, promise);
    return promise;
  };

  const _cook = async (urlInfo, context) => {
    await kitchen.cook(urlInfo, {
      cookDuringCook: cook,
      ...context
    });
    const {
      references
    } = urlInfo;
    references.forEach(reference => {
      // we don't cook ressource hints
      // because they might refer to ressource that will be modified during build
      // It also means something else have to reference that url in order to cook it
      // so that the preload is deleted by "resync_ressource_hints.js" otherwise
      if (reference.isRessourceHint) {
        return;
      } // we use reference.generatedUrl to mimic what a browser would do:
      // do a fetch to the specifier as found in the file


      const referencedUrlInfo = urlGraph.reuseOrCreateUrlInfo(reference.generatedUrl);
      cook(referencedUrlInfo, {
        reference
      });
    });
  };

  startLoading(({
    trace,
    parentUrl = kitchen.rootDirectoryUrl,
    type,
    specifier
  }) => {
    const [entryReference, entryUrlInfo] = kitchen.prepareEntryPoint({
      trace,
      parentUrl,
      type,
      specifier
    });
    entryUrlInfo.data.isEntryPoint = true;
    cook(entryUrlInfo, {
      reference: entryReference
    });
    return [entryReference, entryUrlInfo];
  });

  const waitAll = async () => {
    operation.throwIfAborted();

    if (promises.length === 0) {
      return;
    }

    const promisesToWait = promises.slice();
    promises.length = 0;
    await Promise.all(promisesToWait);
    await waitAll();
  };

  await waitAll();
  promiseMap.clear();
};

const createUrlGraphSummary = (urlGraph, {
  title = "graph summary"
} = {}) => {
  const graphReport = createUrlGraphReport(urlGraph);
  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
--------------------`;
};

const createUrlGraphReport = urlGraph => {
  const {
    urlInfos
  } = urlGraph;
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0
  };
  Object.keys(urlInfos).forEach(url => {
    if (url.startsWith("data:")) {
      return;
    }

    const urlInfo = urlInfos[url]; // ignore:
    // - inline files: they are already taken into account in the file where they appear
    // - ignored files: we don't know their content

    if (urlInfo.isInline || !urlInfo.shouldHandle) {
      return;
    } // file loaded via import assertion are already inside the graph
    // their js module equivalent are ignored to avoid counting it twice
    // in the build graph the file targeted by import assertion will likely be gone
    // and only the js module remain (likely bundled)


    const urlObject = new URL(urlInfo.url);

    if (urlObject.searchParams.has("as_json_module") || urlObject.searchParams.has("as_css_module") || urlObject.searchParams.has("as_text_module")) {
      return;
    }

    const urlContentSize = Buffer.byteLength(urlInfo.content);
    const category = determineCategory(urlInfo);

    if (category === "sourcemap") {
      countGroups.sourcemaps++;
      sizeGroups.sourcemaps += urlContentSize;
      return;
    }

    countGroups.total++;
    sizeGroups.total += urlContentSize;

    if (category === "html") {
      countGroups.html++;
      sizeGroups.html += urlContentSize;
      return;
    }

    if (category === "css") {
      countGroups.css++;
      sizeGroups.css += urlContentSize;
      return;
    }

    if (category === "js") {
      countGroups.js++;
      sizeGroups.js += urlContentSize;
      return;
    }

    if (category === "json") {
      countGroups.json++;
      sizeGroups.json += urlContentSize;
      return;
    }

    countGroups.other++;
    sizeGroups.other += urlContentSize;
    return;
  });
  const sizesToDistribute = {};
  Object.keys(sizeGroups).forEach(groupName => {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  });
  const percentageGroups = distributePercentages(sizesToDistribute);
  return {
    // sourcemaps are special, there size are ignored
    // so there is no "percentage" associated
    sourcemaps: {
      count: countGroups.sourcemaps,
      size: sizeGroups.sourcemaps,
      percentage: undefined
    },
    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100
    }
  };
};

const determineCategory = urlInfo => {
  if (urlInfo.type === "sourcemap") {
    return "sourcemap";
  }

  if (urlInfo.type === "html") {
    return "html";
  }

  if (urlInfo.type === "css") {
    return "css";
  }

  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js";
  }

  if (urlInfo.type === "json") {
    return "json";
  }

  return "other";
};

const createRepartitionMessage = ({
  html,
  css,
  js,
  json,
  other,
  total
}) => {
  const addPart = (name, {
    count,
    size,
    percentage
  }) => {
    parts.push(`${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${byteAsFileSize(size)} / ${percentage} %)`);
  };

  const parts = []; // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${byteAsFileSize(sourcemaps.size)})`,
  //   )
  // }

  if (html.count) {
    addPart("html ", html);
  }

  if (css.count) {
    addPart("css  ", css);
  }

  if (js.count) {
    addPart("js   ", js);
  }

  if (json.count) {
    addPart("json ", json);
  }

  if (other.count) {
    addPart("other", other);
  }

  addPart("total", total);
  return `- ${parts.join(`
- `)}`;
};

const GRAPH = {
  map: (graph, callback) => {
    return Object.keys(graph.urlInfos).map(url => {
      return callback(graph.urlInfos[url]);
    });
  },
  forEach: (graph, callback) => {
    Object.keys(graph.urlInfos).forEach(url => {
      callback(graph.urlInfos[url], url);
    });
  },
  filter: (graph, callback) => {
    const urlInfos = [];
    Object.keys(graph.urlInfos).forEach(url => {
      const urlInfo = graph.urlInfos[url];

      if (callback(urlInfo)) {
        urlInfos.push(urlInfo);
      }
    });
    return urlInfos;
  },
  find: (graph, callback) => {
    const urlFound = Object.keys(graph.urlInfos).find(url => {
      return callback(graph.urlInfos[url]);
    });
    return graph.urlInfos[urlFound];
  }
};

const createBuilUrlsGenerator = ({
  buildDirectoryUrl
}) => {
  const cache = {};

  const getUrlName = (url, urlInfo) => {
    if (!urlInfo) {
      return urlToFilename(url);
    }

    if (urlInfo.filename) {
      return urlInfo.filename;
    }

    return urlToFilename(url);
  };

  const generate = memoizeByFirstArgument((url, {
    urlInfo,
    parentUrlInfo
  }) => {
    const directoryPath = determineDirectoryPath({
      buildDirectoryUrl,
      urlInfo,
      parentUrlInfo
    });
    let names = cache[directoryPath];

    if (!names) {
      names = [];
      cache[directoryPath] = names;
    }

    const urlObject = new URL(url);
    let {
      search,
      hash
    } = urlObject;
    let name = getUrlName(url, urlInfo);
    let [basename, extension] = splitFileExtension(name);
    extension = extensionMappings[extension] || extension;
    let nameCandidate = `${basename}${extension}`; // reconstruct name in case extension was normalized

    let integer = 1; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate);
        break;
      }

      integer++;
      nameCandidate = `${basename}${integer}${extension}`;
    }

    return `${buildDirectoryUrl}${directoryPath}${nameCandidate}${search}${hash}`;
  });
  return {
    generate
  };
}; // It's best to generate files with an extension representing what is inside the file
// and after build js files contains solely js (js or typescript is gone).
// This way a static file server is already configured to server the correct content-type
// (otherwise one would have to configure that ".jsx" is "text/javascript")
// To keep in mind: if you have "user.jsx" and "user.js" AND both file are not bundled
// you end up with "dist/js/user.js" and "dist/js/user2.js"

const extensionMappings = {
  ".jsx": ".js",
  ".ts": ".js",
  ".tsx": ".js"
};

const splitFileExtension = filename => {
  const dotLastIndex = filename.lastIndexOf(".");

  if (dotLastIndex === -1) {
    return [filename, ""];
  }

  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)];
};

const determineDirectoryPath = ({
  buildDirectoryUrl,
  urlInfo,
  parentUrlInfo
}) => {
  if (urlInfo.type === "directory") {
    return "";
  }

  if (parentUrlInfo && parentUrlInfo.type === "directory") {
    const parentDirectoryPath = urlToRelativeUrl(parentUrlInfo.url, buildDirectoryUrl);
    return parentDirectoryPath;
  }

  if (urlInfo.isInline) {
    const parentDirectoryPath = determineDirectoryPath({
      buildDirectoryUrl,
      urlInfo: parentUrlInfo
    });
    return parentDirectoryPath;
  }

  if (urlInfo.data.isEntryPoint || urlInfo.data.isWebWorkerEntryPoint) {
    return "";
  }

  if (urlInfo.type === "importmap") {
    return "";
  }

  if (urlInfo.type === "html") {
    return "html/";
  }

  if (urlInfo.type === "css") {
    return "css/";
  }

  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js/";
  }

  if (urlInfo.type === "json") {
    return "json/";
  }

  return "other/";
};

// https://bundlers.tooling.report/hashing/avoid-cascade/
const injectGlobalVersionMapping = async ({
  finalGraphKitchen,
  finalGraph,
  versionMappings
}) => {
  await Promise.all(GRAPH.map(finalGraph, async urlInfo => {
    if (urlInfo.data.isEntryPoint || urlInfo.data.isWebWorkerEntryPoint) {
      await injectVersionMappings({
        urlInfo,
        kitchen: finalGraphKitchen,
        versionMappings
      });
    }
  }));
};

const injectVersionMappings = async ({
  urlInfo,
  kitchen,
  versionMappings
}) => {
  const injector = injectors[urlInfo.type];

  if (injector) {
    const {
      content,
      sourcemap
    } = injector(urlInfo, {
      versionMappings
    });
    await kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
      content,
      sourcemap
    });
  }
};

const jsInjector = (urlInfo, {
  versionMappings
}) => {
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(generateClientCodeForVersionMappings(versionMappings, {
    globalName: urlInfo.data.isWebWorkerEntryPoint ? "self" : "window"
  }));
  return magicSource.toContentAndSourcemap();
};

const injectors = {
  html: (urlInfo, {
    versionMappings
  }) => {
    // ideally we would inject an importmap but browser support is too low
    // (even worse for worker/service worker)
    // so for now we inject code into entry points
    const htmlAst = parseHtmlString(urlInfo.content, {
      storeOriginalPositions: false
    });
    injectScriptAsEarlyAsPossible(htmlAst, createHtmlNode({
      "tagName": "script",
      "textContent": generateClientCodeForVersionMappings(versionMappings, {
        globalName: "window"
      }),
      "injected-by": "jsenv:versioning"
    }));
    return {
      content: stringifyHtmlAst(htmlAst)
    };
  },
  js_classic: jsInjector,
  js_module: jsInjector
};

const generateClientCodeForVersionMappings = (versionMappings, {
  globalName
}) => {
  return `
;(function() {

var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")};
${globalName}.__v__ = function (specifier) {
  return __versionMappings__[specifier] || specifier
};

})();

`;
};

const injectServiceWorkerUrls = async ({
  finalGraph,
  finalGraphKitchen,
  lineBreakNormalization
}) => {
  const serviceWorkerEntryUrlInfos = GRAPH.filter(finalGraph, finalUrlInfo => {
    return finalUrlInfo.subtype === "service_worker" && finalUrlInfo.data.isWebWorkerEntryPoint;
  });

  if (serviceWorkerEntryUrlInfos.length === 0) {
    return;
  }

  const serviceWorkerUrls = {};
  GRAPH.forEach(finalGraph, urlInfo => {
    if (urlInfo.isInline || !urlInfo.shouldHandle) {
      return;
    }

    if (!urlInfo.url.startsWith("file:")) {
      return;
    }

    if (urlInfo.data.buildUrlIsVersioned) {
      serviceWorkerUrls[urlInfo.data.buildUrlSpecifier] = {
        versioned: true
      };
      return;
    }

    if (!urlInfo.data.version) {
      // when url is not versioned we compute a "version" for that url anyway
      // so that service worker source still changes and navigator
      // detect there is a change
      const versionGenerator = createVersionGenerator();
      versionGenerator.augmentWithContent({
        content: urlInfo.content,
        contentType: urlInfo.contentType,
        lineBreakNormalization
      });
      const version = versionGenerator.generate();
      urlInfo.data.version = version;
    }

    serviceWorkerUrls[urlInfo.data.buildUrlSpecifier] = {
      versioned: false,
      version: urlInfo.data.version
    };
  });
  await Promise.all(serviceWorkerEntryUrlInfos.map(async serviceWorkerEntryUrlInfo => {
    const magicSource = createMagicSource(serviceWorkerEntryUrlInfo.content);
    const urlsWithoutSelf = { ...serviceWorkerUrls
    };
    delete urlsWithoutSelf[serviceWorkerEntryUrlInfo.data.buildUrlSpecifier];
    magicSource.prepend(generateClientCode(urlsWithoutSelf));
    const {
      content,
      sourcemap
    } = magicSource.toContentAndSourcemap();
    await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(serviceWorkerEntryUrlInfo, {
      content,
      sourcemap
    });
  }));
};

const generateClientCode = serviceWorkerUrls => {
  return `
self.serviceWorkerUrls = ${JSON.stringify(serviceWorkerUrls, null, "  ")};
`;
};

/*
 * Update <link rel="preload"> and friends after build (once we know everything)
 *
 * - Used to remove ressource hint targeting an url that is no longer used:
 *   - Happens because of import assertions transpilation (file is inlined into JS)
 */
const resyncRessourceHints = async ({
  logger,
  finalGraphKitchen,
  finalGraph,
  rawUrls,
  postBuildRedirections
}) => {
  const ressourceHintActions = [];
  GRAPH.forEach(finalGraph, urlInfo => {
    if (urlInfo.type !== "html") {
      return;
    }

    ressourceHintActions.push(async () => {
      const htmlAst = parseHtmlString(urlInfo.content, {
        storeOriginalPositions: false
      });
      const actions = [];

      const visitLinkWithHref = (linkNode, hrefAttribute) => {
        const href = hrefAttribute.value;

        if (!href || href.startsWith("data:")) {
          return;
        }

        const relAttribute = getHtmlNodeAttributeByName(linkNode, "rel");
        const rel = relAttribute ? relAttribute.value : undefined;
        const isRessourceHint = ["preconnect", "dns-prefetch", "prefetch", "preload", "modulepreload"].includes(rel);

        if (!isRessourceHint) {
          return;
        }

        let buildUrl;

        for (const key of Object.keys(rawUrls)) {
          if (rawUrls[key] === href) {
            buildUrl = key;
            break;
          }
        }

        if (!buildUrl) {
          logger.warn(`remove ressource hint because cannot find "${href}"`);
          actions.push(() => {
            removeHtmlNode(linkNode);
          });
          return;
        }

        buildUrl = postBuildRedirections[buildUrl] || buildUrl;
        const urlInfo = finalGraph.getUrlInfo(buildUrl);

        if (!urlInfo) {
          logger.warn(`remove ressource hint because cannot find "${buildUrl}" in the graph`);
          actions.push(() => {
            removeHtmlNode(linkNode);
          });
          return;
        }

        if (urlInfo.dependents.size === 0) {
          logger.warn(`remove ressource hint because "${href}" not used anymore`);
          actions.push(() => {
            removeHtmlNode(linkNode);
          });
          return;
        }

        actions.push(() => {
          hrefAttribute.value = urlInfo.data.buildUrlSpecifier;
        });
      };

      visitHtmlAst(htmlAst, node => {
        if (node.nodeName !== "link") {
          return;
        }

        const hrefAttribute = getHtmlNodeAttributeByName(node, "href");

        if (!hrefAttribute) {
          return;
        }

        visitLinkWithHref(node, hrefAttribute);
      });

      if (actions.length) {
        actions.forEach(action => action());
        await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
          content: stringifyHtmlAst(htmlAst)
        });
      }
    });
  });
  await Promise.all(ressourceHintActions.map(ressourceHintAction => ressourceHintAction()));
};

/*
 * Things hapenning here:
 * 1. load raw build files
 * 2. bundle files
 * 3. optimize files (minify mostly)
 * 4. urls versioning
 */
/**
 * Generate an optimized version of source files into a directory
 * @param {Object} buildParameters
 * @param {string|url} buildParameters.rootDirectoryUrl
 *        Directory containing source files
 * @param {string|url} buildParameters.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} buildParameters.entryPoints
 *        Describe entry point paths and control their names in the build directory
 * @param {object} buildParameters.runtimeCompat
 *        Code generated will be compatible with these runtimes
 * @param {string="/"} buildParameters.baseUrl
 *        All urls in build file contents are prefixed with this url
 * @param {boolean|object} [buildParameters.minification=true]
 *        Minify build file contents
 * @param {boolean} [buildParameters.versioning=true]
 *        Controls if url in build file contents are versioned
 * @param {('search_param'|'filename')} [buildParameters.versioningMethod="search_param"]
 *        Controls how url are versioned
 * @param {boolean|string} [buildParameters.sourcemaps=false]
 *        Generate sourcemaps in the build directory
 * @return {Object} buildReturnValue
 * @return {Object} buildReturnValue.buildFileContents
 *        Contains all build file paths relative to the build directory and their content
 * @return {Object} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Object} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */

const build = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  rootDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  baseUrl = "/",
  // default runtimeCompat corresponds to dynamic import
  // (meaning we can keep <script type="module">)
  runtimeCompat = {
    // android: "8",
    chrome: "63",
    edge: "79",
    firefox: "67",
    ios: "11.3",
    opera: "50",
    safari: "11.3",
    samsung: "8.2"
  },
  plugins = [],
  sourcemaps = false,
  urlAnalysis = {},
  nodeEsmResolution,
  fileSystemMagicResolution,
  directoryReferenceAllowed,
  injectedGlobals,
  transpilation = {},
  bundling = true,
  minification = true,
  versioning = true,
  versioningMethod = "search_param",
  // "filename", "search_param"
  lineBreakNormalization = process.platform === "win32",
  clientFiles = {
    "./**": true,
    "./**/.*/": false,
    // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./dist/": false,
    "./**/node_modules/": false
  },
  cooldownBetweenFileEvents,
  watch = false,
  buildDirectoryClean = true,
  writeOnFileSystem = true,
  writeGeneratedFiles = false,
  assetManifest = true,
  assetManifestFileRelativeUrl = "asset-manifest.json"
}) => {
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);

  if (handleSIGINT) {
    operation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, abort);
    });
  }

  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl);
  assertEntryPoints({
    entryPoints
  });

  if (!["filename", "search_param"].includes(versioningMethod)) {
    throw new Error(`Unexpected "versioningMethod": must be "filename", "search_param"; got ${versioning}`);
  }

  const runBuild = async ({
    signal,
    logLevel
  }) => {
    const logger = createLogger({
      logLevel
    });
    const buildOperation = Abort.startOperation();
    const infoLogsAreDisabled = !loggerToLevels(logger).info;
    buildOperation.addAbortSignal(signal);
    const entryPointKeys = Object.keys(entryPoints);

    if (entryPointKeys.length === 1) {
      logger.info(`
build "${entryPointKeys[0]}"`);
    } else {
      logger.info(`
build ${entryPointKeys.length} entry points`);
    }

    const useExplicitJsClassicConversion = entryPointKeys.some(key => entryPoints[key].includes("?as_js_classic"));
    const rawGraph = createUrlGraph();
    const prebuildTask = createTaskLog("prebuild", {
      disabled: infoLogsAreDisabled
    });
    let urlCount = 0;
    const prebuildRedirections = new Map();
    const rawGraphKitchen = createKitchen({
      signal,
      logger,
      rootDirectoryUrl,
      urlGraph: rawGraph,
      scenario: "build",
      sourcemaps,
      runtimeCompat,
      writeGeneratedFiles,
      plugins: [...plugins, {
        name: "jsenv:build_log",
        appliesDuring: {
          build: true
        },
        cooked: () => {
          urlCount++;
          prebuildTask.setRightText(urlCount);
        }
      }, {
        appliesDuring: "build",
        fetchUrlContent: (urlInfo, context) => {
          if (context.reference.original) {
            prebuildRedirections.set(context.reference.original.url, context.reference.url);
          }
        },
        formatUrl: reference => {
          if (!reference.shouldHandle) {
            return `ignore:${reference.specifier}`;
          }

          return null;
        }
      }, ...getCorePlugins({
        rootDirectoryUrl,
        urlGraph: rawGraph,
        scenario: "build",
        runtimeCompat,
        urlAnalysis,
        nodeEsmResolution,
        fileSystemMagicResolution,
        directoryReferenceAllowed,
        injectedGlobals,
        transpilation: { ...transpilation,
          babelHelpersAsImport: !useExplicitJsClassicConversion,
          jsModuleAsJsClassic: false
        },
        minification,
        bundling
      })]
    });
    const entryUrls = [];

    try {
      await loadUrlGraph({
        operation: buildOperation,
        urlGraph: rawGraph,
        kitchen: rawGraphKitchen,
        writeGeneratedFiles,
        outDirectoryUrl: new URL(`.jsenv/build/`, rootDirectoryUrl),
        startLoading: cookEntryFile => {
          Object.keys(entryPoints).forEach(key => {
            const [, entryUrlInfo] = cookEntryFile({
              trace: `"${key}" in entryPoints parameter`,
              type: "entry_point",
              specifier: key
            });
            entryUrls.push(entryUrlInfo.url);
            entryUrlInfo.filename = entryPoints[key]; // entryUrlInfo.data.entryPointKey = key
          });
        }
      });
    } catch (e) {
      prebuildTask.fail();
      throw e;
    }

    prebuildTask.done();
    const buildUrlsGenerator = createBuilUrlsGenerator({
      buildDirectoryUrl
    });
    const rawUrls = {};
    const bundleRedirections = {};
    const buildUrls = {};
    const bundleUrlInfos = {};
    const bundlers = {};
    rawGraphKitchen.pluginController.plugins.forEach(plugin => {
      const bundle = plugin.bundle;

      if (!bundle) {
        return;
      }

      if (typeof bundle !== "object") {
        throw new Error(`bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`);
      }

      Object.keys(bundle).forEach(type => {
        const bundleFunction = bundle[type];

        if (!bundleFunction) {
          return;
        }

        const bundlerForThatType = bundlers[type];

        if (bundlerForThatType) {
          // first plugin to define a bundle hook wins
          return;
        }

        bundlers[type] = {
          plugin,
          bundleFunction: bundle[type],
          urlInfos: []
        };
      });
    });

    const addToBundlerIfAny = rawUrlInfo => {
      const bundler = bundlers[rawUrlInfo.type];

      if (bundler) {
        bundler.urlInfos.push(rawUrlInfo);
        return;
      }
    };

    GRAPH.forEach(rawGraph, rawUrlInfo => {
      if (rawUrlInfo.data.isEntryPoint) {
        addToBundlerIfAny(rawUrlInfo);

        if (rawUrlInfo.type === "html") {
          rawUrlInfo.dependencies.forEach(dependencyUrl => {
            const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl);

            if (dependencyUrlInfo.isInline) {
              if (dependencyUrlInfo.type === "js_module") {
                // bundle inline script type module deps
                dependencyUrlInfo.references.forEach(inlineScriptRef => {
                  if (inlineScriptRef.type === "js_import_export") {
                    const inlineUrlInfo = rawGraph.getUrlInfo(inlineScriptRef.url);
                    addToBundlerIfAny(inlineUrlInfo);
                  }
                });
              } // inline content cannot be bundled


              return;
            }

            addToBundlerIfAny(dependencyUrlInfo);
          });
          rawUrlInfo.references.forEach(reference => {
            if (reference.isRessourceHint && reference.expectedType === "js_module") {
              const referencedUrlInfo = rawGraph.getUrlInfo(reference.url);

              if (referencedUrlInfo && // something else than the ressource hint is using this url
              referencedUrlInfo.dependents.size > 0) {
                addToBundlerIfAny(referencedUrlInfo);
              }
            }
          });
          return;
        }
      } // File referenced with new URL('./file.js', import.meta.url)
      // are entry points that can be bundled
      // For instance we will bundle service worker/workers detected like this


      if (rawUrlInfo.type === "js_module") {
        rawUrlInfo.references.forEach(reference => {
          if (reference.type === "js_url_specifier") {
            const urlInfo = rawGraph.getUrlInfo(reference.url);
            addToBundlerIfAny(urlInfo);
          }
        });
      }
    });
    const bundleInternalRedirections = {};
    await Object.keys(bundlers).reduce(async (previous, type) => {
      await previous;
      const bundler = bundlers[type];
      const urlInfosToBundle = bundler.urlInfos;

      if (urlInfosToBundle.length === 0) {
        return;
      }

      const bundleTask = createTaskLog(`bundle "${type}"`, {
        disabled: infoLogsAreDisabled
      });

      try {
        const bundlerGeneratedUrlInfos = await rawGraphKitchen.pluginController.callAsyncHook({
          plugin: bundler.plugin,
          hookName: "bundle",
          value: bundler.bundleFunction
        }, urlInfosToBundle, { ...rawGraphKitchen.kitchenContext,
          buildDirectoryUrl
        });
        Object.keys(bundlerGeneratedUrlInfos).forEach(url => {
          const rawUrlInfo = rawGraph.getUrlInfo(url);
          const bundlerGeneratedUrlInfo = bundlerGeneratedUrlInfos[url];
          const bundleUrlInfo = {
            type,
            subtype: rawUrlInfo ? rawUrlInfo.subtype : undefined,
            filename: rawUrlInfo ? rawUrlInfo.filename : undefined,
            ...bundlerGeneratedUrlInfo,
            data: { ...(rawUrlInfo ? rawUrlInfo.data : {}),
              ...bundlerGeneratedUrlInfo.data,
              fromBundle: true
            }
          };
          const buildUrl = buildUrlsGenerator.generate(url, {
            urlInfo: bundleUrlInfo
          });
          bundleRedirections[url] = buildUrl;
          rawUrls[buildUrl] = url;
          bundleUrlInfos[buildUrl] = bundleUrlInfo;

          if (buildUrl.includes("?")) {
            bundleUrlInfos[asUrlWithoutSearch(buildUrl)] = bundleUrlInfo;
          }

          if (bundlerGeneratedUrlInfo.data.bundleRelativeUrl) {
            const urlForBundler = new URL(bundlerGeneratedUrlInfo.data.bundleRelativeUrl, buildDirectoryUrl).href;

            if (urlForBundler !== buildUrl) {
              bundleInternalRedirections[urlForBundler] = buildUrl;
            }
          }
        });
      } catch (e) {
        bundleTask.fail();
        throw e;
      }

      bundleTask.done();
    }, Promise.resolve());
    const urlAnalysisPlugin = jsenvPluginUrlAnalysis({
      rootDirectoryUrl,
      ...urlAnalysis
    });
    const postBuildRedirections = {};
    const finalGraph = createUrlGraph();
    const optimizeUrlContentHooks = rawGraphKitchen.pluginController.addHook("optimizeUrlContent");
    const finalGraphKitchen = createKitchen({
      logger,
      rootDirectoryUrl,
      urlGraph: finalGraph,
      scenario: "build",
      sourcemaps,
      sourcemapsRelativeSources: !versioning,
      runtimeCompat,
      writeGeneratedFiles,
      plugins: [urlAnalysisPlugin, jsenvPluginAsJsClassic({
        systemJsInjection: true
      }), jsenvPluginInline({
        fetchInlineUrls: false
      }), {
        name: "jsenv:postbuild",
        appliesDuring: "build",
        resolveUrl: reference => {
          const performInternalRedirections = url => {
            const prebuildRedirection = prebuildRedirections.get(url);

            if (prebuildRedirection) {
              logger.debug(`\nprebuild redirection\n${url} ->\n${prebuildRedirection}\n`);
              url = prebuildRedirection;
            }

            const bundleRedirection = bundleRedirections[url];

            if (bundleRedirection) {
              logger.debug(`\nbundler redirection\n${url} ->\n${bundleRedirection}\n`);
              url = bundleRedirection;
            }

            const bundleInternalRedirection = bundleInternalRedirections[url];

            if (bundleInternalRedirection) {
              logger.debug(`\nbundler internal redirection\n${url} ->\n${bundleInternalRedirection}\n`);
              url = bundleInternalRedirection;
            }

            return url;
          };

          if (reference.type === "filesystem") {
            const parentRawUrl = rawUrls[reference.parentUrl];
            const baseUrl = ensurePathnameTrailingSlash(parentRawUrl);
            return performInternalRedirections(new URL(reference.specifier, baseUrl).href);
          }

          if (reference.specifier[0] === "/") {
            return performInternalRedirections(new URL(reference.specifier.slice(1), buildDirectoryUrl).href);
          }

          return performInternalRedirections(new URL(reference.specifier, reference.baseUrl || reference.parentUrl).href);
        },
        // redirecting urls into the build directory
        redirectUrl: reference => {
          if (!reference.url.startsWith("file:")) {
            return null;
          } // already a build url


          const rawUrl = rawUrls[reference.url];

          if (rawUrl) {
            return reference.url;
          } // from "js_module_as_js_classic":
          //   - injecting "?as_js_classic" for the first time
          //   - injecting "?as_js_classic" because the parentUrl has it


          if (reference.original) {
            const referenceOriginalUrl = reference.original.url;
            let originalBuildUrl;

            if (urlIsInsideOf(referenceOriginalUrl, buildDirectoryUrl)) {
              originalBuildUrl = referenceOriginalUrl;
            } else {
              originalBuildUrl = Object.keys(rawUrls).find(key => rawUrls[key] === referenceOriginalUrl);
            }

            let rawUrl;

            if (urlIsInsideOf(reference.url, buildDirectoryUrl)) {
              const originalBuildUrl = postBuildRedirections[referenceOriginalUrl];
              rawUrl = originalBuildUrl ? rawUrls[originalBuildUrl] : reference.url;
            } else {
              rawUrl = reference.url;
            } // the url info do not exists yet (it will be created after this "normalize" hook)
            // And the content will be generated when url is cooked by url graph loader.
            // Here we just want to reserve an url for that file


            const buildUrl = buildUrlsGenerator.generate(rawUrl, {
              urlInfo: {
                data: { ...reference.data,
                  isWebWorkerEntryPoint: isWebWorkerEntryPointReference(reference)
                },
                type: reference.expectedType,
                subtype: reference.expectedSubtype,
                filename: reference.filename
              }
            });
            postBuildRedirections[originalBuildUrl] = buildUrl;
            rawUrls[buildUrl] = rawUrl;
            return buildUrl;
          }

          if (reference.isInline) {
            const rawUrlInfo = GRAPH.find(rawGraph, rawUrlInfo => {
              if (!rawUrlInfo.isInline) {
                return false;
              }

              if (rawUrlInfo.content === reference.content) {
                return true;
              }

              if (rawUrlInfo.originalContent === reference.content) {
                return true;
              }

              return false;
            });
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl);

            if (!rawUrlInfo) {
              // generated during final graph
              // (happens for JSON.parse injected for import assertions for instance)
              // throw new Error(`cannot find raw url for "${reference.url}"`)
              return reference.url;
            }

            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: rawUrlInfo,
              parentUrlInfo
            });
            rawUrls[buildUrl] = rawUrlInfo.url;
            return buildUrl;
          } // from "js_module_as_js_classic":
          //   - to inject "s.js"


          if (reference.injected) {
            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: {
                data: {},
                type: "js_classic"
              }
            });
            rawUrls[buildUrl] = reference.url;
            return buildUrl;
          }

          const rawUrlInfo = rawGraph.getUrlInfo(reference.url);
          const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl); // files from root directory but not given to rollup nor postcss

          if (rawUrlInfo) {
            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: rawUrlInfo,
              parentUrlInfo
            });

            if (buildUrl.includes("?")) {
              rawUrls[asUrlWithoutSearch(buildUrl)] = rawUrlInfo.url;
            }

            rawUrls[buildUrl] = rawUrlInfo.url;
            return buildUrl;
          }

          if (reference.type === "sourcemap_comment") {
            // inherit parent build url
            return generateSourcemapUrl(reference.parentUrl);
          } // files generated during the final graph:
          // - sourcemaps
          // const finalUrlInfo = finalGraph.getUrlInfo(url)


          const buildUrl = buildUrlsGenerator.generate(reference.url, {
            urlInfo: {
              data: {},
              type: "asset"
            }
          });
          return buildUrl;
        },
        formatUrl: reference => {
          if (!reference.generatedUrl.startsWith("file:")) {
            if (!versioning && reference.generatedUrl.startsWith("ignore:")) {
              return reference.generatedUrl.slice("ignore:".length);
            }

            return null;
          }

          if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
            throw new Error(`urls should be inside build directory at this stage, found "${reference.url}"`);
          }

          if (reference.isRessourceHint) {
            // return the raw url, we will resync at the end
            return rawUrls[reference.url];
          } // remove eventual search params and hash


          const urlUntilPathname = asUrlUntilPathname(reference.generatedUrl);
          let specifier;

          if (baseUrl === "./") {
            const relativeUrl = urlToRelativeUrl(urlUntilPathname, reference.parentUrl === rootDirectoryUrl ? buildDirectoryUrl : reference.parentUrl); // ensure "./" on relative url (otherwise it could be a "bare specifier")

            specifier = relativeUrl[0] === "." ? relativeUrl : `./${relativeUrl}`;
          } else {
            // if a file is in the same directory we could prefer the relative notation
            // but to keep things simple let's keep the "absolutely relative" to baseUrl for now
            specifier = `${baseUrl}${urlToRelativeUrl(urlUntilPathname, buildDirectoryUrl)}`;
          }

          buildUrls[specifier] = reference.generatedUrl;
          return specifier;
        },
        fetchUrlContent: async (finalUrlInfo, context) => {
          const fromBundleOrRawGraph = url => {
            const bundleUrlInfo = bundleUrlInfos[url];

            if (bundleUrlInfo) {
              logger.debug(`fetching from bundle ${url}`);
              return bundleUrlInfo;
            }

            const rawUrl = rawUrls[url] || url;
            const rawUrlInfo = rawGraph.getUrlInfo(rawUrl);

            if (!rawUrlInfo) {
              throw new Error(`Cannot find url`);
            }

            logger.debug(`fetching from raw graph ${url}`);

            if (rawUrlInfo.isInline) {
              // Inline content, such as <script> inside html, is transformed during the previous phase.
              // If we read the inline content it would be considered as the original content.
              // - It could be "fixed" by taking into account sourcemap and consider sourcemap sources
              //   as the original content.
              //   - But it would not work when sourcemap are not generated
              //   - would be a bit slower
              // - So instead of reading the inline content directly, we search into raw graph
              //   to get "originalContent" and "sourcemap"
              finalUrlInfo.type = rawUrlInfo.type;
              finalUrlInfo.subtype = rawUrlInfo.subtype;
              return rawUrlInfo;
            }

            return rawUrlInfo;
          }; // reference injected during "postbuild":
          // - happens for "as_js_classic" injecting "s.js"


          if (context.reference.injected) {
            const [ref, rawUrlInfo] = rawGraphKitchen.injectReference({
              type: context.reference.type,
              expectedType: context.reference.expectedType,
              expectedSubtype: context.reference.expectedSubtype,
              parentUrl: rawUrls[context.reference.parentUrl],
              specifier: context.reference.specifier,
              injected: true
            });
            await rawGraphKitchen.cook(rawUrlInfo, {
              reference: ref
            });
            return rawUrlInfo;
          } // reference updated during "postbuild":
          // - happens for "as_js_classic"


          if (context.reference.original) {
            return fromBundleOrRawGraph(context.reference.original.url);
          }

          return fromBundleOrRawGraph(finalUrlInfo.url);
        }
      }, {
        name: "jsenv:optimize",
        appliesDuring: "build",
        finalizeUrlContent: async (urlInfo, context) => {
          if (optimizeUrlContentHooks.length) {
            await rawGraphKitchen.pluginController.callAsyncHooks("optimizeUrlContent", urlInfo, context, async optimizeReturnValue => {
              await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, optimizeReturnValue);
            });
          }
        }
      }]
    });
    const buildTask = createTaskLog("build", {
      disabled: infoLogsAreDisabled
    });
    const postBuildEntryUrls = [];

    try {
      await loadUrlGraph({
        operation: buildOperation,
        urlGraph: finalGraph,
        kitchen: finalGraphKitchen,
        outDirectoryUrl: new URL(".jsenv/postbuild/", rootDirectoryUrl),
        writeGeneratedFiles,
        skipRessourceHint: true,
        startLoading: cookEntryFile => {
          entryUrls.forEach(entryUrl => {
            const [, postBuildEntryUrlInfo] = cookEntryFile({
              trace: `entryPoint`,
              type: "entry_point",
              specifier: entryUrl
            });
            postBuildEntryUrls.push(postBuildEntryUrlInfo.url);
          });
        }
      });
    } catch (e) {
      buildTask.fail();
      throw e;
    }

    buildTask.done();
    logger.debug(`graph urls pre-versioning:
${Object.keys(finalGraph.urlInfos).join("\n")}`);

    if (versioning) {
      await applyUrlVersioning({
        buildOperation,
        logger,
        infoLogsAreDisabled,
        buildDirectoryUrl,
        rawUrls,
        buildUrls,
        baseUrl,
        postBuildEntryUrls,
        sourcemaps,
        runtimeCompat,
        writeGeneratedFiles,
        rawGraph,
        urlAnalysisPlugin,
        finalGraph,
        finalGraphKitchen,
        lineBreakNormalization,
        versioningMethod
      });
    }

    GRAPH.forEach(finalGraph, urlInfo => {
      if (!urlInfo.shouldHandle) {
        return;
      }

      if (!urlInfo.url.startsWith("file:")) {
        return;
      }

      if (urlInfo.type === "html") {
        const htmlAst = parseHtmlString(urlInfo.content, {
          storeOriginalPositions: false
        });
        urlInfo.content = stringifyHtmlAst(htmlAst, {
          removeOriginalPositionAttributes: true
        });
      }

      const version = urlInfo.data.version;
      const useVersionedUrl = version && canUseVersionedUrl(urlInfo);
      const buildUrl = useVersionedUrl ? urlInfo.data.versionedUrl : urlInfo.url;
      const buildUrlSpecifier = Object.keys(buildUrls).find(key => buildUrls[key] === buildUrl);
      urlInfo.data.buildUrl = buildUrl;
      urlInfo.data.buildUrlIsVersioned = useVersionedUrl;
      urlInfo.data.buildUrlSpecifier = buildUrlSpecifier;
    });
    await resyncRessourceHints({
      logger,
      finalGraphKitchen,
      finalGraph,
      rawUrls,
      postBuildRedirections
    });
    buildOperation.throwIfAborted();
    const cleanupActions = [];
    GRAPH.forEach(finalGraph, urlInfo => {
      // nothing uses this url anymore
      // - versioning update inline content
      // - file converted for import assertion of js_classic conversion
      if (!urlInfo.data.isEntryPoint && urlInfo.type !== "sourcemap" && urlInfo.dependents.size === 0) {
        cleanupActions.push(() => {
          finalGraph.deleteUrlInfo(urlInfo.url);
        });
      }
    });
    cleanupActions.forEach(cleanupAction => cleanupAction());
    await injectServiceWorkerUrls({
      finalGraphKitchen,
      finalGraph,
      lineBreakNormalization
    });
    buildOperation.throwIfAborted();
    const buildManifest = {};
    const buildFileContents = {};
    const buildInlineContents = {};
    GRAPH.forEach(finalGraph, urlInfo => {
      if (!urlInfo.shouldHandle) {
        return;
      }

      if (!urlInfo.url.startsWith("file:")) {
        return;
      }

      if (urlInfo.type === "directory") {
        return;
      }

      const buildRelativeUrl = urlToRelativeUrl(urlInfo.data.buildUrl, buildDirectoryUrl);

      if (urlInfo.isInline) {
        buildInlineContents[buildRelativeUrl] = urlInfo.content;
      } else {
        buildFileContents[buildRelativeUrl] = urlInfo.content;
        const buildRelativeUrlWithoutVersioning = urlToRelativeUrl(urlInfo.url, buildDirectoryUrl);
        buildManifest[buildRelativeUrlWithoutVersioning] = buildRelativeUrl;
      }
    });

    if (writeOnFileSystem) {
      if (buildDirectoryClean) {
        await ensureEmptyDirectory(buildDirectoryUrl);
      }

      const buildRelativeUrls = Object.keys(buildFileContents);
      await Promise.all(buildRelativeUrls.map(async buildRelativeUrl => {
        await writeFile(new URL(buildRelativeUrl, buildDirectoryUrl), buildFileContents[buildRelativeUrl]);
      }));

      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        await writeFile(new URL(assetManifestFileRelativeUrl, buildDirectoryUrl), JSON.stringify(buildManifest, null, "  "));
      }
    }

    logger.info(createUrlGraphSummary(finalGraph, {
      title: "build files"
    }));
    return {
      buildFileContents,
      buildInlineContents,
      buildManifest
    };
  };

  if (!watch) {
    return runBuild({
      signal: operation.signal,
      logLevel
    });
  }

  let resolveFirstBuild;
  let rejectFirstBuild;
  const firstBuildPromise = new Promise((resolve, reject) => {
    resolveFirstBuild = resolve;
    rejectFirstBuild = reject;
  });
  let buildAbortController;
  let watchFilesTask;

  const startBuild = async () => {
    const buildTask = createTaskLog("build");
    buildAbortController = new AbortController();

    try {
      const result = await runBuild({
        signal: buildAbortController.signal,
        logLevel: "warn"
      });
      buildTask.done();
      resolveFirstBuild(result);
      watchFilesTask = createTaskLog("watch files");
    } catch (e) {
      if (Abort.isAbortError(e)) {
        buildTask.fail(`build aborted`);
      } else if (e.code === "PARSE_ERROR") {
        buildTask.fail();
        console.error(e.stack);
        watchFilesTask = createTaskLog("watch files");
      } else {
        buildTask.fail();
        rejectFirstBuild(e);
        throw e;
      }
    }
  };

  startBuild();
  let startTimeout;

  const clientFileChangeCallback = ({
    relativeUrl,
    event
  }) => {
    const url = new URL(relativeUrl, rootDirectoryUrl).href;

    if (watchFilesTask) {
      watchFilesTask.happen(`${url.slice(rootDirectoryUrl.length)} ${event}`);
      watchFilesTask = null;
    }

    buildAbortController.abort(); // setTimeout is to ensure the abortController.abort() above
    // is properly taken into account so that logs about abort comes first
    // then logs about re-running the build happens

    clearTimeout(startTimeout);
    startTimeout = setTimeout(startBuild, 20);
  };

  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFiles,
    cooldownBetweenFileEvents,
    keepProcessAlive: true,
    recursive: true,
    added: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        relativeUrl,
        event: "added"
      });
    },
    updated: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        relativeUrl,
        event: "modified"
      });
    },
    removed: ({
      relativeUrl
    }) => {
      clientFileChangeCallback({
        relativeUrl,
        event: "removed"
      });
    }
  });
  operation.addAbortCallback(() => {
    stopWatchingClientFiles();
  });
  await firstBuildPromise;
  return stopWatchingClientFiles;
};

const applyUrlVersioning = async ({
  buildOperation,
  logger,
  infoLogsAreDisabled,
  buildDirectoryUrl,
  rawUrls,
  buildUrls,
  baseUrl,
  postBuildEntryUrls,
  sourcemaps,
  runtimeCompat,
  writeGeneratedFiles,
  rawGraph,
  urlAnalysisPlugin,
  finalGraph,
  finalGraphKitchen,
  lineBreakNormalization,
  versioningMethod
}) => {
  const versioningTask = createTaskLog("inject version in urls", {
    disabled: infoLogsAreDisabled
  });

  try {
    const urlsSorted = sortByDependencies(finalGraph.urlInfos);
    urlsSorted.forEach(url => {
      if (url.startsWith("data:")) {
        return;
      }

      const urlInfo = finalGraph.getUrlInfo(url);

      if (urlInfo.type === "sourcemap") {
        return;
      } // ignore:
      // - inline files:
      //   they are already taken into account in the file where they appear
      // - ignored files:
      //   we don't know their content
      // - unused files without reference
      //   File updated such as style.css -> style.css.js or file.js->file.es5.js
      //   Are used at some point just to be discarded later because they need to be converted
      //   There is no need to version them and we could not because the file have been ignored
      //   so their content is unknown


      if (urlInfo.isInline) {
        return;
      }

      if (!urlInfo.shouldHandle) {
        return;
      }

      if (!urlInfo.data.isEntryPoint && urlInfo.dependents.size === 0) {
        return;
      }

      const urlContent = urlInfo.type === "html" ? stringifyHtmlAst(parseHtmlString(urlInfo.content, {
        storeOriginalPositions: false
      }), {
        removeOriginalPositionAttributes: true
      }) : urlInfo.content;
      const versionGenerator = createVersionGenerator();
      versionGenerator.augmentWithContent({
        content: urlContent,
        contentType: urlInfo.contentType,
        lineBreakNormalization
      });
      urlInfo.dependencies.forEach(dependencyUrl => {
        // this dependency is inline
        if (dependencyUrl.startsWith("data:")) {
          return;
        }

        const dependencyUrlInfo = finalGraph.getUrlInfo(dependencyUrl);

        if ( // this content is part of the file, no need to take into account twice
        dependencyUrlInfo.isInline || // this dependency content is not known
        !dependencyUrlInfo.shouldHandle) {
          return;
        }

        if (dependencyUrlInfo.data.version) {
          versionGenerator.augmentWithDependencyVersion(dependencyUrlInfo.data.version);
        } else {
          // because all dependencies are know, if the dependency has no version
          // it means there is a circular dependency between this file
          // and it's dependency
          // in that case we'll use the dependency content
          versionGenerator.augmentWithContent({
            content: dependencyUrlInfo.content,
            contentType: dependencyUrlInfo.contentType,
            lineBreakNormalization
          });
        }
      });
      urlInfo.data.version = versionGenerator.generate();
      urlInfo.data.versionedUrl = normalizeUrl(injectVersionIntoBuildUrl({
        buildUrl: urlInfo.url,
        version: urlInfo.data.version,
        versioningMethod
      }));
    });
    const versionMappings = {};
    const usedVersionMappings = [];
    const versioningKitchen = createKitchen({
      logger,
      rootDirectoryUrl: buildDirectoryUrl,
      urlGraph: finalGraph,
      scenario: "build",
      sourcemaps,
      sourcemapsRelativeSources: true,
      runtimeCompat,
      writeGeneratedFiles,
      plugins: [urlAnalysisPlugin, jsenvPluginInline({
        fetchInlineUrls: false,
        analyzeConvertedScripts: true,
        // to be able to version their urls
        allowEscapeForVersioning: true
      }), {
        name: "jsenv:versioning",
        appliesDuring: {
          build: true
        },
        resolveUrl: reference => {
          const buildUrl = buildUrls[reference.specifier];

          if (buildUrl) {
            return buildUrl;
          }

          const urlObject = new URL(reference.specifier, reference.baseUrl || reference.parentUrl);
          const url = urlObject.href; // during versioning we revisit the deps
          // but the code used to enforce trailing slash on directories
          // is not applied because "jsenv:file_url_resolution" is not used
          // so here we search if the url with a trailing slash exists

          if (reference.type === "filesystem" && !urlObject.pathname.endsWith("/")) {
            const urlWithTrailingSlash = `${url}/`;
            const specifier = Object.keys(buildUrls).find(key => buildUrls[key] === urlWithTrailingSlash);

            if (specifier) {
              return urlWithTrailingSlash;
            }
          }

          return url;
        },
        formatUrl: reference => {
          if (reference.isInline || reference.url.startsWith("data:")) {
            return null;
          }

          if (reference.isRessourceHint) {
            return null;
          } // specifier comes from "normalize" hook done a bit earlier in this file
          // we want to get back their build url to access their infos


          const referencedUrlInfo = finalGraph.getUrlInfo(reference.url);

          if (!canUseVersionedUrl(referencedUrlInfo)) {
            return reference.specifier;
          }

          if (!referencedUrlInfo.shouldHandle) {
            return null;
          }

          const versionedUrl = referencedUrlInfo.data.versionedUrl;

          if (!versionedUrl) {
            // happens for sourcemap
            return `${baseUrl}${urlToRelativeUrl(referencedUrlInfo.url, buildDirectoryUrl)}`;
          }

          const versionedSpecifier = `${baseUrl}${urlToRelativeUrl(versionedUrl, buildDirectoryUrl)}`;
          versionMappings[reference.specifier] = versionedSpecifier;
          buildUrls[versionedSpecifier] = versionedUrl;
          const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl);

          if (parentUrlInfo.jsQuote) {
            // the url is inline inside js quotes
            usedVersionMappings.push(reference.specifier);
            return () => `${parentUrlInfo.jsQuote}+__v__(${JSON.stringify(reference.specifier)})+${parentUrlInfo.jsQuote}`;
          }

          if (reference.type === "js_url_specifier" || reference.subtype === "import_dynamic") {
            usedVersionMappings.push(reference.specifier);
            return () => `__v__(${JSON.stringify(reference.specifier)})`;
          }

          return versionedSpecifier;
        },
        fetchUrlContent: versionedUrlInfo => {
          if (versionedUrlInfo.isInline) {
            const rawUrlInfo = rawGraph.getUrlInfo(rawUrls[versionedUrlInfo.url]);
            const finalUrlInfo = finalGraph.getUrlInfo(versionedUrlInfo.url);
            return {
              originalContent: rawUrlInfo ? rawUrlInfo.originalContent : undefined,
              sourcemap: finalUrlInfo ? finalUrlInfo.sourcemap : undefined,
              contentType: versionedUrlInfo.contentType,
              content: versionedUrlInfo.content
            };
          }

          return versionedUrlInfo;
        }
      }]
    });
    await loadUrlGraph({
      operation: buildOperation,
      urlGraph: finalGraph,
      kitchen: versioningKitchen,
      skipRessourceHint: true,
      writeGeneratedFiles,
      startLoading: cookEntryFile => {
        postBuildEntryUrls.forEach(postBuildEntryUrl => {
          cookEntryFile({
            trace: `entryPoint`,
            type: "entry_point",
            specifier: postBuildEntryUrl
          });
        });
      }
    });

    if (usedVersionMappings.length) {
      const versionMappingsNeeded = {};
      usedVersionMappings.forEach(specifier => {
        versionMappingsNeeded[specifier] = versionMappings[specifier];
      });
      await injectGlobalVersionMapping({
        finalGraphKitchen,
        finalGraph,
        versionMappings: versionMappingsNeeded
      });
    }
  } catch (e) {
    versioningTask.fail();
    throw e;
  }

  versioningTask.done();
};

const injectVersionIntoBuildUrl = ({
  buildUrl,
  version,
  versioningMethod
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParams(buildUrl, {
      v: version
    });
  }

  const basename = urlToBasename(buildUrl);
  const extension = urlToExtension(buildUrl);
  const versionedFilename = `${basename}-${version}${extension}`;
  const versionedUrl = setUrlFilename(buildUrl, versionedFilename);
  return versionedUrl;
};

const assertEntryPoints = ({
  entryPoints
}) => {
  if (typeof entryPoints !== "object" || entryPoints === null) {
    throw new TypeError(`entryPoints must be an object, got ${entryPoints}`);
  }

  const keys = Object.keys(entryPoints);
  keys.forEach(key => {
    if (!key.startsWith("./")) {
      throw new TypeError(`unexpected key in entryPoints, all keys must start with ./ but found ${key}`);
    }

    const value = entryPoints[key];

    if (typeof value !== "string") {
      throw new TypeError(`unexpected value in entryPoints, all values must be strings found ${value} for key ${key}`);
    }

    if (value.includes("/")) {
      throw new TypeError(`unexpected value in entryPoints, all values must be plain strings (no "/") but found ${value} for key ${key}`);
    }
  });
};

const canUseVersionedUrl = urlInfo => {
  if (urlInfo.data.isEntryPoint) {
    return false;
  }

  if (urlInfo.type === "webmanifest") {
    return false;
  }

  if (urlInfo.subtype === "service_worker") {
    return !urlInfo.data.isWebWorkerEntryPoint;
  }

  return true;
};

/*
 * startBuildServer is mean to interact with the build files;
 * files that will be deployed to production server(s).
 * We want to be as close as possible from the production in order to:
 * - run lighthouse
 * - run an automated test tool such as cypress, playwright
 * - see exactly how build file behaves (debug, measure perf, etc)
 * For these reasons "startBuildServer" must be as close as possible from a static file server.
 * It is not meant to provide a nice developper experience: this is the role "startDevServer".
 *
 * Conclusion:
 * "startBuildServer" must be as close as possible from a static file server because
 * we want to be in the user shoes and we should not alter build files.
 */
const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  serverLogLevel = "warn",
  protocol = "http",
  http2,
  certificate,
  privateKey,
  listenAnyIp,
  ip,
  port = 9779,
  services = {},
  rootDirectoryUrl,
  buildDirectoryUrl,
  mainBuildFileUrl = "/index.html",
  buildServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true
  },
  buildServerMainFile = getCallerPosition().url,
  // force disable server autoreload when this code is executed:
  // - inside a forked child process
  // - inside a worker thread
  // (because node cluster won't work)
  buildServerAutoreload = typeof process.send !== "function" && !parentPort && !process.debugPort,
  cooldownBetweenFileEvents
}) => {
  const logger = createLogger({
    logLevel
  });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl);
  const reloadableProcess = await initReloadableProcess({
    signal,
    handleSIGINT,
    ...(buildServerAutoreload ? {
      enabled: true,
      logLevel: "info",
      fileToRestart: buildServerMainFile
    } : {
      enabled: false
    })
  });

  if (reloadableProcess.isPrimary) {
    const buildServerFileChangeCallback = ({
      relativeUrl,
      event
    }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href;

      if (buildServerAutoreload) {
        logger.info(`file ${event} ${url} -> restarting server...`);
        reloadableProcess.reload();
      }
    };

    const stopWatchingBuildServerFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
      watchPatterns: {
        [buildServerMainFile]: true,
        ...buildServerFiles
      },
      cooldownBetweenFileEvents,
      keepProcessAlive: false,
      recursive: true,
      added: ({
        relativeUrl
      }) => {
        buildServerFileChangeCallback({
          relativeUrl,
          event: "added"
        });
      },
      updated: ({
        relativeUrl
      }) => {
        buildServerFileChangeCallback({
          relativeUrl,
          event: "modified"
        });
      },
      removed: ({
        relativeUrl
      }) => {
        buildServerFileChangeCallback({
          relativeUrl,
          event: "removed"
        });
      }
    });
    signal.addEventListener("abort", () => {
      stopWatchingBuildServerFiles();
    });
    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        stopWatchingBuildServerFiles();
        reloadableProcess.stop();
      }
    };
  }

  signal = reloadableProcess.signal;
  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !loggerToLevels(logger).info
  });
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive: true,
    logLevel: serverLogLevel,
    startLog: false,
    protocol,
    http2,
    certificate,
    privateKey,
    listenAnyIp,
    ip,
    port,
    plugins: { ...pluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
        accessControlAllowCredentials: true
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000
      })
    },
    sendErrorDetails: true,
    requestToResponse: composeServices({ ...services,
      build_files_service: createBuildFilesService({
        buildDirectoryUrl,
        mainBuildFileUrl
      })
    })
  });
  startBuildServerTask.done();
  logger.info(``);
  Object.keys(server.origins).forEach(key => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    stop: () => {
      server.stop();
    }
  };
};

const createBuildFilesService = ({
  buildDirectoryUrl,
  mainBuildFileUrl
}) => {
  return request => {
    const urlIsVersioned = new URL(request.ressource, request.origin).searchParams.has("v");

    if (mainBuildFileUrl && request.ressource === "/") {
      request = { ...request,
        ressource: mainBuildFileUrl
      };
    }

    return fetchFileSystem(new URL(request.ressource.slice(1), buildDirectoryUrl), {
      headers: request.headers,
      cacheControl: urlIsVersioned ? `private,max-age=${SECONDS_IN_30_DAYS},immutable` : "private,max-age=0,must-revalidate",
      etagEnabled: true,
      compressionEnabled: !request.pathname.endsWith(".mp4"),
      rootDirectoryUrl: buildDirectoryUrl,
      canReadDirectory: true
    });
  };
};

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;

const execute = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  rootDirectoryUrl,
  fileRelativeUrl,
  allocatedMs,
  mirrorConsole = true,
  keepRunning = false,
  collectConsole,
  collectCoverage,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams,
  scenario = "dev",
  sourcemaps = "inline",
  plugins = [],
  nodeEsmResolution,
  fileSystemMagicResolution,
  injectedGlobals,
  transpilation,
  htmlSupervisor = true,
  writeGeneratedFiles = false,
  port,
  protocol,
  http2,
  certificate,
  privateKey,
  ignoreError = false
}) => {
  const logger = createLogger({
    logLevel
  });
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  const executeOperation = Abort.startOperation();
  executeOperation.addAbortSignal(signal);

  if (handleSIGINT) {
    executeOperation.addAbortSource(abort => {
      return raceProcessTeardownEvents({
        SIGINT: true
      }, abort);
    });
  }

  let resultTransformer = result => result;

  runtimeParams = {
    rootDirectoryUrl,
    fileRelativeUrl,
    ...runtimeParams
  };

  if (runtime.needsServer) {
    const urlGraph = createUrlGraph();
    const runtimeCompat = {
      [runtime.name]: runtime.version
    };
    const kitchen = createKitchen({
      signal,
      logger,
      rootDirectoryUrl,
      urlGraph,
      scenario,
      sourcemaps,
      runtimeCompat,
      writeGeneratedFiles,
      plugins: [...plugins, ...getCorePlugins({
        rootDirectoryUrl,
        urlGraph,
        scenario,
        runtimeCompat,
        htmlSupervisor,
        injectedGlobals,
        nodeEsmResolution,
        fileSystemMagicResolution,
        transpilation
      })]
    });
    const server = await startOmegaServer({
      signal: executeOperation.signal,
      logLevel: "warn",
      rootDirectoryUrl,
      urlGraph,
      kitchen,
      scenario,
      keepProcessAlive: false,
      port,
      protocol,
      http2,
      certificate,
      privateKey
    });
    executeOperation.addEndCallback(async () => {
      await server.stop("execution done");
    });
    runtimeParams = { ...runtimeParams,
      server
    };

    resultTransformer = result => {
      result.server = server;
      return result;
    };
  }

  let result = await run({
    signal: executeOperation.signal,
    logger,
    allocatedMs,
    keepRunning,
    mirrorConsole,
    collectConsole,
    collectCoverage,
    coverageTempDirectoryUrl,
    collectPerformance,
    runtime,
    runtimeParams
  });
  result = resultTransformer(result);

  try {
    if (result.status === "errored") {
      if (ignoreError) {
        return result;
      }
      /*
      Warning: when node launched with --unhandled-rejections=strict, despites
      this promise being rejected by throw result.error node will completely ignore it.
      The error can be logged by doing
      ```js
      process.setUncaughtExceptionCaptureCallback((error) => {
      console.error(error.stack)
      })
      ```
      But it feels like a hack.
      */


      throw result.error;
    }

    return result;
  } finally {
    await executeOperation.end();
  }
};

export { build, chromium, chromiumIsolatedTab, defaultCoverageConfig, execute, executeTestPlan, firefox, firefoxIsolatedTab, injectGlobals, nodeProcess, startBuildServer, startDevServer, webkit, webkitIsolatedTab };
