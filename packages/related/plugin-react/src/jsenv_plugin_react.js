/*
 * - https://github.com/vitejs/vite/blob/main/packages/plugin-react/src/index.ts
 */

import { URL_META } from "@jsenv/url-meta";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import { applyBabelPlugins } from "@jsenv/ast";

import { jsenvPluginReactRefreshPreamble } from "./jsenv_plugin_react_refresh_preamble.js";

export const jsenvPluginReact = ({
  asJsModuleLogLevel,
  jsxTranspilation = true,
  refreshInstrumentation = false,
} = {}) => {
  return [
    jsenvPluginCommonJs({
      name: "jsenv:react_commonjs",
      logLevel: asJsModuleLogLevel,
      include: {
        "file:///**/node_modules/react/": true,
        "file:///**/node_modules/react-dom/": { external: ["react"] },
        "file:///**/node_modules/react/jsx-runtime/": { external: ["react"] },
        "file:///**/node_modules/react/jsx-dev-runtime": {
          external: ["react"],
        },
        "file:///**/react-refresh/": { external: ["react"] },
        // in case redux is used
        "file:///**/node_modules/react-is/": true,
        "file:///**/node_modules/use-sync-external-store/": {
          external: ["react"],
        },
        "file:///**/node_modules/hoist-non-react-statics/": {
          external: ["react-is"],
        },
      },
    }),
    jsenvPluginReactRefreshPreamble(),
    jsenvPluginJsxAndRefresh({
      jsxTranspilation,
      refreshInstrumentation,
    }),
  ];
};

const jsenvPluginJsxAndRefresh = ({
  jsxTranspilation,
  refreshInstrumentation,
}) => {
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
  const associations = URL_META.resolveAssociations(
    {
      jsxTranspilation,
      refreshInstrumentation,
    },
    "file://",
  );

  return {
    name: "jsenv:jsx_and_refresh",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        const urlMeta = URL_META.applyAssociations({
          url: urlInfo.url,
          associations,
        });
        const jsxEnabled = urlMeta.jsxTranspilation;
        const refreshEnabled = context.dev
          ? urlMeta.refreshInstrumentation &&
            !urlInfo.content.includes("import.meta.hot.decline()")
          : false;
        const babelPlugins = [
          ...(jsxEnabled
            ? [
                [
                  context.dev
                    ? "@babel/plugin-transform-react-jsx-development"
                    : "@babel/plugin-transform-react-jsx",
                  {
                    runtime: "automatic",
                    importSource: "react",
                  },
                ],
              ]
            : []),
          ...(refreshEnabled
            ? [["react-refresh/babel", { skipEnvCheck: true }]]
            : []),
        ];
        const { code, map } = await applyBabelPlugins({
          babelPlugins,
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.url,
          outputUrl: urlInfo.generatedUrl,
        });
        const magicSource = createMagicSource(code);
        if (jsxEnabled) {
          // "@babel/plugin-transform-react-jsx" is injecting some of these 3 imports into the code:
          // 1. import { jsx } from "react/jsx-runtime"
          // 2. import { jsxDev } from "react/jsx-dev-runtime"
          // 3. import { createElement } from "react"
          // see https://github.com/babel/babel/blob/410c9acf1b9212cac69d50b5bb2015b9f372acc4/packages/babel-plugin-transform-react-jsx/src/create-plugin.ts#L743-L755
          // "@babel/plugin-transform-react-jsx" cannot be configured to inject what we want
          // but that's fine we can still replace these imports afterwards as done below
          const injectedSpecifiers = [
            `"react"`,
            `"react/jsx-dev-runtime"`,
            `"react/jsx-runtime"`,
          ];
          for (const importSpecifier of injectedSpecifiers) {
            let index = code.indexOf(importSpecifier);
            while (index > -1) {
              const specifier = importSpecifier.slice(1, -1);
              const [injectedJsImportReference] = urlInfo.dependencies.inject({
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
        }
        if (refreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code);
          const hasSig = /\$RefreshSig\$\(/.test(code);
          if (hasReg || hasSig) {
            const [reactRefreshClientReference] = urlInfo.dependencies.inject({
              type: "js_import",
              expectedType: "js_module",
              specifier: "@jsenv/plugin-react/src/client/react_refresh.js",
            });
            magicSource.prepend(`import { installReactRefresh } from ${
              reactRefreshClientReference.generatedSpecifier
            }
const __react_refresh__ = installReactRefresh(${JSON.stringify(urlInfo.url)});
`);
            if (hasReg) {
              magicSource.append(`
__react_refresh__.end();
import.meta.hot.accept(__react_refresh__.acceptCallback);`);
            }
          }
        }
        const result = magicSource.toContentAndSourcemap();
        return {
          content: result.content,
          sourcemap: await composeTwoSourcemaps(map, result.sourcemap),
          // "no sourcemap is better than wrong sourcemap":
          // I don't know exactly what is resulting in bad sourcemaps
          // but I suspect hooknames or prefresh to be responsible
          sourcemapIsWrong: jsxEnabled && refreshEnabled,
        };
      },
    },
  };
};
