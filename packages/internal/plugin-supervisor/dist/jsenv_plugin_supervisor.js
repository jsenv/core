import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyBabelPlugins, parseHtml, visitHtmlNodes, analyzeScriptNode, getHtmlNodeAttribute, getHtmlNodeText, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, stringifyHtmlAst, getHtmlNodePosition, getUrlForContentInsideHtml, setHtmlNodeText, setHtmlNodeAttributes } from "@jsenv/ast";

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const intToChar = new Uint8Array(64); // 64 possible chars.
const charToInt = new Uint8Array(128); // z is 122 in ASCII
for (let i = 0; i < chars.length; i++) {
  const c = chars.charCodeAt(i);
  intToChar[i] = c;
  charToInt[c] = i;
}

const require = createRequire(import.meta.url);
// consider using https://github.com/7rulnik/source-map-js

const requireSourcemap = () => {
  const namespace = require("source-map-js");
  return namespace;
};

/*
 * https://github.com/mozilla/source-map#sourcemapgenerator
 */

requireSourcemap();

// https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
const getOriginalPosition = ({
  sourcemap,
  line,
  column,
  bias
}) => {
  const {
    SourceMapConsumer
  } = requireSourcemap();
  const sourceMapConsumer = new SourceMapConsumer(sourcemap);
  const originalPosition = sourceMapConsumer.originalPositionFor({
    line,
    column,
    bias
  });
  return originalPosition;
};

const formatDefault = v => v;
const inspectFileContent = ({
  content,
  line,
  column,
  linesAbove = 3,
  linesBelow = 0,
  lineMaxWidth = 120,
  lineNumbersOnTheLeft = true,
  lineMarker = true,
  columnMarker = true,
  format = formatDefault
} = {}) => {
  const lineStrings = content.split(/\r?\n/);
  if (line === 0) line = 1;
  if (column === undefined) {
    columnMarker = false;
    column = 1;
  }
  if (column === 0) column = 1;
  let lineStartIndex = line - 1 - linesAbove;
  if (lineStartIndex < 0) {
    lineStartIndex = 0;
  }
  let lineEndIndex = line - 1 + linesBelow;
  if (lineEndIndex > lineStrings.length - 1) {
    lineEndIndex = lineStrings.length - 1;
  }
  if (columnMarker) {
    // human reader deduce the line when there is a column marker
    lineMarker = false;
  }
  if (line - 1 === lineEndIndex) {
    lineMarker = false; // useless because last line
  }

  let lineIndex = lineStartIndex;
  let columnsBefore;
  let columnsAfter;
  if (column > lineMaxWidth) {
    columnsBefore = column - Math.ceil(lineMaxWidth / 2);
    columnsAfter = column + Math.floor(lineMaxWidth / 2);
  } else {
    columnsBefore = 0;
    columnsAfter = lineMaxWidth;
  }
  let columnMarkerIndex = column - 1 - columnsBefore;
  let source = "";
  while (lineIndex <= lineEndIndex) {
    const lineString = lineStrings[lineIndex];
    const lineNumber = lineIndex + 1;
    const isLastLine = lineIndex === lineEndIndex;
    const isMainLine = lineNumber === line;
    lineIndex++;
    {
      if (lineMarker) {
        if (isMainLine) {
          source += "".concat(format(">", "marker_line"), " ");
        } else {
          source += "  ";
        }
      }
      if (lineNumbersOnTheLeft) {
        // fill with spaces to ensure if line moves from 7,8,9 to 10 the display is still great
        const asideSource = "".concat(fillLeft(lineNumber, lineEndIndex + 1), " |");
        source += "".concat(format(asideSource, "line_number_aside"), " ");
      }
    }
    {
      source += truncateLine(lineString, {
        start: columnsBefore,
        end: columnsAfter,
        prefix: "…",
        suffix: "…",
        format
      });
    }
    {
      if (columnMarker && isMainLine) {
        source += "\n";
        if (lineMarker) {
          source += "  ";
        }
        if (lineNumbersOnTheLeft) {
          const asideSpaces = "".concat(fillLeft(lineNumber, lineEndIndex + 1), " | ").length;
          source += " ".repeat(asideSpaces);
        }
        source += " ".repeat(columnMarkerIndex);
        source += format("^", "marker_column");
      }
    }
    if (!isLastLine) {
      source += "\n";
    }
  }
  return source;
};
const truncateLine = (line, {
  start,
  end,
  prefix,
  suffix,
  format
}) => {
  const lastIndex = line.length;
  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }
  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;
  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;
  if (start >= lastIndex || from === to) {
    return "";
  }
  let result = "";
  while (from < to) {
    result += format(line[from], "char");
    from++;
  }
  if (result.length === 0) {
    return "";
  }
  if (startTruncated && endTruncated) {
    return "".concat(format(prefix, "marker_overflow_left")).concat(result).concat(format(suffix, "marker_overflow_right"));
  }
  if (startTruncated) {
    return "".concat(format(prefix, "marker_overflow_left")).concat(result);
  }
  if (endTruncated) {
    return "".concat(result).concat(format(suffix, "marker_overflow_right"));
  }
  return result;
};
const fillLeft = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += value;
  return padded;
};

