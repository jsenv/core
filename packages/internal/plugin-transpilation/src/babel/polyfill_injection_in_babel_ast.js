import { readFileSync } from "node:fs";
import { injectJsImport } from "@jsenv/ast";

export const injectPolyfillIntoBabelAst = ({
  programPath,
  polyfillFileUrl,
  getPolyfillImportSpecifier,
  babel,
  isJsModule,
  asImport = true,
}) => {
  if (isJsModule && asImport) {
    injectJsImport({
      programPath,
      from: getPolyfillImportSpecifier(polyfillFileUrl),
      sideEffect: true,
    });
    return;
  }
  const polyfillFileContent = readFileSync(new URL(polyfillFileUrl), "utf8");
  const polyfillAst = babel.parse(polyfillFileContent);
  if (isJsModule) {
    injectAstAfterImport(programPath, polyfillAst);
    return;
  }
  const bodyNodePaths = programPath.get("body");
  bodyNodePaths[0].insertBefore(polyfillAst.program.body);
};

const injectAstAfterImport = (programPath, ast) => {
  const bodyNodePaths = programPath.get("body");
  const notAnImportIndex = bodyNodePaths.findIndex(
    (bodyNodePath) => bodyNodePath.node.type !== "ImportDeclaration",
  );
  const notAnImportNodePath = bodyNodePaths[notAnImportIndex];
  if (notAnImportNodePath) {
    notAnImportNodePath.insertBefore(ast.program.body);
  } else {
    bodyNodePaths[0].insertBefore(ast.program.body);
  }
};
