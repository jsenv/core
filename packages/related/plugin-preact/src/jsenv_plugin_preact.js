/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import {
  applyBabelPlugins,
  injectJsenvScript,
  parseHtml,
  stringifyHtmlAst,
} from "@jsenv/ast";
import { createMagicSource } from "@jsenv/sourcemap";
import { URL_META } from "@jsenv/url-meta";

export const jsenvPluginPreact = ({
  jsxTranspilation = true,
  refreshInstrumentation = false,
  hookNamesInstrumentation = true,
  preactDevtools = true,
} = {}) => {
  if (jsxTranspilation === true) {
    jsxTranspilation = {
      "./**/*.jsx": true,
      "./**/*.tsx": true,
    };
  } else if (jsxTranspilation === false) {
    jsxTranspilation = {};
  }
  if (refreshInstrumentation === true) {
    refreshInstrumentation = {
      "./**/*.jsx": true,
      "./**/*.tsx": true,
    };
  } else if (refreshInstrumentation === false) {
    refreshInstrumentation = {};
  }
  if (hookNamesInstrumentation === true) {
    hookNamesInstrumentation = { "./**": true };
  } else {
    hookNamesInstrumentation = {};
  }
  const associations = URL_META.resolveAssociations(
    {
      jsxTranspilation,
      refreshInstrumentation,
      hookNamesInstrumentation,
    },
    "file://",
  );

  return {
    name: "jsenv:preact",
    appliesDuring: "*",
    resolveReference: {
      js_import: (reference) => {
        if (reference.specifier === "react") {
          reference.specifier = "preact/compat";
          return null;
        }
        if (reference.specifier.startsWith("react/")) {
          reference.specifier = `preact/compat/${reference.specifier.slice("react/".length)}`;
          return null;
        }
        if (reference.specifier === "react-dom") {
          reference.specifier = "preact/compat";
          return null;
        }
        return null;
      },
    },
    transformUrlContent: {
      html: (urlInfo) => {
        if (!preactDevtools) {
          return null;
        }
        if (urlInfo.context.build && preactDevtools !== "dev_and_build") {
          return null;
        }
        const jsenvToolbarHtmlClientFileUrl = urlInfo.context.getPluginMeta(
          "jsenvToolbarHtmlClientFileUrl",
        );
        if (
          jsenvToolbarHtmlClientFileUrl &&
          // startsWith to ignore search params
          urlInfo.url.startsWith(jsenvToolbarHtmlClientFileUrl)
        ) {
          return null;
        }
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const preactDevtoolsReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: urlInfo.context.dev ? "preact/debug" : "preact/devtools",
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: preactDevtoolsReference.generatedSpecifier,
          pluginName: "jsenv:preact",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return { content: htmlModified };
      },
      js_module: async (urlInfo) => {
        const urlMeta = URL_META.applyAssociations({
          url: urlInfo.url,
          associations,
        });
        const jsxEnabled = urlMeta.jsxTranspilation;
        const refreshEnabled = urlInfo.context.dev
          ? urlMeta.refreshInstrumentation &&
            !urlInfo.content.includes("import.meta.hot.decline()")
          : false;
        const hookNamesEnabled =
          urlInfo.context.dev &&
          urlMeta.hookNamesInstrumentation &&
          (urlInfo.content.includes("useState") ||
            urlInfo.content.includes("useReducer") ||
            urlInfo.content.includes("useRef") ||
            urlInfo.content.includes("useMemo"));
        let { code, map } = await applyBabelPlugins({
          babelPlugins: [
            ...(jsxEnabled
              ? [
                  [
                    urlInfo.context.dev
                      ? "@babel/plugin-transform-react-jsx-development"
                      : "@babel/plugin-transform-react-jsx",
                    {
                      runtime: "automatic",
                      importSource: "preact",
                    },
                  ],
                ]
              : []),
            ...(jsxEnabled && urlInfo.context.dev
              ? ["@babel/plugin-transform-react-jsx-source"]
              : []),
            ...(hookNamesEnabled ? ["babel-plugin-transform-hook-names"] : []),
            ...(refreshEnabled ? ["@prefresh/babel-plugin"] : []),
          ],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.url,
          outputUrl: urlInfo.generatedUrl,
        });
        if (jsxEnabled) {
          const magicSource = createMagicSource(code);
          // "@babel/plugin-transform-react-jsx" is injecting some of these 3 imports into the code:
          // 1. import { jsx } from "preact/jsx-runtime"
          // 2. import { jsxDev } from "preact/jsx-dev-runtime"
          // 3. import { createElement } from "preact"
          // see https://github.com/babel/babel/blob/410c9acf1b9212cac69d50b5bb2015b9f372acc4/packages/babel-plugin-transform-react-jsx/src/create-plugin.ts#L743-L755
          // "@babel/plugin-transform-react-jsx" cannot be configured to inject what we want
          // ("/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js" instead of "preact/jsx-runtime")
          // but that's fine we can still replace these imports afterwards as done below.
          const injectedSpecifiers = [
            `"preact"`,
            `"preact/jsx-dev-runtime"`,
            `"preact/jsx-runtime"`,
          ];
          for (const importSpecifier of injectedSpecifiers) {
            let index = code.indexOf(importSpecifier);
            while (index > -1) {
              const specifier = importSpecifier.slice(1, -1);
              const injectedJsImportReference = urlInfo.dependencies.inject({
                type: "js_import",
                expectedType: "js_module",
                specifier,
              });
              magicSource.replace({
                start: index,
                end: index + importSpecifier.length,
                replacement: injectedJsImportReference.generatedSpecifier,
              });
              index = code.indexOf(importSpecifier, index + 1);
            }
          }
          const afterJsxReplace = magicSource.toContentAndSourcemap({
            source: "jsenv_preact",
          });
          code = afterJsxReplace.content;
          // can't compose import maps: the resulting sourcemap is wrong by a few lines
          // (3-4) and would makes debugging experience close to horrible
          // map = await composeTwoSourcemaps(map, afterJsxReplace.sourcemap);
        }
        if (refreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code);
          const hasSig = /\$RefreshSig\$\(/.test(code);
          if (hasReg || hasSig) {
            const preactRefreshClientReference = urlInfo.dependencies.inject({
              type: "js_import",
              expectedType: "js_module",
              specifier: "@jsenv/plugin-preact/src/client/preact_refresh.js",
            });
            if (code.includes("__preact_refresh__")) {
              // should never happen
              // (was hapnning due to how dev server was generating file names in SPA mode causing inline content
              // to be cooked twice)
              console.warn(
                `Cannot inject preact refresh code in ${urlInfo.url} because it already contains __preact_refresh__ variable.`,
              );
            } else {
              const prelude = `import { installPreactRefresh } from ${
                preactRefreshClientReference.generatedSpecifier
              };
const __preact_refresh__ = installPreactRefresh(${JSON.stringify(urlInfo.url)});
`;
              code = `${prelude.replace(/\n/g, "")}${code}`;
              if (hasReg) {
                code = `${code}

__preact_refresh__.end();
import.meta.hot.accept(__preact_refresh__.acceptCallback);`;
              }
            }
          }
        }
        return {
          content: code,
          sourcemap: map,
          // "no sourcemap is better than wrong sourcemap":
          // I don't know exactly what is resulting in bad sourcemaps
          // but I suspect hooknames or prefresh to be responsible
          // sourcemapIsWrong: jsxEnabled && refreshEnabled,
        };
      },
    },
  };
};
