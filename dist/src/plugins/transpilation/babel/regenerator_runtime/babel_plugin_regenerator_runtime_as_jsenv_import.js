import { pathToFileURL } from "node:url";
import { injectImport } from "@jsenv/utils/js_ast/babel_utils.js";
export const babelPluginRegeneratorRuntimeAsJsenvImport = (babel, {
  getImportSpecifier
}) => {
  const regeneratorRuntimeClientFileUrl = new URL("../../../../../js/regenerator_runtime.js", import.meta.url).href;
  return {
    name: "regenerator-runtime-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const fileUrl = pathToFileURL(filename).href;

        if (fileUrl === regeneratorRuntimeClientFileUrl) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === "regeneratorRuntime") {
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(regeneratorRuntimeClientFileUrl),
            sideEffect: true
          });
        }
      }

    }
  };
};