import { createCancellationToken } from "@dmail/cancellation"
import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { scanReferencedRessourcesInFile } from "../scan-ressources/scanReferencedRessourcesInFile.js"
import { ensureRessourcesInsideRoot } from "./ensureRessourcesInsideRoot.js"
import { localRessourcesToMapping } from "./localRessourcesToMapping.js"
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

  const compilationInstruction = {
    ...mainCompilationInstruction,
    ...additionalCompilationInstruction,
  }
  return compilationInstruction
}

const getMainCompilationInstruction = async ({ cancellationToken, root, main }) => {
  const mainReferencedRessources = await scanReferencedRessourcesInFile({
    cancellationToken,
    file: `${root}/${main}`,
    resolve: ({ specifier, specifierFile }) =>
      resolveModuleSpecifier({ root, moduleSpecifier: specifier, file: specifierFile }),
    resolveReal: (file) => resolveAPossibleNodeModuleFile(file) || file,
  })

  const mainUnpredictableRessources = mainReferencedRessources.unpredictable
  if (mainUnpredictableRessources.length) {
    // should warn about these unpredictable ressources
  }

  const mainLocalRessources = mainReferencedRessources.localPredictable

  ensureRessourcesInsideRoot({
    root,
    ressources: mainLocalRessources,
  })

  const mapping = localRessourcesToMapping({ root, ressources: mainLocalRessources })
  const files = {}
  Object.keys(mainLocalRessources).forEach((file) => {
    files[fileToRelativeFile({ root, file })] = { type: "compile" }
  })

  return {
    mapping,
    files,
  }
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
