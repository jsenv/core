import { getCallerPosition, stringifyUrlSite } from "@jsenv/urls";

import { prependContent } from "../prepend_content.js";
import { GRAPH_VISITOR } from "./url_graph_visitor.js";

export const createReferences = (urlInfo) => {
  const add = (props) => {
    if (urlInfo.contentFinalized && urlInfo.kitchen.context.dev) {
      throw new Error(
        `cannot add reference to an urlInfo already sent to the browser
--- reference specifier ---
${props.specifier}
--- url ---
${urlInfo.url}`,
      );
    }
    const [reference, referencedUrlInfo] = references.prepare(props);
    references.current.push(reference);
    return [reference, referencedUrlInfo];
  };

  const references = {
    prev: [],
    current: [],
    find: (predicate) => references.current.find(predicate),
    startCollecting: async (callback) => {
      references.prev = references.current;
      references.current = [];

      const stopCollecting = () => {
        const setOfDependencyUrls = new Set();
        const dependencyReferenceMap = new Map();
        const setOfImplicitUrls = new Set();
        references.current.forEach((reference) => {
          if (reference.isResourceHint) {
            // resource hint are a special kind of reference.
            // They are a sort of weak reference to an url.
            // We ignore them so that url referenced only by resource hints
            // have url.dependents.size === 0 and can be considered as not used
            // It means html won't consider url referenced solely
            // by <link> as dependency and it's fine
            return;
          }
          const dependencyUrl = reference.url;
          setOfDependencyUrls.add(dependencyUrl);
          dependencyReferenceMap.set(dependencyUrl, reference);
          // an implicit reference do not appear in the file but the non explicited file
          // have an impact on it
          // -> package.json on import resolution for instance
          // in that case:
          // - file depends on the implicit file (it must autoreload if package.json is modified)
          // - cache validity for the file depends on the implicit file (it must be re-cooked if package.json is modified)
          if (reference.isImplicit) {
            setOfImplicitUrls.add(dependencyUrl);
          }
        });
        setOfDependencyUrls.forEach((dependencyUrl) => {
          urlInfo.dependencies.add(dependencyUrl);
          const dependencyUrlInfo = urlInfo.graph.reuseOrCreateUrlInfo(
            dependencyReferenceMap.get(dependencyUrl),
          );
          dependencyUrlInfo.dependents.add(urlInfo.url);
        });
        setOfImplicitUrls.forEach((implicitUrl) => {
          urlInfo.implicitUrls.add(implicitUrl);
          if (urlInfo.isInline) {
            const parentUrlInfo = urlInfo.graph.getUrlInfo(
              urlInfo.inlineUrlSite.url,
            );
            parentUrlInfo.implicitUrls.add(implicitUrl);
          }
        });
        const prunedUrlInfos = [];
        const pruneDependency = (urlInfo, urlToClean) => {
          urlInfo.dependencies.delete(urlToClean);
          const dependencyUrlInfo = urlInfo.graph.getUrlInfo(urlToClean);
          if (!dependencyUrlInfo) {
            return;
          }
          dependencyUrlInfo.dependents.delete(urlInfo.url);
          if (dependencyUrlInfo.dependents.size === 0) {
            dependencyUrlInfo.dependencies.forEach((dependencyUrl) => {
              pruneDependency(dependencyUrlInfo, dependencyUrl);
            });
            prunedUrlInfos.push(dependencyUrlInfo);
          }
        };
        urlInfo.dependencies.forEach((dependencyUrl) => {
          if (!setOfDependencyUrls.has(dependencyUrl)) {
            pruneDependency(urlInfo, dependencyUrl);
          }
        });
        if (prunedUrlInfos.length) {
          prunedUrlInfos.forEach((prunedUrlInfo) => {
            prunedUrlInfo.modifiedTimestamp = Date.now();
            if (prunedUrlInfo.isInline) {
              // should we always delete?
              prunedUrlInfo.deleteFromGraph();
            }
          });
          urlInfo.graph.prunedUrlInfosCallbackRef.current(
            prunedUrlInfos,
            urlInfo,
          );
        }
        urlInfo.implicitUrls.forEach((implicitUrl) => {
          if (!setOfDependencyUrls.has(implicitUrl)) {
            let implicitUrlComesFromInlineContent = false;
            for (const dependencyUrl of urlInfo.dependencies) {
              const dependencyUrlInfo = urlInfo.graph.getUrlInfo(dependencyUrl);
              if (
                dependencyUrlInfo.isInline &&
                dependencyUrlInfo.implicitUrls.has(implicitUrl)
              ) {
                implicitUrlComesFromInlineContent = true;
                break;
              }
            }
            if (!implicitUrlComesFromInlineContent) {
              urlInfo.implicitUrls.delete(implicitUrl);
            }
            if (urlInfo.isInline) {
              const parentUrlInfo = urlInfo.graph.getUrlInfo(
                urlInfo.inlineUrlSite.url,
              );
              parentUrlInfo.implicitUrls.delete(implicitUrl);
            }
          }
        });
      };

      try {
        await callback();
      } finally {
        // finally to ensure reference are updated even in case of error
        stopCollecting();
      }
    },
    prepare: (props) => {
      const [reference, referencedUrlInfo] = urlInfo.kitchen.prepareReference({
        urlInfo,
        ...props,
      });
      return [reference, referencedUrlInfo];
    },
    found: ({ trace, ...rest }) => {
      if (trace === undefined) {
        trace = traceFromUrlSite(
          adjustUrlSite(urlInfo, {
            url: urlInfo.url,
            line: rest.specifierLine,
            column: rest.specifierColumn,
          }),
        );
      }
      // console.log(trace.message)
      return add({
        trace,
        ...rest,
      });
    },
    foundInline: ({
      isOriginalPosition,
      specifierLine,
      specifierColumn,
      ...rest
    }) => {
      const parentUrl = isOriginalPosition ? urlInfo.url : urlInfo.generatedUrl;
      const parentContent = isOriginalPosition
        ? urlInfo.originalContent
        : urlInfo.content;
      return add({
        trace: traceFromUrlSite({
          url: parentUrl,
          content: parentContent,
          line: specifierLine,
          column: specifierColumn,
        }),
        isOriginalPosition,
        specifierLine,
        specifierColumn,
        isInline: true,
        ...rest,
      });
    },
    inject: ({ trace, ...rest }) => {
      if (trace === undefined) {
        const { url, line, column } = getCallerPosition();
        trace = traceFromUrlSite({
          url,
          line,
          column,
        });
      }
      return add({
        trace,
        injected: true,
        ...rest,
      });
    },
    // sourcemap
    // they are not put into urlInfo.references
    // why?
    //   - likely because we are unable to delete them if become unused because of placeholder
    //   - it's no longer going to happen so the'll likely come back to references.current array
    // instead they are put on urlInfo.sourcemapReference
    foundSourcemap: ({ type, specifier, specifierLine, specifierColumn }) => {
      const sourcemapUrlSite = adjustUrlSite(urlInfo, {
        url: urlInfo.url,
        line: specifierLine,
        column: specifierColumn,
      });
      const [sourcemapReference, sourcemapUrlInfo] = references.prepare(
        {
          trace: traceFromUrlSite(sourcemapUrlSite),
          type,
          expectedType: "sourcemap",
          parentUrl: urlInfo.url,
          specifier,
          specifierLine,
          specifierColumn,
        },
        true,
      );
      if (sourcemapReference.isInline) {
        sourcemapUrlInfo.isInline = true;
      }
      sourcemapUrlInfo.type = "sourcemap";
      return [sourcemapReference, sourcemapUrlInfo];
    },
    injectSourcemapPlaceholder: ({ specifier }) => {
      const [sourcemapReference, sourcemapUrlInfo] = references.prepare({
        trace: {
          message: `sourcemap comment placeholder`,
          url: urlInfo.url,
        },
        type: "sourcemap_comment",
        expectedType: "sourcemap",
        subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
        parentUrl: urlInfo.url,
        specifier,
      });
      urlInfo.sourcemapReference = sourcemapReference;
      sourcemapUrlInfo.type = "sourcemap";
      sourcemapUrlInfo.isInline =
        urlInfo.kitchen.context.sourcemaps === "inline";
      return [sourcemapReference, sourcemapUrlInfo];
    },
    // side effect file
    foundSideEffectFile: async ({ sideEffectFileUrl, trace, ...rest }) => {
      if (trace === undefined) {
        const { url, line, column } = getCallerPosition();
        trace = traceFromUrlSite({
          url,
          line,
          column,
        });
      }

      const addRef = () =>
        add({
          trace,
          type: "side_effect_file",
          isImplicit: true,
          injected: true,
          specifier: sideEffectFileUrl,
          ...rest,
        });

      const injectAsBannerCodeBeforeFinalize = (
        sideEffectFileReference,
        sideEffectFileUrlInfo,
      ) => {
        urlInfo.kitchen.callbacksToConsiderGraphLoaded.push(async () => {
          await urlInfo.kitchen.cook(sideEffectFileUrlInfo, {
            reference: sideEffectFileReference,
          });
          await sideEffectFileReference.readGeneratedSpecifier();
          await prependContent(urlInfo, sideEffectFileUrlInfo);
          const inlineProps = getInlineReferenceProps(sideEffectFileReference, {
            urlInfo,
            line: 0,
            column: 0,
          });
          const sideEffectFileReferenceInlined = urlInfo.references.prepare({
            ...inlineProps,
            specifierLine: 0,
            specifierColumn: 0,
            specifier: sideEffectFileReference.generatedSpecifier,
            content: sideEffectFileUrlInfo.content,
            contentType: sideEffectFileUrlInfo.contentType,
            prev: sideEffectFileReference,
          });
          sideEffectFileReference.replace(sideEffectFileReferenceInlined);
        });
        return [sideEffectFileReference, sideEffectFileUrlInfo];
      };

      // When possible we inject code inside the file in the HTML
      // -> less duplication

      // Case #1: Not possible to inject in other files -> inject as banner code
      if (!["js_classic", "js_module", "css"].includes(urlInfo.type)) {
        const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
        return injectAsBannerCodeBeforeFinalize(
          sideEffectFileReference,
          sideEffectFileUrlInfo,
        );
      }

      // Case #2: During dev
      // during dev cooking files is incremental
      // so HTML is already executed by the browser
      // but if we find that ref in a dependent we are good
      // and it's possible to find it in dependents when using
      // dynamic import for instance
      // (in that case we find the side effect file as it was injected in parent)
      if (urlInfo.kitchen.context.dev) {
        const urlsBeforeInjection = Array.from(urlInfo.graph.urlInfoMap.keys());
        const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
        if (!urlsBeforeInjection.includes(sideEffectFileReference.url)) {
          return injectAsBannerCodeBeforeFinalize(
            sideEffectFileReference,
            sideEffectFileUrlInfo,
          );
        }
        const isReferencingSideEffectFile = (urlInfo) =>
          urlInfo.references.some(
            (ref) => ref.url === sideEffectFileReference.url,
          );
        const selfOrAncestorIsReferencingSideEffectFile = (dependentUrl) => {
          const dependentUrlInfo = urlInfo.graph.getUrlInfo(dependentUrl);
          if (isReferencingSideEffectFile(dependentUrlInfo)) {
            return true;
          }
          const dependentReferencingThatFile = GRAPH_VISITOR.findDependent(
            urlInfo,
            (ancestorUrlInfo) => isReferencingSideEffectFile(ancestorUrlInfo),
          );
          return Boolean(dependentReferencingThatFile);
        };
        for (const dependentUrl of urlInfo.dependents) {
          if (!selfOrAncestorIsReferencingSideEffectFile(dependentUrl)) {
            return injectAsBannerCodeBeforeFinalize(
              sideEffectFileReference,
              sideEffectFileUrlInfo,
            );
          }
        }
        return [sideEffectFileReference, sideEffectFileUrlInfo];
      }

      // Case #3: During build
      // during build, files are not executed so it's
      // possible to inject reference when discovering a side effect file
      if (urlInfo.isEntryPoint) {
        const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
        return injectAsBannerCodeBeforeFinalize(
          sideEffectFileReference,
          sideEffectFileUrlInfo,
        );
      }
      const entryPoints = urlInfo.graph.getEntryPoints();
      const [sideEffectFileReference, sideEffectFileUrlInfo] = addRef();
      for (const entryPointUrlInfo of entryPoints) {
        urlInfo.kitchen.callbacksToConsiderGraphLoaded.push(async () => {
          // do not inject if already there
          const { dependencies } = entryPointUrlInfo;
          if (dependencies.has(sideEffectFileUrlInfo.url)) {
            return;
          }
          dependencies.add(sideEffectFileUrlInfo.url);
          await prependContent(entryPointUrlInfo, sideEffectFileUrlInfo);
          await sideEffectFileReference.readGeneratedSpecifier();
          const inlineProps = getInlineReferenceProps(sideEffectFileReference, {
            urlInfo: entryPointUrlInfo,
            // ideally get the correct line and column
            // (for js it's 0, but for html it's different)
            line: 0,
            column: 0,
          });
          const sideEffectFileReferenceInlined =
            entryPointUrlInfo.references.prepare({
              ...inlineProps,
              urlInfo: entryPointUrlInfo,
              specifier: sideEffectFileReference.generatedSpecifier,
              content: sideEffectFileUrlInfo.content,
              contentType: sideEffectFileUrlInfo.contentType,
              prev: sideEffectFileReference,
            });
          sideEffectFileReference.movesTo(sideEffectFileReferenceInlined);
        });
      }
      return [sideEffectFileReference, sideEffectFileUrlInfo];
    },
  };

  return references;
};

const getInlineReferenceProps = (
  reference,
  { urlInfo, isOriginalPosition, line, column, ...rest },
) => {
  const trace = traceFromUrlSite({
    url:
      urlInfo === undefined
        ? isOriginalPosition
          ? reference.urlInfo.url
          : reference.urlInfo.generatedUrl
        : reference.urlInfo.url,
    content:
      urlInfo === undefined
        ? isOriginalPosition
          ? reference.urlInfo.originalContent
          : reference.urlInfo.content
        : urlInfo.content,
    line,
    column,
  });
  return {
    trace,
    isInline: true,
    line,
    column,
    ...rest,
  };
};

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const adjustUrlSite = (urlInfo, { urlGraph, url, line, column }) => {
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
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line:
          inlineUrlSite.line === undefined
            ? urlSite.line
            : inlineUrlSite.line + urlSite.line,
        column:
          inlineUrlSite.column === undefined
            ? urlSite.column
            : inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    );
  };
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  );
};
