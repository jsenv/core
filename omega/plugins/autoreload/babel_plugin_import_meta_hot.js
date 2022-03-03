// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import {
  injectImport,
  injectAstAfterImport,
} from "#omega/internal/js_ast/babel_utils.js"

export const babelPluginImportMetaHot = (babel) => {
  return {
    name: "import-meta-hot",
    visitor: {
      Program(programPath) {
        const importMetaNamedPaths = collectImportMetaNamedPaths(programPath)
        Object.keys(importMetaNamedPaths).forEach((key) => {
          if (key !== "hot") {
            return
          }
          const importMetaHotAst = injectImport({
            programPath,
            from: "@jsenv/core/omega/plugins/autoreload/client/import_meta_hot_module.js",
            nameHint: `createImportMetaHot`,
            // disable interop, useless as we work only with js modules
            importedType: "es6",
            // importedInterop: "uncompiled",
          })
          const ast = babel.parse(
            `import.meta.hot = ${importMetaHotAst.name}(import.meta.url)`,
          )
          injectAstAfterImport(programPath, ast.program.body[0])
        })
      },
    },
  }
}

const collectImportMetaNamedPaths = (programPath) => {
  const importMetaNamedPaths = {}
  programPath.traverse({
    MemberExpression(path) {
      const { node } = path
      const { object } = node
      if (object.type !== "MetaProperty") {
        return
      }
      const { property: objectProperty } = object
      if (objectProperty.name !== "meta") {
        return
      }
      const { property } = node
      const { name } = property

      const importMetaPaths = importMetaNamedPaths[name]
      if (importMetaPaths) {
        importMetaPaths.push(path)
      } else {
        importMetaNamedPaths[name] = [path]
      }
    },
  })
  return importMetaNamedPaths
}
