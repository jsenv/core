import { collectProgramImportMetas } from "@jsenv/core/src/utils/js_ast/program_import_metas.js"

export const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        const importMetas = collectProgramImportMetas(programPath)
        state.file.metadata.importMetaHotDetected = Boolean(importMetas.hot)
      },
    },
  }
}
