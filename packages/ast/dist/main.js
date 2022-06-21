import { parse, serialize, parseFragment } from 'parse5';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const getHtmlNodeAttribute = (htmlNode, attributeName) => {
  const attribute = getHtmlAttributeByName(htmlNode, attributeName);
  return attribute ? attribute.value || "" : undefined
};

const setHtmlNodeAttributes = (htmlNode, attributesToAssign) => {
  if (typeof attributesToAssign !== "object") {
    throw new TypeError(`attributesToAssign must be an object`)
  }
  const { attrs } = htmlNode;
  if (!attrs) return
  Object.keys(attributesToAssign).forEach((key) => {
    const existingAttributeIndex = attrs.findIndex(({ name }) => name === key);
    const value = attributesToAssign[key];
    // remove no-op
    if (existingAttributeIndex === -1 && value === undefined) {
      return
    }
    // add
    if (existingAttributeIndex === -1 && value !== undefined) {
      attrs.push({
        name: key,
        value,
      });
      return
    }
    // remove
    if (value === undefined) {
      attrs.splice(existingAttributeIndex, 1);
      return
    }
    // update
    attrs[existingAttributeIndex].value = value;
  });
};

const getHtmlAttributeByName = (htmlNode, attributeName) => {
  const attrs = htmlNode.attrs;
  const attribute = attrs
    ? attrs.find((attr) => attr.name === attributeName)
    : null;
  return attribute
};

const storeHtmlNodePosition = (node) => {
  const originalPositionAttributeName = `original-position`;
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  );
  if (originalPosition !== undefined) {
    return true
  }
  const { sourceCodeLocation } = node;
  if (!sourceCodeLocation) {
    return false
  }
  const { startLine, startCol, endLine, endCol } = sourceCodeLocation;
  setHtmlNodeAttributes(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  });
  return true
};
const storeHtmlNodeAttributePosition = (node, attributeName) => {
  const { sourceCodeLocation } = node;
  if (!sourceCodeLocation) {
    return false
  }
  const attributeValue = getHtmlNodeAttribute(node, attributeName);
  if (attributeValue === undefined) {
    return false
  }
  const attributeLocation = sourceCodeLocation.attrs[attributeName];
  if (!attributeLocation) {
    return false
  }
  const originalPositionAttributeName = `original-${attributeName}-position`;
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  );
  if (originalPosition !== undefined) {
    return true
  }
  const { startLine, startCol, endLine, endCol } = attributeLocation;
  setHtmlNodeAttributes(node, {
    [originalPositionAttributeName]: `${startLine}:${startCol};${endLine}:${endCol}`,
  });
  return true
};

const getHtmlNodePosition = (node, { preferOriginal = false } = {}) => {
  const position = {};
  const { sourceCodeLocation } = node;
  if (sourceCodeLocation) {
    const { startLine, startCol, endLine, endCol } = sourceCodeLocation;
    Object.assign(position, {
      line: startLine,
      lineEnd: endLine,
      column: startCol,
      columnEnd: endCol,
    });
  }
  const originalPosition = getHtmlNodeAttribute(node, "original-position");
  if (originalPosition === undefined) {
    return position
  }
  const [start, end] = originalPosition.split(";");
  const [originalLine, originalColumn] = start.split(":");
  const [originalLineEnd, originalColumnEnd] = end.split(":");
  Object.assign(position, {
    originalLine: parseInt(originalLine),
    originalColumn: parseInt(originalColumn),
    originalLineEnd: parseInt(originalLineEnd),
    originalColumnEnd: parseInt(originalColumnEnd),
  });
  if (preferOriginal) {
    position.line = position.originalLine;
    position.column = position.originalColumn;
    position.lineEnd = position.originalLineEnd;
    position.columnEnd = position.originalColumnEnd;
    position.isOriginal = true;
  }
  return position
};
const getHtmlNodeAttributePosition = (node, attributeName) => {
  const position = {};
  const { sourceCodeLocation } = node;
  if (sourceCodeLocation) {
    const attributeLocation = sourceCodeLocation.attrs[attributeName];
    if (attributeLocation) {
      Object.assign(position, {
        line: attributeLocation.startLine,
        column: attributeLocation.startCol,
      });
    }
  }
  const originalPositionAttributeName =
    attributeName === "generated-from-src"
      ? "original-src-position"
      : attributeName === "generated-from-href"
      ? "original-href-position"
      : `original-${attributeName}-position`;
  const originalPosition = getHtmlNodeAttribute(
    node,
    originalPositionAttributeName,
  );
  if (originalPosition === undefined) {
    return position
  }
  const [start, end] = originalPosition.split(";");
  const [originalLine, originalColumn] = start.split(":");
  const [originalLineEnd, originalColumnEnd] = end.split(":");
  Object.assign(position, {
    originalLine: parseInt(originalLine),
    originalColumn: parseInt(originalColumn),
    originalLineEnd: parseInt(originalLineEnd),
    originalColumnEnd: parseInt(originalColumnEnd),
  });
  return position
};

const visitHtmlNodes = (htmlAst, visitors) => {
  const visitNode = (node) => {
    const visitor = visitors[node.nodeName] || visitors["*"];
    if (visitor) {
      const callbackReturnValue = visitor(node);
      if (callbackReturnValue === "stop") {
        return
      }
    }
    const { childNodes } = node;
    if (childNodes) {
      let i = 0;
      while (i < childNodes.length) {
        visitNode(childNodes[i++]);
      }
    }
  };
  visitNode(htmlAst);
};

const findHtmlNode = (htmlAst, predicate) => {
  let nodeMatching = null;
  visitHtmlNodes(htmlAst, {
    "*": (node) => {
      if (predicate(node)) {
        nodeMatching = node;
        return "stop"
      }
      return null
    },
  });
  return nodeMatching
};

const findHtmlChildNode = (htmlNode, predicate) => {
  const { childNodes = [] } = htmlNode;
  return childNodes.find(predicate)
};

const getHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode);
  return textNode ? textNode.value : undefined
};

const getTextNode = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0];
  const textNode =
    firstChild && firstChild.nodeName === "#text" ? firstChild : null;
  return textNode
};

const removeHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode);
  if (textNode) {
    htmlNode.childNodes = [];
  }
};

const setHtmlNodeText = (htmlNode, textContent) => {
  const textNode = getTextNode(htmlNode);
  if (textNode) {
    textNode.value = textContent;
  } else {
    const newTextNode = {
      nodeName: "#text",
      value: textContent,
      parentNode: htmlNode,
    };
    htmlNode.childNodes.splice(0, 0, newTextNode);
  }
};

