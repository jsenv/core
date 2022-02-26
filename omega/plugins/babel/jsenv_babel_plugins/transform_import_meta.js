// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { createParseError } from "@jsenv/core/src/internal/transform_js/babel_parse_error.js"
import {
  injectImport,
  injectAstAfterImport,
  generateValueAst,
} from "../babel_utils.js"

export const transformImportMeta = (
  babel,
  { importMetaFormat, importMetaHot },
) => {
  const visitImportMetaProperty = ({
    programPath,
    importMetaPropertyName,
    replace,
  }) => {
    if (importMetaFormat === "esmodule") {
      if (importMetaHot && importMetaPropertyName === "hot") {
        const importMetaHotAst = injectImport({
          programPath,
          from: "@jsenv/core/src/internal/event_source_client/import_meta_hot_module.js",
          nameHint: `createImportMetaHot`,
          // disable interop, useless as we work only with js modules
          importedType: "es6",
          // importedInterop: "uncompiled",
        })
        const ast = babel.parse(
          `import.meta.hot = ${importMetaHotAst.name}(import.meta.url)`,
        )
        injectAstAfterImport(programPath, ast.program.body[0])
      }
      // keep native version
      return
    }
    if (importMetaFormat === "systemjs") {
      // systemjs will handle it
      return
    }
    if (importMetaFormat === "commonjs") {
      if (importMetaPropertyName === "url") {
        replace(
          injectImport({
            programPath,
            from: `@jsenv/core/helpers/import_meta/import_meta_url_commonjs.js`,
          }),
        )
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with commonjs format`,
        })
      }
      replace(generateValueAst(undefined))
      return
    }
    if (importMetaFormat === "global") {
      if (importMetaPropertyName === "url") {
        replace(
          injectImport({
            programPath,
            from: `@jsenv/core/helpers/import_meta/import_meta_url_global.js`,
          }),
        )
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with global format`,
        })
      }
      replace(generateValueAst(undefined))
      return
    }
  }

  return {
    name: "transform-import-meta",
    visitor: {
      Program(programPath) {
        const importMetaNamedPaths = collectImportMetaNamedPaths(programPath)
        Object.keys(importMetaNamedPaths).forEach((key) => {
          visitImportMetaProperty({
            programPath,
            importMetaPropertyName: key,
            replace: (ast) => {
              const importMetaPaths = importMetaNamedPaths[key]
              importMetaPaths.forEach((path) => {
                path.replaceWith(ast)
              })
            },
          })
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