const getCommonPathname = (pathname, otherPathname) => {
  if (pathname === otherPathname) {
    return pathname;
  }
  let commonPart = "";
  let commonPathname = "";
  let i = 0;
  const length = pathname.length;
  const otherLength = otherPathname.length;
  while (i < length) {
    const char = pathname.charAt(i);
    const otherChar = otherPathname.charAt(i);
    i++;
    if (char === otherChar) {
      if (char === "/") {
        commonPart += "/";
        commonPathname += commonPart;
        commonPart = "";
      } else {
        commonPart += char;
      }
    } else {
      if (char === "/" && i - 1 === otherLength) {
        commonPart += "/";
        commonPathname += commonPart;
      }
      return commonPathname;
    }
  }
  if (length === otherLength) {
    commonPathname += commonPart;
  } else if (otherPathname.charAt(i) === "/") {
    commonPathname += commonPart;
  }
  return commonPathname;
};

const urlToRelativeUrl = (url, baseUrl) => {
  const urlObject = new URL(url);
  const baseUrlObject = new URL(baseUrl);
  if (urlObject.protocol !== baseUrlObject.protocol) {
    const urlAsString = String(url);
    return urlAsString;
  }
  if (urlObject.username !== baseUrlObject.username || urlObject.password !== baseUrlObject.password || urlObject.host !== baseUrlObject.host) {
    const afterUrlScheme = String(url).slice(urlObject.protocol.length);
    return afterUrlScheme;
  }
  const {
    pathname,
    hash,
    search
  } = urlObject;
  if (pathname === "/") {
    const baseUrlResourceWithoutLeadingSlash = baseUrlObject.pathname.slice(1);
    return baseUrlResourceWithoutLeadingSlash;
  }
  const basePathname = baseUrlObject.pathname;
  const commonPathname = getCommonPathname(pathname, basePathname);
  if (!commonPathname) {
    const urlAsString = String(url);
    return urlAsString;
  }
  const specificPathname = pathname.slice(commonPathname.length);
  const baseSpecificPathname = basePathname.slice(commonPathname.length);
  if (baseSpecificPathname.includes("/")) {
    const baseSpecificParentPathname = pathnameToParentPathname(baseSpecificPathname);
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(/.*?\//g, "../");
    const relativeUrl = "".concat(relativeDirectoriesNotation).concat(specificPathname).concat(search).concat(hash);
    return relativeUrl;
  }
  const relativeUrl = "".concat(specificPathname).concat(search).concat(hash);
  return relativeUrl;
};
const pathnameToParentPathname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
};

const generateSourcemapDataUrl = sourcemap => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return "data:application/json;charset=utf-8;base64,".concat(asBase64);
};

