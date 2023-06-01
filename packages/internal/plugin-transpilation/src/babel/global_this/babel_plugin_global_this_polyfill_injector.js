import { pathToFileURL } from "node:url";
import { injectPolyfillIntoBabelAst } from "../polyfill_injection_in_babel_ast.js";

const globalThisJsModuleClientFileUrl = new URL(
  "./client/global_this_js_module.js",
  import.meta.url,
).href;
const globalThisJsClassicClientFileUrl = new URL(
  "./client/global_this_js_classic.js",
  import.meta.url,
).href;

export const babelPluginGlobalThisPolyfillInjector = (
  babel,
  { babelHelpersAsImport, getImportSpecifier },
) => {
  return {
    name: "global-this-polyfill-injector",
    visitor: {
      Program: {
        enter: (path, state) => {
          state.file.metadata.globalThisDetected = false;
        },
        exit: (path, state) => {
          if (!state.file.metadata.globalThisDetected) return;
          const { sourceType } = state.file.opts.parserOpts;
          const isJsModule = sourceType === "module";
          injectPolyfillIntoBabelAst({
            programPath: path,
            isJsModule,
            asImport: babelHelpersAsImport,
            polyfillFileUrl: isJsModule
              ? globalThisJsModuleClientFileUrl
              : globalThisJsClassicClientFileUrl,
            getPolyfillImportSpecifier: getImportSpecifier,
            babel,
          });
        },
      },
      Identifier(path, state) {
        const { filename } = state;
        const fileUrl = pathToFileURL(filename).href;
        if (fileUrl === globalThisJsModuleClientFileUrl) {
          return;
        }
        const { node } = path;
        if (node.name === "globalThis") {
          state.file.metadata.globalThisDetected = true;
        }
      },
    },
  };
};