const parseHtmlString = (
  htmlString,
  { storeOriginalPositions = true } = {},
) => {
  const htmlAst = parse(htmlString, { sourceCodeLocationInfo: true });
  if (storeOriginalPositions) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    );
    const stored = getHtmlNodeAttribute(htmlNode, "original-position-stored");
    if (stored === undefined) {
      visitHtmlNodes(htmlAst, {
        "*": (node) => {
          if (node.nodeName === "script" || node.nodeName === "style") {
            const htmlNodeText = getHtmlNodeText(node);
            if (htmlNodeText !== undefined) {
              storeHtmlNodePosition(node);
            }
          }
          storeHtmlNodeAttributePosition(node, "src");
          storeHtmlNodeAttributePosition(node, "href");
        },
      });
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": "",
      });
    }
  }
  return htmlAst
};

const stringifyHtmlAst = (
  htmlAst,
  { removeOriginalPositionAttributes = false } = {},
) => {
  if (removeOriginalPositionAttributes) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    );
    const storedAttribute = getHtmlNodeAttribute(
      htmlNode,
      "original-position-stored",
    );
    if (storedAttribute !== undefined) {
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": undefined,
      });
      visitHtmlNodes(htmlAst, {
        "*": (node) => {
          setHtmlNodeAttributes(node, {
            "original-position": undefined,
            "original-src-position": undefined,
            "original-href-position": undefined,
            "injected-by": undefined,
            "generated-by": undefined,
            "generated-from-src": undefined,
            "generated-from-href": undefined,
          });
        },
      });
    }
  }
  const htmlString = serialize(htmlAst);

  return htmlString
};

const parseSvgString = (svgString) => {
  const svgAst = parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  });
  return svgAst
};
const stringifySvgAst = stringifyHtmlAst;

const analyzeScriptNode = (scriptNode) => {
  const type = getHtmlNodeAttribute(scriptNode, "type");
  if (type === undefined || type === "text/javascript") {
    return "classic"
  }
  if (type === "module") {
    return "module"
  }
  if (type === "importmap") {
    return "importmap"
  }
  return type
};

const analyzeLinkNode = (linkNode) => {
  const rel = getHtmlNodeAttribute(linkNode, "rel");
  if (rel === "stylesheet") {
    return {
      isStylesheet: true,
    }
  }
  const isRessourceHint = [
    "preconnect",
    "dns-prefetch",
    "prefetch",
    "preload",
    "modulepreload",
  ].includes(rel);
  return {
    isRessourceHint,
    rel,
  }
};

const parseSrcSet = (srcset) => {
  const srcCandidates = [];
  srcset.split(",").forEach((set) => {
    const [specifier, descriptor] = set.trim().split(" ");
    srcCandidates.push({
      specifier,
      descriptor,
    });
  });
  return srcCandidates
};

const stringifySrcSet = (srcCandidates) => {
  const srcset = srcCandidates
    .map(({ specifier, descriptor }) => `${specifier} ${descriptor}`)
    .join(", ");
  return srcset
};

const removeHtmlNode = (htmlNode) => {
  const { childNodes } = htmlNode.parentNode;
  childNodes.splice(childNodes.indexOf(htmlNode), 1);
};

const createHtmlNode = ({ tagName, textContent = "", ...rest }) => {
  const html = `<${tagName} ${stringifyAttributes(
    rest,
  )}>${textContent}</${tagName}>`;
  const fragment = parseFragment(html);
  return fragment.childNodes[0]
};

const injectScriptNodeAsEarlyAsPossible = (htmlAst, scriptNode) => {
  const injectedBy = getHtmlNodeAttribute(scriptNode, "injected-by");
  if (injectedBy === undefined) {
    setHtmlNodeAttributes(scriptNode, {
      "injected-by": "jsenv",
    });
  }
  const isModule = analyzeScriptNode(scriptNode) === "module";
  if (isModule) {
    const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
      if (node.nodeName !== "script") return false
      return analyzeScriptNode(node) === "importmap"
    });
    if (firstImportmapScript) {
      return insertAfter(
        scriptNode,
        firstImportmapScript.parentNode,
        firstImportmapScript,
      )
    }
  }
  const headNode = findChild(htmlAst, (node) => node.nodeName === "html")
    .childNodes[0];
  const firstHeadScript = findChild(headNode, (node) => {
    return node.nodeName === "script"
  });
  return insertBefore(scriptNode, headNode, firstHeadScript)
};

const insertBefore = (nodeToInsert, futureParentNode, futureNextSibling) => {
  const { childNodes = [] } = futureParentNode;
  const futureIndex = futureNextSibling
    ? childNodes.indexOf(futureNextSibling)
    : 0;
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex);
};

const insertAfter = (nodeToInsert, futureParentNode, futurePrevSibling) => {
  const { childNodes = [] } = futureParentNode;
  const futureIndex = futurePrevSibling
    ? childNodes.indexOf(futurePrevSibling) + 1
    : childNodes.length;
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex);
};

const injectWithWhitespaces = (nodeToInsert, futureParentNode, futureIndex) => {
  const { childNodes = [] } = futureParentNode;
  const previousSiblings = childNodes.slice(0, futureIndex);
  const nextSiblings = childNodes.slice(futureIndex);
  const futureChildNodes = [];
  const previousSibling = previousSiblings[0];
  if (previousSibling) {
    futureChildNodes.push(...previousSiblings);
  }
  if (!previousSibling || previousSibling.nodeName !== "#text") {
    futureChildNodes.push({
      nodeName: "#text",
      value: "\n    ",
      parentNode: futureParentNode,
    });
  }
  futureChildNodes.push(nodeToInsert);
  const nextSibling = nextSiblings[0];
  if (!nextSibling || nextSibling.nodeName !== "#text") {
    futureChildNodes.push({
      nodeName: "#text",
      value: "\n    ",
      parentNode: futureParentNode,
    });
  }
  if (nextSibling) {
    futureChildNodes.push(...nextSiblings);
  }
  futureParentNode.childNodes = futureChildNodes;
};

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate);

const stringifyAttributes = (object) => {
  return Object.keys(object)
    .map((key) => `${key}=${valueToHtmlAttributeValue(object[key])}`)
    .join(" ")
};

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
};

const inlineScriptNode = (script, textContent) => {
  const src = getHtmlNodeAttribute(script, "src");
  setHtmlNodeAttributes(script, {
    "generated-from-src": src,
    "src": undefined,
    "crossorigin": undefined,
    "integrity": undefined,
  });
  setHtmlNodeText(script, textContent);
};

const inlineLinkStylesheetNode = (link, textContent) => {
  const href = getHtmlNodeAttribute(link, "href");
  setHtmlNodeAttributes(link, {
    "generated-from-href": href,
    "href": undefined,
    "rel": undefined,
    "type": undefined,
    "as": undefined,
    "crossorigin": undefined,
    "integrity": undefined,
  });
  link.nodeName = "style";
  link.tagName = "style";
  setHtmlNodeText(link, textContent);
};

