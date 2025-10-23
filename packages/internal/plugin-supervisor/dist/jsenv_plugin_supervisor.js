import { applyBabelPlugins, parseHtml, visitHtmlNodes, analyzeScriptNode, getHtmlNodeAttribute, getHtmlNodeText, injectJsenvScript, stringifyHtmlAst, getHtmlNodePosition, getUrlForContentInsideHtml, setHtmlNodeText, setHtmlNodeAttributes } from "@jsenv/ast";
import { generateSourcemapDataUrl, SOURCEMAP, getOriginalPosition } from "@jsenv/sourcemap";

const formatDefault = v => v;
const generateContentFrame = ({
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

// normalize url search params:
// Using URLSearchParams to alter the url search params
// can result into "file:///file.css?css_module"
// becoming "file:///file.css?css_module="
// we want to get rid of the "=" and consider it's the same url
const normalizeUrl = url => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  let urlString = urlObject.href;
  if (!urlString.includes("?")) {
    return url;
  }
  // disable on data urls (would mess up base64 encoding)
  if (urlString.startsWith("data:")) {
    return url;
  }
  urlString = urlString.replace(/[=](?=&|$)/g, "");
  if (calledWithString) {
    return urlString;
  }
  urlObject.href = urlString;
  return urlObject;
};
const injectQueryParams = (url, params) => {
  const calledWithString = typeof url === "string";
  const urlObject = calledWithString ? new URL(url) : url;
  const {
    searchParams
  } = urlObject;
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined) {
      searchParams.delete(key);
    } else {
      searchParams.set(key, value);
    }
  }
  return normalizeUrl(calledWithString ? urlObject.href : urlObject);
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

const urlToRelativeUrl = (url, baseUrl, {
  preferRelativeNotation
} = {}) => {
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
  return preferRelativeNotation ? "./".concat(relativeUrl) : relativeUrl;
};
const pathnameToParentPathname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return "/";
  }
  return pathname.slice(0, slashLastIndex + 1);
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
        url
      }, null);
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
              // webServer,
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
          const urlObject = new URL(src, "http://example.com");
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
    injectJsenvScript(htmlAst, {
      src: supervisorScriptSrc,
      initCall: {
        callee: "window.__supervisor__.setup",
        params: {
          ...supervisorOptions,
          serverIsJsenvDevServer: webServer.isJsenvDevServer,
          rootDirectoryUrl: webServer.rootDirectoryUrl,
          scriptInfos
        }
      },
      pluginName: "jsenv:supervisor"
    });
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
 *
 */

