import { createCancellationToken } from "@dmail/cancellation"
import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { predictLocalDependencies } from "../predict-local-dependencies/predictLocalDependencies.js"
import { ensureDependenciesInsideRoot } from "./ensureDependenciesInsideRoot.js"
import { dependenciesToMapping } from "./dependenciesToMapping.js"
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
  const mainDependencies = await predictLocalDependencies({
    cancellationToken,
    file: `${root}/${main}`,
    resolve: ({ specifier, specifierFile }) =>
      resolveModuleSpecifier({ root, moduleSpecifier: specifier, file: specifierFile }),
    resolveReal: (file) => resolveAPossibleNodeModuleFile(file) || file,
  })

  ensureDependenciesInsideRoot({ root, ressource: main, dependencies: mainDependencies })

  const mapping = dependenciesToMapping({ root, main, dependencies: mainDependencies })
  const ressources = {}
  Object.keys(mainDependencies).forEach((dependency) => {
    ressources[fileToRessource({ root, file: dependency.realFile })] = { type: "compile" }
  })

  return {
    mapping,
    ressources,
  }
}

const fileToRessource = ({ root, file }) => {
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
  const ressources = {}

  await forEachRessourceMatching({
    cancellationToken,
    localRoot: root,
    metaMap,
    predicate: (meta) => meta.compile,
    callback: (ressource, meta) => {
      ressources[ressource] = meta.compile
    },
  })

  return { mapping, ressources }
}