const inlineImgNode = (img, contentAsBase64) => {
  const src = getHtmlNodeAttribute(img, "src");
  setHtmlNodeAttributes(img, {
    "generated-from-src": src,
    "src": contentAsBase64,
  });
};

const applyPostCss = async ({
  sourcemaps = "comment",
  plugins,
  // https://github.com/postcss/postcss#options
  options = {},
  url,
  map,
  content,
}) => {
  const { default: postcss } = await import('postcss');

  try {
    const cssFileUrl = urlToFileUrl(url);
    const result = await postcss(plugins).process(content, {
      collectUrls: true,
      from: fileURLToPath(cssFileUrl),
      to: fileURLToPath(cssFileUrl),
      map: {
        annotation: sourcemaps === "file",
        inline: sourcemaps === "inline",
        // https://postcss.org/api/#sourcemapoptions
        ...(map ? { prev: JSON.stringify(map) } : {}),
      },
      ...options,
    });
    return {
      postCssMessages: result.messages,
      map: result.map.toJSON(),
      content: result.css,
    }
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error));
      throw error
    }
    throw error
  }
};

// the goal of this function is to take an url that is likely an http url
// info a file:// url
// for instance http://example.com/dir/file.js
// must becomes file:///dir/file.js
// but in windows it must be file://C:/dir/file.js
const filesystemRootUrl = new URL("/", import.meta.url);
const urlToFileUrl = (url) => {
  const urlString = String(url);
  if (urlString.startsWith("file:")) {
    return urlString
  }
  const origin = new URL(url).origin;
  const afterOrigin = urlString.slice(origin.length);
  return new URL(afterOrigin, filesystemRootUrl).href
};

const require$1 = createRequire(import.meta.url);

const transpileWithParcel = (urlInfo, context) => {
  const css = require$1("@parcel/css");
  const targets = runtimeCompatToTargets(context.runtimeCompat);
  const { code, map } = css.transform({
    filename: fileURLToPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: false,
  });
  return { code, map }
};

const minifyWithParcel = (urlInfo, context) => {
  const css = require$1("@parcel/css");
  const targets = runtimeCompatToTargets(context.runtimeCompat);
  const { code, map } = css.transform({
    filename: fileURLToPath(urlInfo.originalUrl),
    code: Buffer.from(urlInfo.content),
    targets,
    minify: true,
  });
  return { code, map }
};

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {}
  ;["chrome", "firefox", "ie", "opera", "safari"].forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[runtimeName] = versionToBits(version);
    }
  });
  return targets
};

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch
};

const require = createRequire(import.meta.url);

/**

https://github.com/postcss/postcss/blob/master/docs/writing-a-plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/runner.md#31-dont-show-js-stack-for-csssyntaxerror

In case css sourcemap contains no%20source
This is because of https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/map-generator.js#L231
and it indicates a node has been replaced without passing source
hence sourcemap cannot point the original source location

*/

const postCssPluginUrlVisitor = ({ urlVisitor = () => null }) => {
  const parseCssValue = require("postcss-value-parser");
  const stringifyCssNodes = parseCssValue.stringify;

  return {
    postcssPlugin: "url_visitor",
    prepare: (result) => {
      const { from } = result.opts;
      const fromUrl = String(pathToFileURL(from));
      const mutations = [];
      return {
        AtRule: {
          import: (atImportNode, { AtRule }) => {
            if (atImportNode.parent.type !== "root") {
              atImportNode.warn(result, "`@import` should be top level");
              return
            }
            if (atImportNode.nodes) {
              atImportNode.warn(
                result,
                "`@import` was not terminated correctly",
              );
              return
            }
            const parsed = parseCssValue(atImportNode.params);
            let [urlNode] = parsed.nodes;
            if (
              !urlNode ||
              (urlNode.type !== "string" && urlNode.type !== "function")
            ) {
              atImportNode.warn(
                result,
                `No URL in \`${atImportNode.toString()}\``,
              );
              return
            }
            let url = "";
            if (urlNode.type === "string") {
              url = urlNode.value;
            } else if (urlNode.type === "function") {
              // Invalid function
              if (!/^url$/i.test(urlNode.value)) {
                atImportNode.warn(
                  result,
                  `Invalid \`url\` function in \`${atImportNode.toString()}\``,
                );
                return
              }
              const firstNode = urlNode.nodes[0];
              if (firstNode && firstNode.type === "string") {
                urlNode = firstNode;
                url = urlNode.value;
              } else {
                urlNode = urlNode.nodes;
                url = stringifyCssNodes(urlNode.nodes);
              }
            }

            url = url.trim();
            if (url.length === 0) {
              atImportNode.warn(
                result,
                `Empty URL in \`${atImportNode.toString()}\``,
              );
              return
            }

            const specifier = url;
            url = new URL(specifier, fromUrl).href;
            if (url === fromUrl) {
              atImportNode.warn(
                result,
                `\`@import\` loop in \`${atImportNode.toString()}\``,
              );
              return
            }

            const atRuleStart = atImportNode.source.start.offset;
            const atRuleEnd = atImportNode.source.end.offset + 1; // for the ";"
            const atRuleRaw = atImportNode.source.input.css.slice(
              atRuleStart,
              atRuleEnd,
            );
            const specifierIndex = atRuleRaw.indexOf(atImportNode.params);
            const specifierStart = atRuleStart + specifierIndex;
            const specifierEnd = specifierStart + atImportNode.params.length;
            const specifierLine = atImportNode.source.start.line;
            const specifierColumn =
              atImportNode.source.start.column + specifierIndex;
            urlVisitor({
              declarationNode: atImportNode,
              type: "@import",
              atRuleStart,
              atRuleEnd,
              specifier,
              specifierLine,
              specifierColumn,
              specifierStart,
              specifierEnd,
              replace: (newUrlSpecifier) => {
                if (newUrlSpecifier === urlNode.value) {
                  return
                }
                urlNode.value = newUrlSpecifier;
                const newParams = parsed.toString();
                const newAtImportRule = new AtRule({
                  name: "import",
                  params: newParams,
                  source: atImportNode.source,
                });
                atImportNode.replaceWith(newAtImportRule);
              },
            });
          },
        },
        Declaration: (declarationNode) => {
          const parsed = parseCssValue(declarationNode.value);
          const urlMutations = [];
          walkUrls(parsed, {
            stringifyCssNodes,
            visitor: ({ url, urlNode }) => {
              // Empty URL
              if (!urlNode || url.length === 0) {
                declarationNode.warn(
                  result,
                  `Empty URL in \`${declarationNode.toString()}\``,
                );
                return
              }
              // Skip Data URI
              if (isDataUrl(url)) {
                return
              }
              const specifier = url;
              url = new URL(specifier, pathToFileURL(from));

              const declarationNodeStart = declarationNode.source.start.offset;
              const afterDeclarationNode =
                declarationNode.source.input.css.slice(declarationNodeStart);
              const valueIndex = afterDeclarationNode.indexOf(
                declarationNode.value,
              );
              const valueStart = declarationNodeStart + valueIndex;
              const specifierStart = valueStart + urlNode.sourceIndex;
              const specifierEnd =
                specifierStart +
                (urlNode.type === "word"
                  ? urlNode.value.length
                  : urlNode.value.length + 2); // the quotes
              // value raw
              // declarationNode.source.input.css.slice(valueStart)
              // specifier raw
              // declarationNode.source.input.css.slice(specifierStart, specifierEnd)
              const specifierLine = declarationNode.source.start.line;
              const specifierColumn =
                declarationNode.source.start.column +
                (specifierStart - declarationNodeStart);

              urlVisitor({
                declarationNode,
                type: "url",
                specifier,
                specifierLine,
                specifierColumn,
                specifierStart,
                specifierEnd,
                replace: (newUrlSpecifier) => {
                  urlMutations.push(() => {
                    // the specifier desires to be inside double quotes
                    if (newUrlSpecifier[0] === `"`) {
                      urlNode.type = "word";
                      urlNode.value = newUrlSpecifier;
                      return
                    }
                    // the specifier desires to be inside simple quotes
                    if (newUrlSpecifier[0] === `'`) {
                      urlNode.type = "word";
                      urlNode.value = newUrlSpecifier;
                      return
                    }
                    // the specifier desired to be just a word
                    // for the "word" type so that newUrlSpecifier can opt-out of being between quotes
                    // useful to inject __v__ calls for css inside js
                    urlNode.type = "word";
                    urlNode.value = newUrlSpecifier;
                  });
                },
              });
            },
          });
          if (urlMutations.length) {
            mutations.push(() => {
              urlMutations.forEach((urlMutation) => {
                urlMutation();
              });
              declarationNode.value = parsed.toString();
            });
          }
        },
        OnceExit: () => {
          mutations.forEach((mutation) => {
            mutation();
          });
        },
      }
    },
  }
};
postCssPluginUrlVisitor.postcss = true;

