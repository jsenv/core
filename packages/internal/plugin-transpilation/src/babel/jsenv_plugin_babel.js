import { applyJsTranspilation } from "./apply_js_transpilation.js";

export const jsenvPluginBabel = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    return applyJsTranspilation({
      input: urlInfo.content,
      inputIsJsModule: urlInfo.type === "js_module",
      inputUrl: urlInfo.originalUrl,
      outputUrl: urlInfo.generatedUrl,
      babelHelpersAsImport,
      babelOptions: {
        generatorOpts: {
          retainLines: context.dev,
        },
      },
      runtimeCompat: context.clientRuntimeCompat,
      getImportSpecifier: (clientFileUrl) => {
        const [reference] = context.referenceUtils.inject({
          type: "js_import",
          expectedType: "js_module",
          specifier: clientFileUrl,
        });
        return JSON.parse(reference.generatedSpecifier);
      },
    });
  };
  return {
    name: "jsenv:babel",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: transformWithBabel,
      js_module: transformWithBabel,
    },
  };
};