const SOURCEMAP = {
  enabledOnContentType: contentType => {
    return ["text/javascript", "text/css"].includes(contentType);
  },
  readComment: ({
    contentType,
    content
  }) => {
    const read = {
      "text/javascript": parseJavaScriptSourcemapComment,
      "text/css": parseCssSourcemapComment
    }[contentType];
    return read ? read(content) : null;
  },
  removeComment: ({
    contentType,
    content
  }) => {
    return SOURCEMAP.writeComment({
      contentType,
      content,
      specifier: ""
    });
  },
  writeComment: ({
    contentType,
    content,
    specifier
  }) => {
    const write = {
      "text/javascript": setJavaScriptSourceMappingUrl,
      "text/css": setCssSourceMappingUrl
    }[contentType];
    return write ? write(content, specifier) : content;
  }
};
const parseJavaScriptSourcemapComment = javaScriptSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, value => {
    sourceMappingUrl = value;
  });
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "js",
    // we assume it's on last line
    line: javaScriptSource.split(/\r?\n/).length,
    // ${"//#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: "//#".concat(" sourceMappingURL=").length + 1,
    specifier: sourceMappingUrl
  };
};
const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl) : "";
  });
  if (replaced) {
    return sourceAfterReplace;
  }
  return sourceMappingFileUrl ? "".concat(javaScriptSource, "\n").concat(writeJavaScriptSourceMappingURL(sourceMappingFileUrl), "\n") : javaScriptSource;
};
const parseCssSourcemapComment = cssSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, value => {
    sourceMappingUrl = value;
  });
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "css",
    // we assume it's on last line
    line: cssSource.split(/\r?\n/).length - 1,
    // ${"//*#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: "//*#".concat(" sourceMappingURL=").length + 1,
    specifier: sourceMappingUrl
  };
};
const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeCssSourceMappingUrl(sourceMappingFileUrl) : "";
  });
  if (replaced) {
    return sourceAfterReplace;
  }
  return sourceMappingFileUrl ? "".concat(cssSource, "\n").concat(writeCssSourceMappingUrl(sourceMappingFileUrl), "\n") : cssSource;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g;

// ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
const writeJavaScriptSourceMappingURL = value => {
  return "//#".concat(" sourceMappingURL=", value);
};
const writeCssSourceMappingUrl = value => {
  return "/*# sourceMappingURL=".concat(value, " */");
};
const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;
  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return "".concat(before).concat(mappedAfter);
  }
  return source;
};

/*
 * ```js
 * console.log(42)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsClassicStart('main.html@L10-L13.js')
 * try {
 *   console.log(42)
 *   window.__supervisor__.jsClassicEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsClassicError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * ```js
 * import value from "./file.js"
 * console.log(value)
 * ```
 * becomes
 * ```js
 * window.__supervisor__.jsModuleStart('main.html@L10-L13.js')
 * try {
 *   const value = await import("./file.js")
 *   console.log(value)
 *   window.__supervisor__.jsModuleEnd('main.html@L10-L13.js')
 * } catch(e) {
 *   window.__supervisor__.jsModuleError('main.html@L10-L13.js', e)
 * }
 * ```
 *
 * -> TO KEEP IN MIND:
 * Static import can throw errors like
 * The requested module '/js_module_export_not_found/foo.js' does not provide an export named 'answerr'
 * While dynamic import will work just fine
 * and create a variable named "undefined"
 */

