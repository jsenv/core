import { createCancellationToken } from "@dmail/cancellation"
import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { scanReferencedRessourcesInFile } from "../scan-ressources/scanReferencedRessourcesInFile.js"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"

export const computeCompileInstruction = async ({
  cancellationToken = createCancellationToken(),
  root,
  main = "index.js",
  compilePatternMapping = {},
}) => {
  const [mainCompilationInstruction, additionalCompilationInstruction] = await Promise.all([
    getMainCompilationInstruction({
      cancellationToken,
      root,
      main,
    }),
    getAdditionalCompilationInstruction({
      cancellationToken,
      root,
      compilePatternMapping,
    }),
  ])

  return {
    mapping: { ...mainCompilationInstruction.mapping, ...additionalCompilationInstruction.mapping },
    files: { ...mainCompilationInstruction.files, ...additionalCompilationInstruction.files },
  }
}

const getMainCompilationInstruction = async ({ cancellationToken, root, main }) => {
  const mainReferencedRessources = await scanReferencedRessourcesInFile({
    cancellationToken,
    file: `${root}/${main}`,
    resolve: ({ specifier, specifierFile }) =>
      resolveModuleSpecifier({ root, moduleSpecifier: specifier, file: specifierFile }),
    resolveReal: (file) => resolveAPossibleNodeModuleFile(file) || file,
  })

  const mapping = {}
  const files = {}
  Object.keys(mainReferencedRessources).forEach((file) => {
    const { unpredictable, referencedByFile, referencedBySpecifier } = mainReferencedRessources[
      file
    ]

    if (fileIsOutsideRoot({ file, root })) {
      throw createFileOutsideRootError({
        root,
        file: fileToRelativeFile({ root, file }),
        referencedByFile,
        referencedBySpecifier,
      })
    }

    if (unpredictable.length) {
      // should warn about these unpredictable ressources
    }

    files[fileToRelativeFile({ root, file })] = { type: "compile" }

    // should handle mapping too
    // https://github.com/systemjs/systemjs/blob/master/docs/import-maps.md#scopes
  })

  return {
    mapping,
    files,
  }
}

const fileIsOutsideRoot = ({ root, file }) => {
  return !file.startsWith(`${root}`)
}

const createFileOutsideRootError = ({ root, file, referencedByFile, referencedBySpecifier }) => {
  return new Error(`unexpected file outside root.
root: ${root}
file: ${file}
referencedByFile: ${referencedByFile}
referencedBySpecifier: ${referencedBySpecifier}`)
}

const fileToRelativeFile = ({ root, file }) => {
  return file.slice(root.length + 1)
}

const getAdditionalCompilationInstruction = async ({
  cancellationToken,
  root,
  compilePatternMapping,
}) => {
  const metaMap = patternGroupToMetaMap({
    compile: compilePatternMapping,
  })

  const mapping = {}
  const files = {}

  await forEachRessourceMatching({
    cancellationToken,
    localRoot: root,
    metaMap,
    predicate: (meta) => meta.compile,
    callback: (file, meta) => {
      files[file] = meta.compile
    },
  })

  return { mapping, files }
}