const walkUrls = (parsed, { stringifyCssNodes, visitor }) => {
  parsed.walk((node) => {
    // https://github.com/andyjansson/postcss-functions
    if (isUrlFunctionNode(node)) {
      const { nodes } = node;
      const [urlNode] = nodes;
      const url =
        urlNode && urlNode.type === "string"
          ? urlNode.value
          : stringifyCssNodes(nodes);
      visitor({
        url: url.trim(),
        urlNode,
      });
      return
    }

    if (isImageSetFunctionNode(node)) {
      Array.from(node.nodes).forEach((childNode) => {
        if (childNode.type === "string") {
          visitor({
            url: childNode.value.trim(),
            urlNode: childNode,
          });
          return
        }

        if (isUrlFunctionNode(node)) {
          const { nodes } = childNode;
          const [urlNode] = nodes;
          const url =
            urlNode && urlNode.type === "string"
              ? urlNode.value
              : stringifyCssNodes(nodes);
          visitor({
            url: url.trim(),
            urlNode,
          });
          return
        }
      });
    }
  });
};

const isUrlFunctionNode = (node) => {
  return node.type === "function" && /^url$/i.test(node.value)
};

const isImageSetFunctionNode = (node) => {
  return (
    node.type === "function" && /^(?:-webkit-)?image-set$/i.test(node.value)
  )
};

const isDataUrl = (url) => {
  return /data:[^\n\r;]+?(?:;charset=[^\n\r;]+?)?;base64,([\d+/A-Za-z]+={0,2})/.test(
    url,
  )
};

const createJsParseError = ({
  message,
  reasonCode,
  url,
  line,
  column,
}) => {
  const parseError = new Error(message);
  parseError.reasonCode = reasonCode;
  parseError.code = "PARSE_ERROR";
  parseError.url = url;
  parseError.line = line;
  parseError.column = column;
  return parseError
};

/*
 * Useful when writin a babel plugin:
 * - https://astexplorer.net/
 * - https://bvaughn.github.io/babel-repl
 */

const applyBabelPlugins = async ({
  babelPlugins,
  urlInfo,
  ast,
  options = {},
}) => {
  const sourceType = {
    js_module: "module",
    js_classic: "classic",
    [urlInfo.type]: undefined,
  }[urlInfo.type];
  const url = urlInfo.originalUrl;
  const generatedUrl = urlInfo.generatedUrl;
  const content = urlInfo.content;

  if (babelPlugins.length === 0) {
    return { code: content }
  }
  const { transformAsync, transformFromAstAsync } = await import('@babel/core');
  const sourceFileName = url.startsWith("file:")
    ? fileURLToPath(url)
    : undefined;
  options = {
    ast: false,
    // https://babeljs.io/docs/en/options#source-map-options
    sourceMaps: true,
    sourceFileName,
    filename: generatedUrl
      ? generatedUrl.startsWith("file:")
        ? fileURLToPath(url)
        : undefined
      : sourceFileName,
    configFile: false,
    babelrc: false,
    highlightCode: false,
    // consider using startColumn and startLine for inline scripts?
    // see https://github.com/babel/babel/blob/3ee9db7afe741f4d2f7933c519d8e7672fccb08d/packages/babel-parser/src/options.js#L36-L39
    parserOpts: {
      sourceType,
      // allowAwaitOutsideFunction: true,
      plugins: [
        // "importMeta",
        // "topLevelAwait",
        "dynamicImport",
        "importAssertions",
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        ...(useTypeScriptExtension(url) ? ["typescript"] : []),
        ...(options.parserPlugins || []),
      ].filter(Boolean),
    },
    generatorOpts: {
      compact: false,
    },
    plugins: babelPlugins,
    ...options,
  };
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, content, options);
      return result
    }
    const result = await transformAsync(content, options);
    return result
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw createJsParseError({
        message: error.message,
        reasonCode: error.reasonCode,
        content,
        url,
        line: error.loc.line,
        column: error.loc.column,
      })
    }
    throw error
  }
};

const useTypeScriptExtension = (url) => {
  const { pathname } = new URL(url);
  return pathname.endsWith(".ts") || pathname.endsWith(".tsx")
};

// const pattern = [
//   "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
//   "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
// ].join("|")
// const ansiRegex = new RegExp(pattern, "g")

