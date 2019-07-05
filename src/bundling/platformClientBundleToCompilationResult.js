import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import {
  pathnameToOperatingSystemPath,
  isWindowsPath,
  windowsPathToPathnameWithoutDriveLetter,
  pathnameIsInside,
  pathnameToRelativePathname,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectPathname,
  compileIntoRelativePath,
  relativePathAbstractArray,
  entryRelativePath,
  sourcemapAssetPath,
  sourcemapPath = sourcemapAssetPath,
  bundle,
}) => {
  const output = bundle.output
  const main = output[0]

  const mainSourcemap = rollupSourcemapToCompilationSourcemap({
    rollupSourcemap: main.map,
    projectPathname,
    compileIntoRelativePath,
    entryRelativePath,
    relativePathAbstractArray,
  })

  const sources = mainSourcemap.sources
  const sourcesContent = mainSourcemap.sourcesContent
  const compiledSource = writeOrUpdateSourceMappingURL(main.code, sourcemapPath)
  const assets = [sourcemapAssetPath.slice(2)]
  const assetsContent = [JSON.stringify(mainSourcemap, null, "  ")]

  output.slice(1).forEach((chunk) => {
    const chunkSourcemap = rollupSourcemapToCompilationSourcemap({
      rollupSourcemap: chunk.map,
      projectPathname,
      compileIntoRelativePath,
      entryRelativePath,
      relativePathAbstractArray,
    })
    sources.push(...chunkSourcemap.sources) // we should avod duplication I guess
    sourcesContent.push(...chunkSourcemap.sourcesContent) // same here, avoid duplication

    assets.push(chunk.fileName)
    assetsContent.push(writeOrUpdateSourceMappingURL(chunk.code, `./${chunk.fileName}.map`))
    assets.push(`${chunk.fileName}.map`)
    assetsContent.push(JSON.stringify(chunkSourcemap, null, "  "))
  })

  return {
    contentType: "application/javascript",
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const rollupSourcemapToCompilationSourcemap = ({
  rollupSourcemap,
  projectPathname,
  compileIntoRelativePath,
  entryRelativePath,
  relativePathAbstractArray,
}) => {
  const sources = []
  const sourcesContent = []
  rollupSourcemap.sources.forEach((sourceRelativeToEntry, index) => {
    const sourcePath = resolve(
      dirname(
        pathnameToOperatingSystemPath(
          `${projectPathname}${compileIntoRelativePath}${entryRelativePath}`,
        ),
      ),
      sourceRelativeToEntry,
    )
    const sourcePathname = operatingSystemPathToPathname(sourcePath)
    const sourceSpecifier = isWindowsPath(sourcePath)
      ? windowsPathToPathnameWithoutDriveLetter(sourcePath)
      : sourcePath

    if (relativePathAbstractArray.includes(sourceSpecifier)) {
      return
    }

    if (!pathnameIsInside(sourcePathname, projectPathname)) {
      throw new Error(`a source is not inside project
source: ${sourceRelativeToEntry}
source path: ${sourcePath}
project path: ${pathnameToOperatingSystemPath(projectPathname)}`)
    }

    const sourceRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    if (relativePathAbstractArray.includes(sourceRelativePath)) {
      return
    }

    sources.push(sourceRelativePath)

    // .json file source content is not the one inside the file
    // because jsenv-rollup-plugin transforms it to
    // export default, so we must set back the
    // right file content
    if (sourceRelativePath.endsWith(".json") || !rollupSourcemap.sourcesContent) {
      const sourcePath = `${projectPathname}${sourceRelativePath}`
      // this could be async but it's ok for now
      // making it async could be harder than it seems
      // because sourcesContent must be in sync with sources
      const buffer = readFileSync(sourcePath)
      sourcesContent.push(String(buffer))
    } else {
      sourcesContent.push(rollupSourcemap.sourcesContent[index])
    }
  })

  const sourcemap = {
    ...rollupSourcemap,
    sources,
    sourcesContent,
  }

  return sourcemap
}
