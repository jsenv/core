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

import {
  parseHtml,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  analyzeScriptNode,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
  getHtmlNodePosition,
  getHtmlNodeText,
  setHtmlNodeText,
  getUrlForContentInsideHtml,
} from "@jsenv/ast";
import { urlToRelativeUrl } from "@jsenv/urls";

import { injectSupervisorIntoJs } from "./js_supervisor.js";

export const supervisorFileUrl = new URL(
  "./client/supervisor.js",
  import.meta.url,
).href;

export const injectSupervisorIntoHTML = async (
  { content, url },
  {
    supervisorScriptSrc = supervisorFileUrl,
    supervisorOptions,
    webServer,
    onInlineScript = () => {},
    generateInlineScriptSrc = ({ inlineScriptUrl }) =>
      urlToRelativeUrl(inlineScriptUrl, webServer.rootDirectoryUrl),
    inlineAsRemote,
    sourcemaps = "inline",
  },
) => {
  const htmlAst = parseHtml({ html: content, url });
  const mutations = [];
  const actions = [];

  const scriptInfos = [];
  // 1. Find inline and remote scripts
  {
    const handleInlineScript = (scriptNode, { type, textContent }) => {
      const { line, column, isOriginal } = getHtmlNodePosition(scriptNode, {
        preferOriginal: true,
      });
      const inlineScriptUrl = getUrlForContentInsideHtml(scriptNode, {
        htmlUrl: url,
      });
      const inlineScriptSrc = generateInlineScriptSrc({
        type,
        textContent,
        inlineScriptUrl,
        isOriginal,
        line,
        column,
      });
      onInlineScript({
        type,
        textContent,
        url: inlineScriptUrl,
        isOriginal,
        line,
        column,
        src: inlineScriptSrc,
      });
      if (inlineAsRemote) {
        // prefere la version src
        scriptInfos.push({ type, src: inlineScriptSrc });
        const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
          type,
          src: inlineScriptSrc,
        });
        mutations.push(() => {
          setHtmlNodeText(scriptNode, remoteJsSupervised, {
            indentation: "auto",
          });
          setHtmlNodeAttributes(scriptNode, {
            "jsenv-cooked-by": "jsenv:supervisor",
            "src": undefined,
            "inlined-from-src": inlineScriptSrc,
          });
        });
      } else {
        scriptInfos.push({
          type,
          src: inlineScriptSrc,
          isInline: true,
        });
        actions.push(async () => {
          try {
            const inlineJsSupervised = await injectSupervisorIntoJs({
              webServer,
              content: textContent,
              url: inlineScriptUrl,
              type,
              inlineSrc: inlineScriptSrc,
              sourcemaps,
            });
            mutations.push(() => {
              setHtmlNodeText(scriptNode, inlineJsSupervised, {
                indentation: "auto",
              });
              setHtmlNodeAttributes(scriptNode, {
                "jsenv-cooked-by": "jsenv:supervisor",
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
    const handleScriptWithSrc = (scriptNode, { type, src }) => {
      scriptInfos.push({ type, src });
      const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
        type,
        src,
      });
      mutations.push(() => {
        setHtmlNodeText(scriptNode, remoteJsSupervised, {
          indentation: "auto",
        });
        setHtmlNodeAttributes(scriptNode, {
          "jsenv-cooked-by": "jsenv:supervisor",
          "src": undefined,
          "inlined-from-src": src,
        });
      });
    };
    visitHtmlNodes(htmlAst, {
      script: (scriptNode) => {
        const { type } = analyzeScriptNode(scriptNode);
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
            textContent: scriptNodeText,
          });
          return;
        }
        const src = getHtmlNodeAttribute(scriptNode, "src");
        if (src) {
          const urlObject = new URL(src, "http://example.com");
          if (urlObject.searchParams.has("inline")) {
            return;
          }
          handleScriptWithSrc(scriptNode, { type, src });
          return;
        }
      },
    });
  }
  // 2. Inject supervisor js file + setup call
  {
    const setupParamsSource = stringifyParams(
      {
        ...supervisorOptions,
        serverIsJsenvDevServer: webServer.isJsenvDevServer,
        rootDirectoryUrl: webServer.rootDirectoryUrl,
        scriptInfos,
      },
      "  ",
    );
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        textContent: `window.__supervisor__.setup({${setupParamsSource}})`,
      }),
      "jsenv:supervisor",
    );
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        src: supervisorScriptSrc,
      }),
      "jsenv:supervisor",
    );
  }
  // 3. Perform actions (transforming inline script content) and html mutations
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  mutations.forEach((mutation) => mutation());
  const htmlModified = stringifyHtmlAst(htmlAst);
  return {
    content: htmlModified,
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

const generateCodeToSuperviseScriptWithSrc = ({ type, src }) => {
  const srcEncoded = JSON.stringify(src);
  if (type === "js_module") {
    return `window.__supervisor__.superviseScriptTypeModule(${srcEncoded}, (url) => import(url));`;
  }
  return `window.__supervisor__.superviseScript(${srcEncoded});`;
};