// https://github.com/babel/babel/tree/master/packages/babel-helper-module-imports
const injectImport = ({
  programPath,
  namespace,
  name,
  from,
  nameHint,
  sideEffect,
}) => {
  const {
    addNamespace,
    addDefault,
    addNamed,
    addSideEffect,
  } = require("@babel/helper-module-imports");
  if (namespace) {
    return addNamespace(programPath, from, {
      nameHint,
    })
  }
  if (name) {
    return addNamed(programPath, name, from)
  }
  if (sideEffect) {
    return addSideEffect(programPath, from)
  }
  return addDefault(programPath, from, {
    nameHint,
  })
};

let AcornParser;
let _getLineInfo;

const parseJsWithAcorn = async ({ js, url, isJsModule }) => {
  await initAcornParser();
  try {
    // https://github.com/acornjs/acorn/tree/master/acorn#interface
    const jsAst = AcornParser.parse(js, {
      locations: true,
      allowAwaitOutsideFunction: true,
      sourceType: isJsModule ? "module" : "script",
      ecmaVersion: 2022,
    });
    return jsAst
  } catch (e) {
    if (e && e.name === "SyntaxError") {
      const { line, column } = _getLineInfo(js, e.raisedAt);
      throw createJsParseError({
        message: e.message,
        url,
        line,
        column,
      })
    }
    throw e
  }
};

const initAcornParser = async () => {
  if (AcornParser) {
    return
  }
  const { Parser, getLineInfo } = await import('acorn');
  const { importAssertions } = await import('acorn-import-assertions');

  AcornParser = Parser.extend(importAssertions);
  _getLineInfo = getLineInfo;
};

// AST walker module for Mozilla Parser API compatible trees

// An ancestor walk keeps an array of ancestor nodes (including the
// current node) and passes them to the callback as third parameter
// (and also as state parameter when no other state is present).
function ancestor(node, visitors, baseVisitor, state, override) {
  var ancestors = [];
  if (!baseVisitor) { baseVisitor = base
  ; }(function c(node, st, override) {
    var type = override || node.type, found = visitors[type];
    var isNew = node !== ancestors[ancestors.length - 1];
    if (isNew) { ancestors.push(node); }
    baseVisitor[type](node, st, c);
    if (found) { found(node, st || ancestors, ancestors); }
    if (isNew) { ancestors.pop(); }
  })(node, state, override);
}

function skipThrough(node, st, c) { c(node, st); }
function ignore(_node, _st, _c) {}

// Node walkers.

var base = {};

base.Program = base.BlockStatement = base.StaticBlock = function (node, st, c) {
  for (var i = 0, list = node.body; i < list.length; i += 1)
    {
    var stmt = list[i];

    c(stmt, st, "Statement");
  }
};
base.Statement = skipThrough;
base.EmptyStatement = ignore;
base.ExpressionStatement = base.ParenthesizedExpression = base.ChainExpression =
  function (node, st, c) { return c(node.expression, st, "Expression"); };
base.IfStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Statement");
  if (node.alternate) { c(node.alternate, st, "Statement"); }
};
base.LabeledStatement = function (node, st, c) { return c(node.body, st, "Statement"); };
base.BreakStatement = base.ContinueStatement = ignore;
base.WithStatement = function (node, st, c) {
  c(node.object, st, "Expression");
  c(node.body, st, "Statement");
};
base.SwitchStatement = function (node, st, c) {
  c(node.discriminant, st, "Expression");
  for (var i$1 = 0, list$1 = node.cases; i$1 < list$1.length; i$1 += 1) {
    var cs = list$1[i$1];

    if (cs.test) { c(cs.test, st, "Expression"); }
    for (var i = 0, list = cs.consequent; i < list.length; i += 1)
      {
      var cons = list[i];

      c(cons, st, "Statement");
    }
  }
};
base.SwitchCase = function (node, st, c) {
  if (node.test) { c(node.test, st, "Expression"); }
  for (var i = 0, list = node.consequent; i < list.length; i += 1)
    {
    var cons = list[i];

    c(cons, st, "Statement");
  }
};
base.ReturnStatement = base.YieldExpression = base.AwaitExpression = function (node, st, c) {
  if (node.argument) { c(node.argument, st, "Expression"); }
};
base.ThrowStatement = base.SpreadElement =
  function (node, st, c) { return c(node.argument, st, "Expression"); };
