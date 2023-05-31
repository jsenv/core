import { applysJsTranspilation } from "@jsenv/js-transpilation";

import { RUNTIME_COMPAT } from "../../../kitchen/compat/runtime_compat.js";

export const jsenvPluginBabel = ({ babelHelpersAsImport = true } = {}) => {
  const transformWithBabel = async (urlInfo, context) => {
    return applysJsTranspilation({
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
      isSupported: (feature) => {
        return RUNTIME_COMPAT.isSupported(context.clientRuntimeCompat, feature);
      },
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