const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl
}) => {
  const resolveUrlSite = urlWithLineAndColumn => {
    const inlineUrlMatch = urlWithLineAndColumn.match(/@L([0-9]+)C([0-9]+)-L([0-9]+)C([0-9]+)\.\w+(:([0-9]+):([0-9]+))?$/);
    if (inlineUrlMatch) {
      const htmlUrl = injectQueryParams(urlWithLineAndColumn.slice(0, inlineUrlMatch.index), {
        hot: undefined
      });
      const tagLineStart = parseInt(inlineUrlMatch[1]);
      const tagColumnStart = parseInt(inlineUrlMatch[2]);
      // const tagLineEnd = parseInt(inlineUrlMatch[3]);
      // const tagColumnEnd = parseInt(inlineUrlMatch[4]);
      const inlineLine = inlineUrlMatch[6] === undefined ? undefined : parseInt(inlineUrlMatch[6]);
      const inlineColumn = inlineUrlMatch[7] === undefined ? undefined : parseInt(inlineUrlMatch[7]);
      return {
        file: htmlUrl,
        ownerLine: tagLineStart,
        ownerColumn: tagColumnStart,
        inlineLine,
        inlineColumn,
        line: inlineLine === undefined ? tagLineStart : tagLineStart + inlineLine,
        column: inlineColumn === undefined ? tagColumnStart : inlineColumn
      };
    }
    const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
    if (!match) {
      return null;
    }
    const file = injectQueryParams(urlWithLineAndColumn.slice(0, match.index), {
      hot: undefined
    });
    let line = parseInt(match[1]);
    let column = parseInt(match[2]);
    return {
      file,
      line,
      column
    };
  };
  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    devServerRoutes: [{
      endpoint: "GET /.internal/get_cause_trace/*",
      description: "Return source code around the place an error was thrown.",
      declarationSource: import.meta.url,
      fetch: async (request, {
        kitchen
      }) => {
        const urlWithLineAndColumn = decodeURIComponent(request.params[0]);
        const result = resolveUrlSite(urlWithLineAndColumn);
        if (!result) {
          return {
            status: 400,
            body: "Missing line and column in url"
          };
        }
        let {
          file,
          line,
          column
        } = result;
        const urlInfo = kitchen.graph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store"
            }
          };
        }
        if (!urlInfo.originalContent) {
          await urlInfo.fetchContent();
        }
        const remap = request.searchParams.has("remap");
        if (remap) {
          const sourcemap = urlInfo.sourcemap;
          if (sourcemap) {
            const original = getOriginalPosition({
              sourcemap,
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
          codeFrame: generateContentFrame({
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
    }, {
      endpoint: "GET /.internal/get_error_cause/*",
      description: "Return the error that occured when a file was served by jsenv dev server or null.",
      declarationSource: import.meta.url,
      fetch: (request, {
        kitchen
      }) => {
        let file = decodeURIComponent(request.params[0]);
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url"
          };
        }
        const {
          url
        } = kitchen.resolve(file, kitchen.context.rootDirectoryUrl);
        file = url;
        const urlInfoVisitedSet = new Set();
        const getErrorCausingRuntimeError = urlInfo => {
          if (urlInfoVisitedSet.has(urlInfo)) {
            return null;
          }
          urlInfoVisitedSet.add(urlInfo);
          const {
            error
          } = urlInfo;
          if (error) {
            return error;
          }
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            const referencedUrlInfo = referenceToOther.urlInfo;
            const referencedCause = getErrorCausingRuntimeError(referencedUrlInfo);
            if (referencedCause) {
              return referencedCause;
            }
          }
          return null;
        };
        const urlInfo = kitchen.graph.getUrlInfo(file);
        const errorCausingRuntimeError = urlInfo ? getErrorCausingRuntimeError(urlInfo) : null;
        const body = JSON.stringify(errorCausingRuntimeError ? {
          code: errorCausingRuntimeError.code,
          name: errorCausingRuntimeError.name,
          message: errorCausingRuntimeError.message,
          reason: errorCausingRuntimeError.reason,
          parseErrorSourceType: errorCausingRuntimeError.parseErrorSourceType,
          stack: errorBaseUrl ? "stack mocked for snapshot" : errorCausingRuntimeError.stack,
          trace: errorCausingRuntimeError.trace,
          isJsenvCookingError: errorCausingRuntimeError.isJsenvCookingError
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
    }],
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
              specifierLine: line,
              specifierColumn: column,
              specifier: inlineScriptUrl,
              contentType: "text/javascript",
              content: textContent
            });
            const htmlContentInjections = htmlUrlInfo.contentInjections;
            const {
              isPlaceholderInjection,
              INJECTIONS
            } = htmlUrlInfo.context;
            for (const key of Object.keys(htmlContentInjections)) {
              const injection = htmlUrlInfo.contentInjections[key];
              if (isPlaceholderInjection(injection)) {
                inlineScriptReference.urlInfo.contentInjections[key] = injection;
                // ideally we should mark injection as optional only if it's
                // hapenning for inline content
                // but for now we'll just mark all html injections as optional
                // when there is an inline script
                htmlContentInjections[key] = INJECTIONS.optional(injection);
              }
            }
            return inlineScriptReference.generatedSpecifier;
          },
          sourcemaps: htmlUrlInfo.kitchen.context.sourcemaps
        });
      }
    }
  };
};

export { injectSupervisorIntoHTML, jsenvPluginSupervisor, supervisorFileUrl };
