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
      Program: {
        enter: (path, state) => {
          state.file.metadata.regeneratorRuntimeDetected = false;
          const { filename } = state;
          const fileUrl = pathToFileURL(filename).href;
          if (fileUrl === regeneratorRuntimeClientFileUrl) {
            path.stop();
          }
        },
        exit: (path, state) => {
          if (!state.file.metadata.regeneratorRuntimeDetected) return;
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
        },
      },
      Identifier(path, state) {
        const { node } = path;
        if (node.name === "regeneratorRuntime") {
          state.file.metadata.regeneratorRuntimeDetected = true;
          path.stop();
        }
      },
    },
  };
};
