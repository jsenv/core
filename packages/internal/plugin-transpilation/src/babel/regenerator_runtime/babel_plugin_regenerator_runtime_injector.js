import { injectSideEffectFileIntoBabelAst } from "../side_effect_injection_in_babel_ast.js";
import { regeneratorRuntimeClientFileUrl } from "./regenerator_runtime_client_file_url.js";

export const babelPluginRegeneratorRuntimeInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: regeneratorRuntimeClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};
