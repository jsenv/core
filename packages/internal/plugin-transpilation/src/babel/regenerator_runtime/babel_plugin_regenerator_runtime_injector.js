import { pathToFileURL } from "node:url";
import { injectPolyfillIntoBabelAst } from "../polyfill_injection_in_babel_ast.js";

const regeneratorRuntimeClientFileUrl = new URL(
  "./client/regenerator_runtime.js",
  import.meta.url,
).href;

export const babelPluginRegeneratorRuntimeInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-injector",
    visitor: {
      Program: (path, state) => {
        let regeneratorRuntimeDetected = false;
        const { filename } = state;
        const fileUrl = pathToFileURL(filename).href;
        if (fileUrl === regeneratorRuntimeClientFileUrl) {
          return;
        }
        path.traverse({
          Identifier(path) {
            const { node } = path;
            if (node.name === "regeneratorRuntime") {
              regeneratorRuntimeDetected = true;
              path.stop();
            }
          },
        });
        state.file.metadata.regeneratorRuntimeDetected =
          regeneratorRuntimeDetected;
        if (regeneratorRuntimeDetected) {
          const { sourceType } = state.file.opts.parserOpts;
          const isJsModule = sourceType === "module";
          injectPolyfillIntoBabelAst({
            programPath: path,
            isJsModule,
            asImport: babelHelpersAsImport,
            polyfillFileUrl: regeneratorRuntimeClientFileUrl,
            getPolyfillImportSpecifier: getImportSpecifier,
            babel,
          });
        }
      },
    },
  };
};
