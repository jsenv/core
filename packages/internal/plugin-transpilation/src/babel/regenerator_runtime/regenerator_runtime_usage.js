import { visitJsAstUntil } from "@jsenv/ast";
import { regeneratorRuntimeClientFileUrl } from "./regenerator_runtime_client_file_url.js";

export const analyzeRegeneratorRuntimeUsage = (urlInfo) => {
  if (urlInfo.url === regeneratorRuntimeClientFileUrl) {
    return null;
  }
  const ast = urlInfo.contentAst;
  const node = visitJsAstUntil(ast, {
    Identifier: (node) => {
      if (node.name === "regeneratorRuntime") {
        return node;
      }
      return false;
    },
  });
  return node
    ? {
        line: node.loc.start.line,
        column: node.loc.start.column,
      }
    : null;
};
