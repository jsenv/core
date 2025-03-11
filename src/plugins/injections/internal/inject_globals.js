import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { createMagicSource } from "@jsenv/sourcemap";

export const injectGlobals = (content, globals, urlInfo) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtml(content, globals, urlInfo);
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJs(content, globals, urlInfo);
  }
  throw new Error(`cannot inject globals into "${urlInfo.type}"`);
};

const globalInjectorOnHtml = (content, globals, urlInfo) => {
  // ideally we would inject an importmap but browser support is too low
  // (even worse for worker/service worker)
  // so for now we inject code into entry points
  const htmlAst = parseHtml({
    html: content,
    url: urlInfo.url,
    storeOriginalPositions: false,
  });
  const clientCode = generateClientCodeForGlobals(globals, {
    isWebWorker: false,
  });
  injectJsenvScript(htmlAst, {
    content: clientCode,
    pluginName: "jsenv:inject_globals",
  });
  return stringifyHtmlAst(htmlAst);
};

const globalsInjectorOnJs = (content, globals, urlInfo) => {
  const clientCode = generateClientCodeForGlobals(globals, {
    isWebWorker:
      urlInfo.subtype === "worker" ||
      urlInfo.subtype === "service_worker" ||
      urlInfo.subtype === "shared_worker",
  });
  const magicSource = createMagicSource(content);
  magicSource.prepend(clientCode);
  return magicSource.toContentAndSourcemap();
};

const generateClientCodeForGlobals = (globals, { isWebWorker = false }) => {
  const globalName = isWebWorker ? "self" : "window";
  return `Object.assign(${globalName}, ${JSON.stringify(
    globals,
    null,
    "  ",
  )});`;
};
