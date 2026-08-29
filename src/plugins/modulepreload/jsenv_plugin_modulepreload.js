/*
 * Tells the browser the static import graph of a page's module scripts, as
 * `Link: <url>; rel=modulepreload` response headers, so it can fetch every
 * module as soon as the page's headers arrive, without waiting to discover
 * them level by level (each level costing a round trip and, the first time,
 * a cook).
 *
 * Only what the graph already knows is listed: a module never cooked has no
 * known imports. The header is computed at each response from the graph as it
 * is then: a page gets its full list from its second load on, the first load
 * keeps the plain waterfall.
 *
 * Headers rather than <link> elements written into the page: the page content
 * stays what it is (served from memory, revalidated by etag) and the list can
 * grow without cooking the page again. And not references either: a reference
 * from the html to every module would make the html a dependent of each of
 * them, and a hot update propagating up the importers would reach the html
 * (which declines) instead of stopping at the module accepting it.
 *
 * OFF BY DEFAULT, to be enabled once the dev server speaks http/2 or http/3.
 * Over http/1.1 it makes pages slower — measured on a 500 modules page: first
 * paint 32ms -> 868ms, load 626ms -> 985ms. Knowing the urls earlier gives the
 * browser no extra resource: what it has is 6 connections per origin, and
 * every request goes through them in the order it was learned.
 * - Without the header, requests come in execution order: the parser asks
 *   for the render-blocking supervisor script first and gets a connection at
 *   once; transfer and execution overlap, a module executing and discovering
 *   its imports while the others download. On localhost the server answers
 *   from memory in 0.1ms, so the 6 connections are busy from the start.
 * - With the header, hundreds of requests take the 6 connections before the
 *   parser asks for the supervisor script, which then waits for a free
 *   connection behind 1MB+ transfers (520ms measured, 2s with 20ms of RTT).
 *   Meanwhile nothing renders and nothing executes: transfer, then execution,
 *   serialized. http/1.1 cannot reprioritize a queued request, and a
 *   modulepreload has the same priority as a script.
 * - And there is nothing to hide: the discovery latency a preload removes is
 *   ~1ms per graph level on localhost; with a real RTT a wide graph (more
 *   than 6 modules pending at any time) keeps the 6 connections saturated
 *   anyway, and the load takes requests / 6 * RTT whatever the order.
 * It pays off for a deep and narrow graph (connections idle, waiting for a
 * response to learn the next level), and over http/2 or http/3: no
 * connection limit, and the browser prioritizes the blocking script.
 */

import { injectQueryParamsIntoSpecifier } from "@jsenv/urls";

import { urlSpecifierEncoding } from "../../kitchen/url_graph/url_specifier_encoding.js";

export const jsenvPluginModulepreload = () => {
  return {
    name: "jsenv:modulepreload",
    appliesDuring: "dev",
    augmentResponse: ({ urlInfo }) => {
      if (urlInfo.type !== "html") {
        return null;
      }
      const hrefs = collectStaticImportHrefs(urlInfo);
      if (hrefs.length === 0) {
        return null;
      }
      return {
        headers: {
          link: hrefs.map((href) => `<${href}>; rel=modulepreload`).join(", "),
        },
      };
    },
  };
};

const collectStaticImportHrefs = (htmlUrlInfo) => {
  const hrefSet = new Set();
  const visitedSet = new Set();
  const addHref = (reference) => {
    const specifier = urlSpecifierEncoding.decode(reference);
    if (typeof specifier !== "string") {
      return;
    }
    // "?hot" belongs to the request that cooked the importer, the page loading
    // now imports the url without it
    hrefSet.add(injectQueryParamsIntoSpecifier(specifier, { hot: undefined }));
  };
  const visitJsModule = (jsModuleUrlInfo) => {
    if (visitedSet.has(jsModuleUrlInfo)) {
      return;
    }
    visitedSet.add(jsModuleUrlInfo);
    for (const reference of jsModuleUrlInfo.referenceToOthersSet) {
      if (
        reference.type !== "js_import" ||
        reference.isWeak ||
        reference.isImplicit ||
        !STATIC_IMPORT_SUBTYPES.includes(reference.subtype) ||
        !reference.url.startsWith("file:")
      ) {
        continue;
      }
      const importedUrlInfo = reference.urlInfo;
      // never cooked: its content, hence its own imports, are unknown
      if (importedUrlInfo.type !== "js_module") {
        continue;
      }
      addHref(reference);
      visitJsModule(importedUrlInfo);
    }
  };
  for (const reference of htmlUrlInfo.referenceToOthersSet) {
    if (
      reference.type !== "script" ||
      reference.expectedType !== "js_module" ||
      // the scripts jsenv adds to every page are few, small and in memory
      reference.injected ||
      reference.isWeak
    ) {
      continue;
    }
    const scriptUrlInfo = reference.urlInfo;
    if (scriptUrlInfo.type !== "js_module") {
      continue;
    }
    if (!reference.isInline && reference.url.startsWith("file:")) {
      addHref(reference);
    }
    visitJsModule(scriptUrlInfo);
  }
  return Array.from(hrefSet);
};

const STATIC_IMPORT_SUBTYPES = ["import_static", "export_named", "export_all"];