base.TryStatement = function (node, st, c) {
  c(node.block, st, "Statement");
  if (node.handler) { c(node.handler, st); }
  if (node.finalizer) { c(node.finalizer, st, "Statement"); }
};
base.CatchClause = function (node, st, c) {
  if (node.param) { c(node.param, st, "Pattern"); }
  c(node.body, st, "Statement");
};
base.WhileStatement = base.DoWhileStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForStatement = function (node, st, c) {
  if (node.init) { c(node.init, st, "ForInit"); }
  if (node.test) { c(node.test, st, "Expression"); }
  if (node.update) { c(node.update, st, "Expression"); }
  c(node.body, st, "Statement");
};
base.ForInStatement = base.ForOfStatement = function (node, st, c) {
  c(node.left, st, "ForInit");
  c(node.right, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForInit = function (node, st, c) {
  if (node.type === "VariableDeclaration") { c(node, st); }
  else { c(node, st, "Expression"); }
};
base.DebuggerStatement = ignore;

base.FunctionDeclaration = function (node, st, c) { return c(node, st, "Function"); };
base.VariableDeclaration = function (node, st, c) {
  for (var i = 0, list = node.declarations; i < list.length; i += 1)
    {
    var decl = list[i];

    c(decl, st);
  }
};
base.VariableDeclarator = function (node, st, c) {
  c(node.id, st, "Pattern");
  if (node.init) { c(node.init, st, "Expression"); }
};

base.Function = function (node, st, c) {
  if (node.id) { c(node.id, st, "Pattern"); }
  for (var i = 0, list = node.params; i < list.length; i += 1)
    {
    var param = list[i];

    c(param, st, "Pattern");
  }
  c(node.body, st, node.expression ? "Expression" : "Statement");
};

base.Pattern = function (node, st, c) {
  if (node.type === "Identifier")
    { c(node, st, "VariablePattern"); }
  else if (node.type === "MemberExpression")
    { c(node, st, "MemberPattern"); }
  else
    { c(node, st); }
};
base.VariablePattern = ignore;
base.MemberPattern = skipThrough;
base.RestElement = function (node, st, c) { return c(node.argument, st, "Pattern"); };
base.ArrayPattern = function (node, st, c) {
  for (var i = 0, list = node.elements; i < list.length; i += 1) {
    var elt = list[i];

    if (elt) { c(elt, st, "Pattern"); }
  }
};
base.ObjectPattern = function (node, st, c) {
  for (var i = 0, list = node.properties; i < list.length; i += 1) {
    var prop = list[i];

    if (prop.type === "Property") {
      if (prop.computed) { c(prop.key, st, "Expression"); }
      c(prop.value, st, "Pattern");
    } else if (prop.type === "RestElement") {
      c(prop.argument, st, "Pattern");
    }
  }
};

base.Expression = skipThrough;
base.ThisExpression = base.Super = base.MetaProperty = ignore;
base.ArrayExpression = function (node, st, c) {
  for (var i = 0, list = node.elements; i < list.length; i += 1) {
    var elt = list[i];

    if (elt) { c(elt, st, "Expression"); }
  }
};
base.ObjectExpression = function (node, st, c) {
  for (var i = 0, list = node.properties; i < list.length; i += 1)
    {
    var prop = list[i];

    c(prop, st);
  }
};
base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
base.SequenceExpression = function (node, st, c) {
  for (var i = 0, list = node.expressions; i < list.length; i += 1)
    {
    var expr = list[i];

    c(expr, st, "Expression");
  }
};
base.TemplateLiteral = function (node, st, c) {
  for (var i = 0, list = node.quasis; i < list.length; i += 1)
    {
    var quasi = list[i];

    c(quasi, st);
  }

  for (var i$1 = 0, list$1 = node.expressions; i$1 < list$1.length; i$1 += 1)
    {
    var expr = list$1[i$1];

    c(expr, st, "Expression");
  }
};
base.TemplateElement = ignore;
base.UnaryExpression = base.UpdateExpression = function (node, st, c) {
  c(node.argument, st, "Expression");
};
base.BinaryExpression = base.LogicalExpression = function (node, st, c) {
  c(node.left, st, "Expression");
  c(node.right, st, "Expression");
};
base.AssignmentExpression = base.AssignmentPattern = function (node, st, c) {
  c(node.left, st, "Pattern");
  c(node.right, st, "Expression");
};
base.ConditionalExpression = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Expression");
  c(node.alternate, st, "Expression");
};
base.NewExpression = base.CallExpression = function (node, st, c) {
  c(node.callee, st, "Expression");
  if (node.arguments)
    { for (var i = 0, list = node.arguments; i < list.length; i += 1)
      {
        var arg = list[i];

        c(arg, st, "Expression");
      } }
};
base.MemberExpression = function (node, st, c) {
  c(node.object, st, "Expression");
  if (node.computed) { c(node.property, st, "Expression"); }
};
base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function (node, st, c) {
  if (node.declaration)
    { c(node.declaration, st, node.type === "ExportNamedDeclaration" || node.declaration.id ? "Statement" : "Expression"); }
  if (node.source) { c(node.source, st, "Expression"); }
};
base.ExportAllDeclaration = function (node, st, c) {
  if (node.exported)
    { c(node.exported, st); }
  c(node.source, st, "Expression");
};
base.ImportDeclaration = function (node, st, c) {
  for (var i = 0, list = node.specifiers; i < list.length; i += 1)
    {
    var spec = list[i];

    c(spec, st);
  }
  c(node.source, st, "Expression");
};
base.ImportExpression = function (node, st, c) {
  c(node.source, st, "Expression");
};
base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.PrivateIdentifier = base.Literal = ignore;

base.TaggedTemplateExpression = function (node, st, c) {
  c(node.tag, st, "Expression");
  c(node.quasi, st, "Expression");
};
base.ClassDeclaration = base.ClassExpression = function (node, st, c) { return c(node, st, "Class"); };
base.Class = function (node, st, c) {
  if (node.id) { c(node.id, st, "Pattern"); }
  if (node.superClass) { c(node.superClass, st, "Expression"); }
  c(node.body, st);
};
base.ClassBody = function (node, st, c) {
  for (var i = 0, list = node.body; i < list.length; i += 1)
    {
    var elt = list[i];

    c(elt, st);
  }
};
base.MethodDefinition = base.PropertyDefinition = base.Property = function (node, st, c) {
  if (node.computed) { c(node.key, st, "Expression"); }
  if (node.value) { c(node.value, st, "Expression"); }
};

const getTypePropertyNode = (node) => {
  if (node.type !== "ObjectExpression") {
    return null
  }
  const { properties } = node;
  return properties.find((property) => {
    return (
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === "type"
    )
  })
};

const isStringLiteralNode = (node) => {
  return node.type === "Literal" && typeof node.value === "string"
};

const analyzeImportDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  const assertionInfo = extractImportAssertionsInfo(node);
  onUrl({
    type: "js_import_export",
    subtype: "import_static",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
    expectedType: assertionInfo ? assertionInfo.assert.type : "js_module",
    ...assertionInfo,
  });
};
const analyzeImportExpression = (node, { onUrl }) => {
  const specifierNode = node.source;
  if (!isStringLiteralNode(specifierNode)) {
    return
  }
  const assertionInfo = extractImportAssertionsInfo(node);

  onUrl({
    type: "js_import_export",
    subtype: "import_dynamic",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
    expectedType: assertionInfo ? assertionInfo.assert.type : "js_module",
    ...assertionInfo,
  });
};
const analyzeExportNamedDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  if (!specifierNode) {
    // This export has no "source", so it's probably
    // a local variable or function, e.g.
    // export { varName }
    // export const constName = ...
    // export function funcName() {}
    return
  }
  onUrl({
    type: "js_import_export",
    subtype: "export_named",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
  });
};
const analyzeExportAllDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  onUrl({
    type: "js_import_export",
    subtype: "export_all",
    specifier: specifierNode.value,
    specifierStart: specifierNode.start,
    specifierEnd: specifierNode.end,
    specifierLine: specifierNode.loc.start.line,
    specifierColumn: specifierNode.loc.start.column,
  });
};

const extractImportAssertionsInfo = (node) => {
  if (node.type === "ImportDeclaration") {
    // static import
    const { assertions } = node;
    if (!assertions) {
      return null
    }
    if (assertions.length === 0) {
      return null
    }
    const typeAssertionNode = assertions.find(
      (assertion) => assertion.key.name === "type",
    );
    if (!typeAssertionNode) {
      return null
    }
    const typeNode = typeAssertionNode.value;
    if (!isStringLiteralNode(typeNode)) {
      return null
    }
    return {
      assertNode: typeAssertionNode,
      assert: {
        type: typeNode.value,
      },
    }
  }
  // dynamic import
  const args = node.arguments;
  if (!args) {
    // acorn keeps node.arguments undefined for dynamic import without a second argument
    return null
  }
  const firstArgNode = args[0];
  if (!firstArgNode) {
    return null
  }
  const { properties } = firstArgNode;
  const assertProperty = properties.find((property) => {
    return property.key.name === "assert"
  });
  if (!assertProperty) {
    return null
  }
  const assertValueNode = assertProperty.value;
  if (assertValueNode.type !== "ObjectExpression") {
    return null
  }
  const assertValueProperties = assertValueNode.properties;
  const typePropertyNode = assertValueProperties.find((property) => {
    return property.key.name === "type"
  });
  if (!typePropertyNode) {
    return null
  }
  const typePropertyValue = typePropertyNode.value;
  if (!isStringLiteralNode(typePropertyValue)) {
    return null
  }
  return {
    assertNode: firstArgNode,
    assert: {
      type: typePropertyValue.value,
    },
  }
};

const isNewUrlCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL"
  )
};
const analyzeNewUrlCall = (node, { isJsModule, onUrl }) => {
  if (node.arguments.length === 1) {
    const firstArgNode = node.arguments[0];
    const urlType = analyzeUrlNodeType(firstArgNode, { isJsModule });
    if (urlType === "StringLiteral") {
      const specifierNode = firstArgNode;
      onUrl({
        type: "js_url_specifier",
        subtype: "new_url_first_arg",
        specifier: specifierNode.value,
        specifierStart: specifierNode.start,
        specifierEnd: specifierNode.end,
        specifierLine: specifierNode.loc.start.line,
        specifierColumn: specifierNode.loc.start.column,
      });
    }
    return
  }
  if (node.arguments.length === 2) {
    const firstArgNode = node.arguments[0];
    const secondArgNode = node.arguments[1];
    const baseUrlType = analyzeUrlNodeType(secondArgNode, { isJsModule });
    if (baseUrlType) {
      // we can understand the second argument
      const urlType = analyzeUrlNodeType(firstArgNode, { isJsModule });
      if (urlType === "StringLiteral") {
        // we can understand the first argument
        const specifierNode = firstArgNode;
        onUrl({
          type: "js_url_specifier",
          subtype: "new_url_first_arg",
          specifier: specifierNode.value,
          specifierStart: specifierNode.start,
          specifierEnd: specifierNode.end,
          specifierLine: specifierNode.loc.start.line,
          specifierColumn: specifierNode.loc.start.column,
          baseUrlType,
          baseUrl:
            baseUrlType === "StringLiteral" ? secondArgNode.value : undefined,
        });
      }
      if (baseUrlType === "StringLiteral") {
        const specifierNode = secondArgNode;
        onUrl({
          type: "js_url_specifier",
          subtype: "new_url_second_arg",
          specifier: specifierNode.value,
          specifierStart: specifierNode.start,
          specifierEnd: specifierNode.end,
          specifierLine: specifierNode.loc.start.line,
          specifierColumn: specifierNode.loc.start.column,
        });
      }
    }
  }
};

const analyzeUrlNodeType = (secondArgNode, { isJsModule }) => {
  if (isStringLiteralNode(secondArgNode)) {
    return "StringLiteral"
  }
  if (isImportMetaUrl(secondArgNode)) {
    return "import.meta.url"
  }
  if (isWindowOrigin(secondArgNode)) {
    return "window.origin"
  }
  if (!isJsModule && isContextMetaUrlFromSystemJs(secondArgNode)) {
    return "context.meta.url"
  }
  if (!isJsModule && isDocumentCurrentScriptSrc(secondArgNode)) {
    return "document.currentScript.src"
  }
  return null
};

const isImportMetaUrl = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MetaProperty" &&
    node.property.type === "Identifier" &&
    node.property.name === "url"
  )
};

const isWindowOrigin = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "window" &&
    node.property.type === "Identifier" &&
    node.property.name === "origin"
  )
};

const isContextMetaUrlFromSystemJs = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MemberExpression" &&
    node.object.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.meta.url" (in the context of new URL())
    // will be assumed to be the equivalent to "import.meta.url"
    // node.object.object.name === "_context" &&
    node.object.property.type === "Identifier" &&
    node.object.property.name === "meta" &&
    node.property.type === "Identifier" &&
    node.property.name === "url"
  )
};

const isDocumentCurrentScriptSrc = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MemberExpression" &&
    node.object.object.type === "Identifier" &&
    node.object.object.name === "document" &&
    node.object.property.type === "Identifier" &&
    node.object.property.name === "currentScript" &&
    node.property.type === "Identifier" &&
    node.property.name === "src"
  )
};

const isNewWorkerCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "Worker"
  )
};
const analyzeNewWorkerCall = (node, { isJsModule, onUrl }) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    onUrl,
    referenceSubtype: "new_worker_first_arg",
    expectedSubtype: "worker",
  });
};

const isNewSharedWorkerCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "SharedWorker"
  )
};
const analyzeNewSharedWorkerCall = (node, { isJsModule, onUrl }) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    onUrl,
    referenceSubtype: "new_shared_worker_first_arg",
    expectedSubtype: "shared_worker",
  });
};

const isServiceWorkerRegisterCall = (node) => {
  if (node.type !== "CallExpression") {
    return false
  }
  const callee = node.callee;
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  ) {
    const parentObject = callee.object;
    if (parentObject.type === "MemberExpression") {
      const parentProperty = parentObject.property;
      if (
        parentProperty.type === "Identifier" &&
        parentProperty.name === "serviceWorker"
      ) {
        const grandParentObject = parentObject.object;
        if (grandParentObject.type === "MemberExpression") {
          // window.navigator.serviceWorker.register
          const grandParentProperty = grandParentObject.property;
          if (
            grandParentProperty.type === "Identifier" &&
            grandParentProperty.name === "navigator"
          ) {
            const ancestorObject = grandParentObject.object;
            if (
              ancestorObject.type === "Identifier" &&
              ancestorObject.name === "window"
            ) {
              return true
            }
          }
        }
        if (grandParentObject.type === "Identifier") {
          // navigator.serviceWorker.register
          if (grandParentObject.name === "navigator") {
            return true
          }
        }
      }
    }
  }
  return false
};
const analyzeServiceWorkerRegisterCall = (
  node,
  { isJsModule, onUrl },
) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    onUrl,
    referenceSubtype: "service_worker_register_first_arg",
    expectedSubtype: "service_worker",
  });
};