const injectSupervisorIntoJs = async ({
  content,
  url,
  type,
  inlineSrc,
  sourcemaps
}) => {
  const babelPluginJsSupervisor = type === "js_module" ? babelPluginJsModuleSupervisor : babelPluginJsClassicSupervisor;
  const result = await applyBabelPlugins({
    babelPlugins: [[babelPluginJsSupervisor, {
      inlineSrc
    }]],
    input: content,
    inputIsJsModule: type === "js_module",
    inputUrl: url
  });
  let code = result.code;
  if (sourcemaps === "inline") {
    const map = result.map;
    const sourcemapDataUrl = generateSourcemapDataUrl(map);
    code = SOURCEMAP.writeComment({
      contentType: "text/javascript",
      content: code,
      specifier: sourcemapDataUrl
    });
  }
  code = "".concat(code, "\n//# sourceURL=").concat(inlineSrc);
  return code;
};
const babelPluginJsModuleSupervisor = babel => {
  const t = babel.types;
  return {
    name: "js-module-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const {
          inlineSrc
        } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;
        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleStart"
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleEnd"
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleError",
          args: [t.identifier("e")]
        });
        const bodyPath = programPath.get("body");
        const importNodes = [];
        const topLevelNodes = [];
        for (const topLevelNodePath of bodyPath) {
          const topLevelNode = topLevelNodePath.node;
          if (t.isImportDeclaration(topLevelNode)) {
            importNodes.push(topLevelNode);
          } else {
            topLevelNodes.push(topLevelNode);
          }
        }

        // replace all import nodes with dynamic imports
        const dynamicImports = [];
        importNodes.forEach(importNode => {
          const dynamicImportConversion = convertStaticImportIntoDynamicImport(importNode, t);
          if (Array.isArray(dynamicImportConversion)) {
            dynamicImports.push(...dynamicImportConversion);
          } else {
            dynamicImports.push(dynamicImportConversion);
          }
        });
        const tryCatchNode = t.tryStatement(t.blockStatement([...dynamicImports, ...topLevelNodes, endCallNode]), t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])));
        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      }
    }
  };
};
const convertStaticImportIntoDynamicImport = (staticImportNode, t) => {
  const awaitExpression = t.awaitExpression(t.callExpression(t.import(), [t.stringLiteral(staticImportNode.source.value)]));

  // import "./file.js" -> await import("./file.js")
  if (staticImportNode.specifiers.length === 0) {
    return t.expressionStatement(awaitExpression);
  }
  if (staticImportNode.specifiers.length === 1) {
    const [firstSpecifier] = staticImportNode.specifiers;
    if (firstSpecifier.type === "ImportNamespaceSpecifier") {
      return t.variableDeclaration("const", [t.variableDeclarator(t.identifier(firstSpecifier.local.name), awaitExpression)]);
    }
  }
  if (staticImportNode.specifiers.length === 2) {
    const [first, second] = staticImportNode.specifiers;
    if (first.type === "ImportDefaultSpecifier" && second.type === "ImportNamespaceSpecifier") {
      const namespaceDeclaration = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(second.local.name), awaitExpression)]);
      const defaultDeclaration = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(first.local.name), t.memberExpression(t.identifier(second.local.name), t.identifier("default")))]);
      return [namespaceDeclaration, defaultDeclaration];
    }
  }

  // import { name } from "./file.js" -> const { name } = await import("./file.js")
  // import toto, { name } from "./file.js" -> const { name, default as toto } = await import("./file.js")
  const objectPattern = t.objectPattern(staticImportNode.specifiers.map(specifier => {
    if (specifier.type === "ImportDefaultSpecifier") {
      return t.objectProperty(t.identifier("default"), t.identifier(specifier.local.name), false,
      // computed
      false // shorthand
      );
    }
    // if (specifier.type === "ImportNamespaceSpecifier") {
    //   return t.restElement(t.identifier(specifier.local.name))
    // }
    const isRenamed = specifier.imported.name !== specifier.local.name;
    if (isRenamed) {
      return t.objectProperty(t.identifier(specifier.imported.name), t.identifier(specifier.local.name), false,
      // computed
      false // shorthand
      );
    }
    // shorthand must be true
    return t.objectProperty(t.identifier(specifier.local.name), t.identifier(specifier.local.name), false,
    // computed
    true // shorthand
    );
  }));

  const variableDeclarator = t.variableDeclarator(objectPattern, awaitExpression);
  const variableDeclaration = t.variableDeclaration("const", [variableDeclarator]);
  return variableDeclaration;
};
const babelPluginJsClassicSupervisor = babel => {
  const t = babel.types;
  return {
    name: "js-classic-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const {
          inlineSrc
        } = state.opts;
        if (state.file.metadata.jsExecutionInstrumented) return;
        state.file.metadata.jsExecutionInstrumented = true;
        const urlNode = t.stringLiteral(inlineSrc);
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicStart"
        });
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicEnd"
        });
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicError",
          args: [t.identifier("e")]
        });
        const topLevelNodes = programPath.node.body;
        const tryCatchNode = t.tryStatement(t.blockStatement([...topLevelNodes, endCallNode]), t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])));
        programPath.replaceWith(t.program([startCallNode, tryCatchNode]));
      }
    }
  };
};
const createSupervisionCall = ({
  t,
  methodName,
  urlNode,
  args = []
}) => {
  return t.expressionStatement(t.callExpression(t.memberExpression(t.memberExpression(t.identifier("window"), t.identifier("__supervisor__")), t.identifier(methodName)), [urlNode, ...args]), [], null);
};

