import { injectSideEffectFileIntoBabelAst } from "../side_effect_injection_in_babel_ast.js";
import { newStylesheetClientFileUrl } from "./new_stylesheet_client_file_url.js";

export const babelPluginNewStylesheetInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "new-stylesheet-injector",
    visitor: {
      Program: (path, state) => {
        const { sourceType } = state.file.opts.parserOpts;
        const isJsModule = sourceType === "module";
        injectSideEffectFileIntoBabelAst({
          programPath: path,
          isJsModule,
          asImport: babelHelpersAsImport,
          sideEffectFileUrl: newStylesheetClientFileUrl,
          getSideEffectFileSpecifier: getImportSpecifier,
          babel,
        });
      },
    },
  };
};
