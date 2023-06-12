import { readFileSync } from "node:fs";
import { injectJsImport } from "@jsenv/ast";

export const injectSideEffectFileIntoBabelAst = ({
  programPath,
  sideEffectFileUrl,
  getSideEffectFileSpecifier,
  babel,
  isJsModule,
  asImport = true,
}) => {
  if (isJsModule && asImport) {
    injectJsImport({
      programPath,
      from: getSideEffectFileSpecifier(sideEffectFileUrl),
      sideEffect: true,
    });
    return;
  }
  const sidEffectFileContent = readFileSync(new URL(sideEffectFileUrl), "utf8");
  const sideEffectFileContentAst = babel.parse(sidEffectFileContent);
  if (isJsModule) {
    injectAstAfterImport(programPath, sideEffectFileContentAst);
    return;
  }
  const bodyNodePaths = programPath.get("body");
  bodyNodePaths[0].insertBefore(sideEffectFileContentAst.program.body);
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