/*
 * Jsenv needs to track js execution in order to:
 * 1. report errors
 * 2. wait for all js execution inside an HTML page before killing the browser
 *
 * A naive approach would rely on "load" events on window but:
 * scenario                                    | covered by window "load"
 * ------------------------------------------- | -------------------------
 * js referenced by <script src>               | yes
 * js inlined into <script>                    | yes
 * js referenced by <script type="module" src> | partially (not for import and top level await)
 * js inlined into <script type="module">      | not at all
 * Same for "error" event on window who is not enough
 *
 * <script src="file.js">
 * becomes
 * <script>
 *   window.__supervisor__.superviseScript('file.js')
 * </script>
 *
 * <script>
 *    console.log(42)
 * </script>
 * becomes
 * <script inlined-from-src="main.html@L10-C5.js">
 *   window.__supervisor.__superviseScript("main.html@L10-C5.js")
 * </script>
 *
 * <script type="module" src="module.js"></script>
 * becomes
 * <script type="module">
 *   window.__supervisor__.superviseScriptTypeModule('module.js')
 * </script>
 *
 * <script type="module">
 *   console.log(42)
 * </script>
 * becomes
 * <script type="module" inlined-from-src="main.html@L10-C5.js">
 *   window.__supervisor__.superviseScriptTypeModule('main.html@L10-C5.js')
 * </script>
 *
 * Why Inline scripts are converted to files dynamically?
 * -> No changes required on js source code, it's only the HTML that is modified
 *   - Also allow to catch syntax errors and export missing
 */