const analyzeWorkerCallArguments = (
  node,
  { isJsModule, onUrl, referenceSubtype, expectedSubtype },
) => {
  let expectedType = "js_classic";
  let typePropertyNode;
  const secondArgNode = node.arguments[1];
  if (secondArgNode) {
    typePropertyNode = getTypePropertyNode(secondArgNode);
    if (typePropertyNode) {
      const typePropertyValueNode = typePropertyNode.value;
      if (isStringLiteralNode(typePropertyValueNode)) {
        const typePropertyValue = typePropertyValueNode.value;
        if (typePropertyValue === "module") {
          expectedType = "js_module";
        }
      }
    }
  }

  const firstArgNode = node.arguments[0];
  if (isStringLiteralNode(firstArgNode)) {
    const specifierNode = firstArgNode;
    onUrl({
      type: "js_url_specifier",
      subtype: referenceSubtype,
      expectedType,
      expectedSubtype,
      typePropertyNode,
      specifier: specifierNode.value,
      specifierStart: specifierNode.start,
      specifierEnd: specifierNode.end,
      specifierLine: specifierNode.loc.start.line,
      specifierColumn: specifierNode.loc.start.column,
    });
    return
  }
  if (isNewUrlCall(firstArgNode)) {
    analyzeNewUrlCall(firstArgNode, {
      isJsModule,
      onUrl: (mention) => {
        Object.assign(mention, {
          expectedType,
          expectedSubtype,
          typePropertyNode,
        });
        onUrl(mention);
      },
    });
  }
};

const isImportScriptsCall = (node) => {
  const callee = node.callee;
  if (callee.type === "Identifier" && callee.name === "importScripts") {
    return true
  }
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "self" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "importScripts"
  )
};
const analyzeImportScriptCalls = (node, { onUrl }) => {
  node.arguments.forEach((arg) => {
    if (isStringLiteralNode(arg)) {
      const specifierNode = arg;
      onUrl({
        type: "js_url_specifier",
        subtype: "self_import_scripts_arg",
        expectedType: "js_classic",
        specifier: specifierNode.value,
        specifierStart: specifierNode.start,
        specifierEnd: specifierNode.end,
        specifierLine: specifierNode.loc.start.line,
        specifierColumn: specifierNode.loc.start.column,
      });
    }
  });
};

const isSystemRegisterCall = (node) => {
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "System" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  )
};
const analyzeSystemRegisterCall = (node, { onUrl }) => {
  const firstArgNode = node.arguments[0];
  if (firstArgNode.type === "ArrayExpression") {
    analyzeSystemRegisterDeps(firstArgNode, { onUrl });
    return
  }
  if (isStringLiteralNode(firstArgNode)) {
    const secondArgNode = node.arguments[1];
    if (secondArgNode.type === "ArrayExpression") {
      analyzeSystemRegisterDeps(secondArgNode, { onUrl });
      return
    }
  }
};
const analyzeSystemRegisterDeps = (node, { onUrl }) => {
  const elements = node.elements;
  elements.forEach((element) => {
    if (isStringLiteralNode(element)) {
      const specifierNode = element;
      onUrl({
        type: "js_url_specifier",
        subtype: "system_register_arg",
        expectedType: "js_classic",
        specifier: specifierNode.value,
        specifierStart: specifierNode.start,
        specifierEnd: specifierNode.end,
        specifierLine: specifierNode.loc.start.line,
        specifierColumn: specifierNode.loc.start.column,
      });
    }
  });
};

const isSystemImportCall = (node) => {
  const callee = node.callee;
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.import()"
    // will be assumed to be the equivalent to "import()"
    // callee.object.name === "_context" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "import"
  )
};
const analyzeSystemImportCall = (node, { onUrl }) => {
  const firstArgNode = node.arguments[0];
  if (isStringLiteralNode(firstArgNode)) {
    const specifierNode = firstArgNode;
    onUrl({
      type: "js_url_specifier",
      subtype: "system_import_arg",
      expectedType: "js_classic",
      specifier: specifierNode.value,
      specifierStart: specifierNode.start,
      specifierEnd: specifierNode.end,
      specifierLine: specifierNode.loc.start.line,
      specifierColumn: specifierNode.loc.start.column,
    });
  }
};

const parseJsUrls = async ({
  js,
  url,
  isJsModule = false,
  isWebWorker = false,
} = {}) => {
  const jsUrls = [];
  const jsAst = await parseJsWithAcorn({
    js,
    url,
    isJsModule,
  });
  const onUrl = (jsUrl) => {
    jsUrls.push(jsUrl);
  };
  ancestor(jsAst, {
    ImportDeclaration: (node) => {
      analyzeImportDeclaration(node, { onUrl });
    },
    ImportExpression: (node) => {
      analyzeImportExpression(node, { onUrl });
    },
    ExportNamedDeclaration: (node) => {
      analyzeExportNamedDeclaration(node, { onUrl });
    },
    ExportAllDeclaration: (node) => {
      analyzeExportAllDeclaration(node, { onUrl });
    },
    CallExpression: (node) => {
      if (isServiceWorkerRegisterCall(node)) {
        analyzeServiceWorkerRegisterCall(node, {
          isJsModule,
          onUrl,
        });
        return
      }
      if (isWebWorker && isImportScriptsCall(node)) {
        analyzeImportScriptCalls(node, {
          onUrl,
        });
        return
      }
      if (!isJsModule && isSystemRegisterCall(node)) {
        analyzeSystemRegisterCall(node, {
          onUrl,
        });
        return
      }
      if (!isJsModule && isSystemImportCall(node)) {
        analyzeSystemImportCall(node, {
          onUrl,
        });
        return
      }
    },
    NewExpression: (node, ancestors) => {
      if (isNewWorkerCall(node)) {
        analyzeNewWorkerCall(node, {
          isJsModule,
          onUrl,
        });
        return
      }
      if (isNewSharedWorkerCall(node)) {
        analyzeNewSharedWorkerCall(node, {
          isJsModule,
          onUrl,
        });
        return
      }
      if (isNewUrlCall(node)) {
        const parent = ancestors[ancestors.length - 2];
        if (
          parent &&
          (isNewWorkerCall(parent) ||
            isNewSharedWorkerCall(parent) ||
            isServiceWorkerRegisterCall(parent))
        ) {
          return
        }
        analyzeNewUrlCall(node, {
          isJsModule,
          onUrl,
        });
        return
      }
    },
  });
  return jsUrls
};

export { analyzeLinkNode, analyzeScriptNode, applyBabelPlugins, applyPostCss, createHtmlNode, findHtmlNode, getHtmlNodeAttribute, getHtmlNodeAttributePosition, getHtmlNodePosition, getHtmlNodeText, injectImport, injectScriptNodeAsEarlyAsPossible, inlineImgNode, inlineLinkStylesheetNode, inlineScriptNode, minifyWithParcel, parseHtmlString, parseJsUrls, parseJsWithAcorn, parseSrcSet, parseSvgString, postCssPluginUrlVisitor, removeHtmlNode, removeHtmlNodeText, setHtmlNodeAttributes, setHtmlNodeText, stringifyHtmlAst, stringifySrcSet, stringifySvgAst, transpileWithParcel, visitHtmlNodes };
