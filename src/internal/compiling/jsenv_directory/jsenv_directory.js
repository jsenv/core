import {
  resolveUrl,
  readFile,
  writeFile,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"

import { compareCompileContexts } from "./compile_context.js"
import { compareCompileProfiles } from "./compile_profile.js"

export const setupJsenvDirectory = async ({
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  compileServerCanWriteOnFilesystem,
  compileContext,
}) => {
  const jsenvDirectoryUrl = resolveUrl(
    jsenvDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const compileDirectories = {}
  const jsenvDirectoryMeta = {
    compileContext,
    compileDirectories,
  }
  if (compileServerCanWriteOnFilesystem) {
    if (jsenvDirectoryClean) {
      await ensureEmptyDirectory(jsenvDirectoryUrl)
    }
    await applyFileSystemEffects({
      logger,
      jsenvDirectoryUrl,
      jsenvDirectoryMeta,
    })
  }

  /*
   * This function try to reuse existing compiled id
   * (the goal being to reuse file that would be in a corresponding compile directory)
   * To decide if we reuse a compile directory we need to know
   * how the files inside that directory where generated
   * and if what we want matches what we have, the compile id is reused
   *
   * Note: some parameters means only a subset of files would be invalid
   * but to keep things simple the whole directory is ignored
   */
  const getOrCreateCompileId = ({ compileProfile }) => {
    // TODO: decide when we can return null
    // depending on the compileProfile
    const existingCompileIds = Object.keys(compileDirectories)
    const existingCompileId = existingCompileIds.find((compileIdCandidate) => {
      const compileDirectoryCandidate = compileDirectories[compileIdCandidate]
      return compareCompileProfiles(
        compileDirectoryCandidate.compileProfile,
        compileProfile,
      )
    })
    if (existingCompileId) {
      return existingCompileId
    }
    const compileIdBase = generateCompileId({})
    let compileId = compileIdBase
    let integer = 1
    while (existingCompileIds.includes(compileId)) {
      compileId = `${compileIdBase}${integer}`
      integer++
    }
    compileDirectories[compileId] = {
      compileProfile,
    }
    return compileId
  }

  return {
    jsenvDirectoryMeta,
    getOrCreateCompileId,
  }
}

const applyFileSystemEffects = async ({
  logger,
  jsenvDirectoryUrl,
  jsenvDirectoryMeta,
}) => {
  const jsenvDirectoryMetaFileUrl = resolveUrl(
    "__jsenv_meta__.json",
    jsenvDirectoryUrl,
  )
  const writeOnFileSystem = async () => {
    await ensureEmptyDirectory(jsenvDirectoryUrl)
    await writeFile(
      jsenvDirectoryMetaFileUrl,
      JSON.stringify(jsenvDirectoryMeta, null, "  "),
    )
    logger.debug(`-> ${jsenvDirectoryMetaFileUrl}`)
  }
  try {
    const source = await readFile(jsenvDirectoryMetaFileUrl)
    if (source === "") {
      logger.warn(
        `out directory meta file is empty ${jsenvDirectoryMetaFileUrl}`,
      )
      await writeOnFileSystem()
      return
    }
    const jsenvDirectoryMetaPrevious = JSON.parse(source)
    if (
      !compareCompileContexts(
        jsenvDirectoryMetaPrevious.compileContext,
        jsenvDirectoryMeta.compileContext,
      )
    ) {
      logger.debug(
        `Cleaning ${jsenvDirectoryUrl} directory because compile context has changed`,
      )
      await writeOnFileSystem()
      return
    }
    // reuse existing compile directories
    jsenvDirectoryMeta.compileDirectories =
      jsenvDirectoryMetaPrevious.compileDirectories
  } catch (e) {
    if (e.code === "ENOENT") {
      await writeOnFileSystem()
      return
    }
    if (e.name === "SyntaxError") {
      logger.warn(`Syntax error while parsing ${jsenvDirectoryMetaFileUrl}`)
      await writeOnFileSystem()
      return
    }
    throw e
  }
}

const generateCompileId = ({ runtimeName, runtimeVersion, featureNames }) => {
  if (featureNames.includes("transform-instrument")) {
    return `${runtimeName}@${runtimeVersion}_cov`
  }
  return `${runtimeName}@${runtimeVersion}`
}