const supervisorFileUrl = new URL("./js/supervisor.js", import.meta.url).href;
const injectSupervisorIntoHTML = async ({
  content,
  url
}, {
  supervisorScriptSrc = supervisorFileUrl,
  supervisorOptions,
  webServer,
  onInlineScript = () => {},
  generateInlineScriptSrc = ({
    inlineScriptUrl
  }) => urlToRelativeUrl(inlineScriptUrl, webServer.rootDirectoryUrl),
  inlineAsRemote,
  sourcemaps = "inline"
}) => {
  const htmlAst = parseHtml({
    html: content,
    url
  });
  const mutations = [];
  const actions = [];
  const scriptInfos = [];
  // 1. Find inline and remote scripts
  {
    const handleInlineScript = (scriptNode, {
      type,
      textContent
    }) => {
      const {
        line,
        column,
        isOriginal
      } = getHtmlNodePosition(scriptNode, {
        preferOriginal: true
      });
      const inlineScriptUrl = getUrlForContentInsideHtml(scriptNode, {
        htmlUrl: url
      });
      const inlineScriptSrc = generateInlineScriptSrc({
        type,
        textContent,
        inlineScriptUrl,
        isOriginal,
        line,
        column
      });
      onInlineScript({
        type,
        textContent,
        url: inlineScriptUrl,
        isOriginal,
        line,
        column,
        src: inlineScriptSrc
      });
      if (inlineAsRemote) {
        // prefere la version src
        scriptInfos.push({
          type,
          src: inlineScriptSrc
        });
        const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
          type,
          src: inlineScriptSrc
        });
        mutations.push(() => {
          setHtmlNodeText(scriptNode, remoteJsSupervised, {
            indentation: "auto"
          });
          setHtmlNodeAttributes(scriptNode, {
            "jsenv-cooked-by": "jsenv:supervisor",
            "src": undefined,
            "inlined-from-src": inlineScriptSrc
          });
        });
      } else {
        scriptInfos.push({
          type,
          src: inlineScriptSrc,
          isInline: true
        });
        actions.push(async () => {
          try {
            const inlineJsSupervised = await injectSupervisorIntoJs({
              webServer,
              content: textContent,
              url: inlineScriptUrl,
              type,
              inlineSrc: inlineScriptSrc,
              sourcemaps
            });
            mutations.push(() => {
              setHtmlNodeText(scriptNode, inlineJsSupervised, {
                indentation: "auto"
              });
              setHtmlNodeAttributes(scriptNode, {
                "jsenv-cooked-by": "jsenv:supervisor"
              });
            });
          } catch (e) {
            if (e.code === "PARSE_ERROR") {
              // mutations.push(() => {
              //   setHtmlNodeAttributes(scriptNode, {
              //     "jsenv-cooked-by": "jsenv:supervisor",
              //   })
              // })
              // on touche a rien
              return;
            }
            throw e;
          }
        });
      }
    };
    const handleScriptWithSrc = (scriptNode, {
      type,
      src
    }) => {
      scriptInfos.push({
        type,
        src
      });
      const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
        type,
        src
      });
      mutations.push(() => {
        setHtmlNodeText(scriptNode, remoteJsSupervised, {
          indentation: "auto"
        });
        setHtmlNodeAttributes(scriptNode, {
          "jsenv-cooked-by": "jsenv:supervisor",
          "src": undefined,
          "inlined-from-src": src
        });
      });
    };
    visitHtmlNodes(htmlAst, {
      script: scriptNode => {
        const {
          type
        } = analyzeScriptNode(scriptNode);
        if (type !== "js_classic" && type !== "js_module") {
          return;
        }
        if (getHtmlNodeAttribute(scriptNode, "jsenv-injected-by")) {
          return;
        }
        const noSupervisor = getHtmlNodeAttribute(scriptNode, "no-supervisor");
        if (noSupervisor !== undefined) {
          return;
        }
        const scriptNodeText = getHtmlNodeText(scriptNode);
        if (scriptNodeText) {
          handleInlineScript(scriptNode, {
            type,
            textContent: scriptNodeText
          });
          return;
        }
        const src = getHtmlNodeAttribute(scriptNode, "src");
        if (src) {
          const urlObject = new URL(src, "http://example.com/");
          if (urlObject.searchParams.has("inline")) {
            return;
          }
          handleScriptWithSrc(scriptNode, {
            type,
            src
          });
          return;
        }
      }
    });
  }
  // 2. Inject supervisor js file + setup call
  {
    const setupParamsSource = stringifyParams({
      ...supervisorOptions,
      serverIsJsenvDevServer: webServer.isJsenvDevServer,
      rootDirectoryUrl: webServer.rootDirectoryUrl,
      scriptInfos
    }, "  ");
    injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
      tagName: "script",
      textContent: "window.__supervisor__.setup({\n  ".concat(setupParamsSource, "\n});")
    }), "jsenv:supervisor");
    injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
      tagName: "script",
      src: supervisorScriptSrc
    }), "jsenv:supervisor");
  }
  // 3. Perform actions (transforming inline script content) and html mutations
  if (actions.length > 0) {
    await Promise.all(actions.map(action => action()));
  }
  mutations.forEach(mutation => mutation());
  const htmlModified = stringifyHtmlAst(htmlAst);
  return {
    content: htmlModified
  };
};
const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix);
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2);
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1);
};
const generateCodeToSuperviseScriptWithSrc = ({
  type,
  src
}) => {
  const srcEncoded = JSON.stringify(src);
  if (type === "js_module") {
    return "window.__supervisor__.superviseScriptTypeModule(".concat(srcEncoded, ", (url) => import(url));");
  }
  return "window.__supervisor__.superviseScript(".concat(srcEncoded, ");");
};

/*
 * This plugin provides a way for jsenv to supervisor js execution:
 * - Know how many js are executed, when they are done, collect errors, etc...
 */

