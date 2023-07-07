import { parseJsWithAcorn } from "@jsenv/ast";
import { bufferToEtag } from "@jsenv/filesystem";

export const defineGettersOnPropertiesDerivedFromOriginalContent = (
  urlInfo,
) => {
  const originalContentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentAst",
  );
  if (originalContentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentAst", () => {
      return getContentAst(urlInfo.originalContent, urlInfo.type, urlInfo.url);
    });
  }
  const originalContentEtagDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "originalContentEtag",
  );
  if (originalContentEtagDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "originalContentEtag", () => {
      return bufferToEtag(Buffer.from(urlInfo.originalContent));
    });
  }
};

export const defineGettersOnPropertiesDerivedFromContent = (urlInfo) => {
  const contentAstDescriptor = Object.getOwnPropertyDescriptor(
    urlInfo,
    "contentAst",
  );
  if (contentAstDescriptor.value === undefined) {
    defineVolatileGetter(urlInfo, "contentAst", () => {
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
    defineVolatileGetter(urlInfo, "contentEtag", () => {
      if (urlInfo.content === urlInfo.originalContent) {
        return urlInfo.originalContentEtag;
      }
      return getContentEtag(urlInfo.content);
    });
  }
};

const defineVolatileGetter = (object, property, getter) => {
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
      restore(value);
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
