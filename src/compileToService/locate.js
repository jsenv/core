import {
  resolveAbsoluteModuleSpecifier,
  resolveAPossibleNodeModuleFile,
} from "@jsenv/module-resolution"

export const locate = ({ requestFile, refererFile, compileInto, localRoot }) => {
  const {
    compileId: requestCompileId,
    projectFile: requestProjectFile,
  } = requestFileToCompileIdAndProjectFile(requestFile, compileInto)

  if (!requestCompileId) return {}
  if (!requestProjectFile) return {}

  const compileId = requestCompileId
  const projectFile = requestProjectFile
  const moduleSpecifierFiler = refererFileToModuleSpecifierFile({
    refererFile,
    projectFile,
    compileInto,
    compileId,
    localRoot,
  })

  // projectFile can be considered as an absolute module specifier because
  // it's resolved by systemjs or the browser.
  // So we can use resolveAbsoluteModuleSpecifier.

  // we stil need it because we want to let 'referer' header have an impact
  // on the file location. Because something like
  // "/node_modules/foo/index.js" must be resolved against root of the module
  // importing the file, not localRoot

  // the problem of this approach is that client is likely going to receive a 307
  // for "/node_modules/foo/index.js" and the location will depends on referer.
  // it would be better for the browser to directly ask where the file is supposed to be.
  // and eventually receive a 307 for node_module when they are deduped.
  // but it means we expect browser implement our custom logic
  // saying '/' means either localRoot or module root
  const moduleFile = resolveAbsoluteModuleSpecifier({
    moduleSpecifier: `/${projectFile}`,
    file: moduleSpecifierFiler,
    localRoot,
  })

  // it is possible that the file is in fact somewhere else
  // due to node_module resolution algorithm
  const moduleFileOrNodeModuleFile = resolveAPossibleNodeModuleFile(moduleFile)

  return {
    compileId,
    projectFile,
    file: moduleFileOrNodeModuleFile,
  }
}

const refererFileToModuleSpecifierFile = ({
  refererFile,
  projectFile,
  compileInto,
  compileId,
  localRoot,
}) => {
  if (!refererFile) return null

  const {
    compileId: refererCompileId,
    projectFile: refererProjectFile,
  } = requestFileToCompileIdAndProjectFile(refererFile, compileInto)

  if (!refererProjectFile) return null
  if (refererProjectFile === projectFile) return null
  if (refererCompileId !== compileId) return null

  return `${localRoot}/${refererProjectFile}`
}

const requestFileToCompileIdAndProjectFile = (requestFile = "", compileInto) => {
  const parts = requestFile.split("/")
  const firstPart = parts[0]
  if (firstPart !== compileInto) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const compileId = parts[1]
  if (compileId.length === 0) {
    return {
      compileId: null,
      projectFile: null,
    }
  }

  const projectFile = parts.slice(2).join("/")
  if (projectFile.length === 0) {
    return {
      compileId: null,
      projectFile,
    }
  }

  return {
    compileId,
    projectFile,
  }
}