const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl
}) => {
  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async serveInfo => {
      if (serveInfo.request.pathname.startsWith("/__get_cause_trace__/")) {
        const {
          pathname,
          searchParams
        } = new URL(serveInfo.request.url);
        let urlWithLineAndColumn = pathname.slice("/__get_cause_trace__/".length);
        urlWithLineAndColumn = decodeURIComponent(urlWithLineAndColumn);
        const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url"
          };
        }
        const file = urlWithLineAndColumn.slice(0, match.index);
        let line = parseInt(match[1]);
        let column = parseInt(match[2]);
        const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store"
            }
          };
        }
        const remap = searchParams.has("remap");
        if (remap) {
          const sourcemap = urlInfo.sourcemap;
          if (sourcemap) {
            const original = getOriginalPosition({
              sourcemap,
              url: file,
              line,
              column
            });
            if (original.line !== null) {
              line = original.line;
              if (original.column !== null) {
                column = original.column;
              }
            }
          }
        }
        const causeTrace = {
          url: file,
          line,
          column,
          codeFrame: inspectFileContent({
            line,
            column,
            content: urlInfo.originalContent
          })
        };
        const causeTraceJson = JSON.stringify(causeTrace, null, "  ");
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(causeTraceJson)
          },
          body: causeTraceJson
        };
      }
      if (serveInfo.request.pathname.startsWith("/__get_error_cause__/")) {
        let file = serveInfo.request.pathname.slice("/__get_error_cause__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const getErrorCauseInfo = () => {
          const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
          if (!urlInfo) {
            return null;
          }
          const {
            error
          } = urlInfo;
          if (error) {
            return error;
          }
          // search in direct dependencies (404 or 500)
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            const referencedUrlInfo = referenceToOther.urlInfo;
            if (referencedUrlInfo.error) {
              return referencedUrlInfo.error;
            }
          }
          return null;
        };
        const causeInfo = getErrorCauseInfo();
        const body = JSON.stringify(causeInfo ? {
          code: causeInfo.code,
          name: causeInfo.name,
          message: causeInfo.message,
          reason: causeInfo.reason,
          stack: errorBaseUrl ? "stack mocked for snapshot" : causeInfo.stack,
          trace: causeInfo.trace
        } : null, null, "  ");
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body)
          },
          body
        };
      }
      if (serveInfo.request.pathname.startsWith("/__open_in_editor__/")) {
        let file = serveInfo.request.pathname.slice("/__open_in_editor__/".length);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const fileUrl = new URL(file, serveInfo.rootDirectoryUrl);
        const filePath = fileURLToPath(fileUrl);
        const require = createRequire(import.meta.url);
        const launch = require("launch-editor");
        launch(filePath, () => {
          // ignore error for now
        });
        return {
          status: 200,
          headers: {
            "cache-control": "no-store"
          }
        };
      }
      return null;
    },
    transformUrlContent: {
      html: htmlUrlInfo => {
        const supervisorFileReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          expectedType: "js_classic",
          specifier: supervisorFileUrl
        });
        return injectSupervisorIntoHTML({
          content: htmlUrlInfo.content,
          url: htmlUrlInfo.url
        }, {
          supervisorScriptSrc: supervisorFileReference.generatedSpecifier,
          supervisorOptions: {
            errorBaseUrl,
            logs,
            measurePerf,
            errorOverlay,
            openInEditor
          },
          webServer: {
            rootDirectoryUrl: htmlUrlInfo.context.rootDirectoryUrl,
            isJsenvDevServer: true
          },
          inlineAsRemote: true,
          generateInlineScriptSrc: ({
            type,
            textContent,
            inlineScriptUrl,
            isOriginal,
            line,
            column
          }) => {
            const inlineScriptReference = htmlUrlInfo.dependencies.foundInline({
              type: "script",
              subtype: "inline",
              expectedType: type,
              isOriginalPosition: isOriginal,
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineScriptUrl,
              contentType: "text/javascript",
              content: textContent
            });
            return inlineScriptReference.generatedSpecifier;
          },
          sourcemaps: htmlUrlInfo.kitchen.context.sourcemaps
        });
      }
    }
  };
};

export { injectSupervisorIntoHTML, jsenvPluginSupervisor, supervisorFileUrl };
