import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { composeTwoSourcemaps, createMagicSource } from "@jsenv/sourcemap";

const injectionSymbol = Symbol.for("jsenv_injection");
export const INJECTIONS = {
  global: (value) => {
    return { [injectionSymbol]: "global", value };
  },
  optional: (value) => {
    return { [injectionSymbol]: "optional", value };
  },
};

export const applyContentInjections = (content, contentInjections, urlInfo) => {
  const keys = Object.keys(contentInjections);
  const globals = {};
  const placeholderReplacements = [];
  for (const key of keys) {
    const contentInjection = contentInjections[key];
    if (contentInjection && contentInjection[injectionSymbol]) {
      const valueBehindSymbol = contentInjection[injectionSymbol];
      if (valueBehindSymbol === "global") {
        globals[key] = contentInjection.value;
      } else if (valueBehindSymbol === "optional") {
        placeholderReplacements.push({
          key,
          isOptional: true,
          value: contentInjection.value,
        });
      } else {
        throw new Error(`unknown injection type "${valueBehindSymbol}"`);
      }
    } else {
      placeholderReplacements.push({
        key,
        value: contentInjection,
      });
    }
  }

  const needGlobalsInjection = Object.keys(globals).length > 0;
  const needPlaceholderReplacements = placeholderReplacements.length > 0;

  if (needGlobalsInjection && needPlaceholderReplacements) {
    const globalInjectionResult = injectGlobals(content, globals, urlInfo);
    const replaceInjectionResult = injectPlaceholderReplacements(
      globalInjectionResult.content,
      placeholderReplacements,
      urlInfo,
    );
    return {
      content: replaceInjectionResult.content,
      sourcemap: composeTwoSourcemaps(
        globalInjectionResult.sourcemap,
        replaceInjectionResult.sourcemap,
      ),
    };
  }
  if (needGlobalsInjection) {
    return injectGlobals(content, globals, urlInfo);
  }
  if (needPlaceholderReplacements) {
    return injectPlaceholderReplacements(
      content,
      placeholderReplacements,
      urlInfo,
    );
  }
  return null;
};

export const injectPlaceholderReplacements = (
  content,
  placeholderReplacements,
  urlInfo,
) => {
  const magicSource = createMagicSource(content);
  for (const { key, isOptional, value } of placeholderReplacements) {
    let index = content.indexOf(key);
    if (index === -1) {
      if (!isOptional) {
        urlInfo.context.logger.warn(
          `placeholder "${key}" not found in ${urlInfo.url}.
--- suggestion a ---
Add "${key}" in that file.
--- suggestion b ---
Fix eventual typo in "${key}"?
--- suggestion c ---
Mark injection as optional using INJECTIONS.optional():
import { INJECTIONS } from "@jsenv/core";

return {
"${key}": INJECTIONS.optional(${JSON.stringify(value)}),
};`,
        );
      }
      continue;
    }

    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement:
          urlInfo.type === "js_classic" ||
          urlInfo.type === "js_module" ||
          urlInfo.type === "html"
            ? JSON.stringify(value, null, "  ")
            : value,
      });
      index = content.indexOf(key, end);
    }
  }
  return magicSource.toContentAndSourcemap();
};

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
  return {
    content: stringifyHtmlAst(htmlAst),
  };
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
