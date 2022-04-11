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

  const compiledFileWriteSignal = { onwrite: () => {} }
  if (compileServerCanWriteOnFilesystem) {
    if (jsenvDirectoryClean) {
      await ensureEmptyDirectory(jsenvDirectoryUrl)
    }
    await applyFileSystemEffects({
      logger,
      jsenvDirectoryUrl,
      jsenvDirectoryMetaFileUrl,
      jsenvDirectoryMeta,
    })
    // We want ".jsenv" directory to appear on the filesystem only
    // if there is a compiled file inside (and not immediatly when compile server starts)
    // To do this we wait for a file to be written to write "__jsenv_meta__.json" file
    compiledFileWriteSignal.onwrite = async () => {
      compiledFileWriteSignal.onwrite = () => {}
      await writeMetaFile()
    }
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
        writeMetaFile()
      }
      return existingCompileId
    }
    const compileIdBase = generateCompileId({
      compileProfile,
      runtimeName,
      runtimeVersion,
    })
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
    compiledFileWriteSignal,
  }
}

const generateCompileId = ({ compileProfile, runtimeName }) => {
  if (runtimeName === "jsenv_build") {
    return `out_build`
  }
  if (compileProfile.missingFeatures["transform-instrument"]) {
    return `out_instrumented`
  }
  if (compileProfile.moduleOutFormat === "systemjs") {
    return `out_system`
  }
  return `out`
}

const applyFileSystemEffects = async ({
  logger,
  jsenvDirectoryUrl,
  jsenvDirectoryMetaFileUrl,
  jsenvDirectoryMeta,
}) => {
  try {
    const source = await readFile(jsenvDirectoryMetaFileUrl)
    if (source === "") {
      logger.warn(
        `${jsenvDirectoryMetaFileUrl} is empty -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
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
      return
    }
    if (e.name === "SyntaxError") {
      logger.warn(
        `${jsenvDirectoryMetaFileUrl} syntax error -> clean ${jsenvDirectoryUrl} directory`,
      )
      await ensureEmptyDirectory(jsenvDirectoryUrl)
      return
    }
    throw e
  }
}
