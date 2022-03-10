import { collectProgramImportMetas } from "@jsenv/core/src/utils/js_ast/program_import_metas.js"

export const babelPluginMetadataImportMetaScenarios = () => {
  return {
    name: "metadata-import-meta-scenarios",
    visitor: {
      Program(programPath, state) {
        const importMetas = collectProgramImportMetas(programPath)
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          test: importMetas.test,
          preview: importMetas.preview,
          prod: importMetas.prod,
        }
      },
    },
  }
}
