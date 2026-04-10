/**
 * Inline CSS would force to write the following boilerplate all the time:
 * ```js
 * const css = `body { color: red; }`;
 * const stylesheet = new CSSStyleSheet();
 * stylesheet.replaceSync(css);
 * document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
 * if (import.meta.hot) {
 *   import.meta.hot.dispose(() => {
 *       document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
 *           (s) => s !== stylesheet,
 *       );
 *   });
 * }
 * ```
 *
 * It would be nice to have a plugin that does this automatically with the following syntax
 *
 * ```js
 * const css = `body { color: red; }`;
 * import.meta.css = css;
 * ```
 *
 */

import { applyBabelPlugins } from "@jsenv/ast";

export const jsenvPluginImportMetaCss = () => {
  const importMetaCssDevClientFileUrl = import.meta
    .resolve("./client/import_meta_css_dev.js");
  const importMetaCssBuildClientFileUrl = import.meta
    .resolve("./client/import_meta_css_build.js");

  return {
    name: "jsenv:import_meta_css",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (!urlInfo.content.includes("import.meta.css")) {
          return null;
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataUsesImportMetaCss],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        const { usesImportMetaCss } = metadata;
        if (!usesImportMetaCss) {
          return null;
        }
        return injectImportMetaCss(urlInfo, {
          importFrom: urlInfo.context.build
            ? importMetaCssBuildClientFileUrl
            : importMetaCssDevClientFileUrl,
          importName: urlInfo.context.build
            ? "installImportMetaCssBuild"
            : "installImportMetaCssDev",
          importAs: urlInfo.context.build
            ? "__installImportMetaCssBuild__"
            : "__installImportMetaCssDev__",
        });
      },
    },
  };
};

const babelPluginMetadataUsesImportMetaCss = () => {
  return {
    name: "metadata-uses-import-meta-css",
    visitor: {
      Program(programPath, state) {
        let usesImportMetaCss = false;
        programPath.traverse({
          MemberExpression(path) {
            const { node } = path;
            const { object } = node;
            if (object.type !== "MetaProperty") {
              return;
            }
            const { property: objectProperty } = object;
            if (objectProperty.name !== "meta") {
              return;
            }
            const { property } = node;
            const { name } = property;
            if (name === "css") {
              usesImportMetaCss = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesImportMetaCss = usesImportMetaCss;
      },
    },
  };
};

const injectImportMetaCss = (urlInfo, { importFrom, importName, importAs }) => {
  const importMetaCssClientFileReference = urlInfo.dependencies.inject({
    parentUrl: urlInfo.url,
    type: "js_import",
    expectedType: "js_module",
    specifier: importFrom,
  });
  let importVariableName;
  let importBeforeFrom;
  if (importAs && importAs !== importName) {
    importBeforeFrom = `{ ${importName} as ${importAs} }`;
    importVariableName = importAs;
  } else {
    importBeforeFrom = `{ ${importName} } }`;
    importVariableName = importName;
  }
  let prelude = `import ${importBeforeFrom} from ${importMetaCssClientFileReference.generatedSpecifier};

const remove = ${importVariableName}(import.meta);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    remove();
  });
}

`;

  let content = urlInfo.content;
  return {
    content: `${prelude.replace(/\n/g, "")}${content}`,
  };
};
