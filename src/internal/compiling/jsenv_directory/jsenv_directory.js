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
  const jsenvDirectoryMetaFileUrl = resolveUrl(
    "__jsenv_meta__.json",
    jsenvDirectoryUrl,
  )
  const compileDirectories = {}
  const jsenvDirectoryMeta = {
    jsenvDirectoryRelativeUrl,
    compileContext,
    compileDirectories,
  }

  const writeMetaFile = async () => {
    await writeFile(
      jsenvDirectoryMetaFileUrl,
      JSON.stringify(jsenvDirectoryMeta, null, "  "),
    )
  }

  if (compileServerCanWriteOnFilesystem) {
    if (jsenvDirectoryClean) {
      await ensureEmptyDirectory(jsenvDirectoryUrl)
    }
    await applyFileSystemEffects({
      logger,
      jsenvDirectoryUrl,
      jsenvDirectoryMetaFileUrl,
      writeMetaFile,
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
  const getOrCreateCompileId = async ({
    runtimeName,
    runtimeVersion,
    compileProfile,
  }) => {
    const missingFeatureNames = Object.keys(compileProfile.missingFeatures)
    if (missingFeatureNames.length === 0) {
      return null
    }
    const existingCompileIds = Object.keys(compileDirectories)
    const existingCompileId = existingCompileIds.find((compileIdCandidate) => {
      const compileDirectoryCandidate = compileDirectories[compileIdCandidate]
      return compareCompileProfiles(
        compileDirectoryCandidate.compileProfile,
        compileProfile,
      )
    })
    const runtime = `${runtimeName}@${runtimeVersion}`
    if (existingCompileId) {
      const compileDirectory = compileDirectories[existingCompileId]
      const { runtimes } = compileDirectory
      if (!runtimes.includes(runtime)) {
        runtimes.push(runtime)
        await writeMetaFile()
      }
      return existingCompileId
    }
    const compileIdBase = generateCompileId({ compileProfile })
    let compileId = compileIdBase
    let integer = 1
    while (existingCompileIds.includes(compileId)) {
      compileId = `${compileIdBase}_${integer}`
      integer++
    }
    compileDirectories[compileId] = {
      compileProfile,
      runtimes: [runtime],
    }
    await writeMetaFile()
    return compileId
  }

  return {
    compileDirectories,
    getOrCreateCompileId,
  }
}

const generateCompileId = ({ compileProfile }) => {
  if (compileProfile.missingFeatures["transform-instrument"]) {
    return `out_instrumented`
  }
  return `out`
}

const applyFileSystemEffects = async ({
  logger,
  jsenvDirectoryUrl,
  jsenvDirectoryMetaFileUrl,
  jsenvDirectoryMeta,
  writeMetaFile,
}) => {
  try {
    const source = await readFile(jsenvDirectoryMetaFileUrl)
    if (source === "") {
      logger.warn(
        `${jsenvDirectoryMetaFileUrl} is empty -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
      await writeMetaFile()
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
        `compile context has changed -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
      await writeMetaFile()
      return
    }
    // reuse existing compile directories
    Object.assign(
      jsenvDirectoryMeta.compileDirectories,
      jsenvDirectoryMetaPrevious.compileDirectories,
    )
  } catch (e) {
    if (e.code === "ENOENT") {
      logger.debug(
        `${jsenvDirectoryMetaFileUrl} not found -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
      await writeMetaFile()
      return
    }
    if (e.name === "SyntaxError") {
      logger.warn(
        `${jsenvDirectoryMetaFileUrl} syntax error -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
      await writeMetaFile()
      return
    }
    throw e
  }
}
