import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { bundleWithRollup } from "./bundleWithRollup.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"

export const generateBundle = ({
  projectPath,
  bundleIntoRelativePath,
  importMapRelativePath,
  platformGroupResolverRelativePath,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
  inlineSpecifierMap,
  entryPointMap,
  babelPluginMap,
  compileGroupCount,
  platformScoreMap,
  logLevel,
  minify,
  writeOnFileSystem,
  format,
  throwUnhandled,
}) => {
  const promise = catchAsyncFunctionCancellation(async () => {
    if (typeof projectPath !== "string")
      throw new TypeError(`projectPath must be a string, got ${projectPath}`)
    if (typeof bundleIntoRelativePath !== "string")
      throw new TypeError(`bundleIntoRelativePath must be a string, got ${bundleIntoRelativePath}`)
    if (typeof entryPointMap !== "object")
      throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
    if (typeof compileGroupCount !== "number")
      throw new TypeError(`compileGroupCount must be a number, got ${compileGroupCount}`)
    if (compileGroupCount < 1)
      throw new Error(`compileGroupCount must be > 1, got ${compileGroupCount}`)

    const projectPathname = operatingSystemPathToPathname(projectPath)
    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      return await bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithoutBalancing({
          cancellationToken,
          projectPathname,
          bundleIntoRelativePath,
          importMapRelativePath,
          inlineSpecifierMap,
          entryPointMap,
          babelPluginMap,
          format,
          minify,
          logLevel,
        }),
      })
    }

    const groupMap = generateGroupMap({
      babelPluginMap,
      platformScoreMap,
      groupCount: compileGroupCount,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        entryPointMap,
        inlineSpecifierMap,
        babelPluginMap,
        groupMap,
        minify,
        format,
        logLevel,
        writeOnFileSystem,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        projectPathname,
        bundleIntoRelativePath,
        importMapRelativePath,
        platformGroupResolverRelativePath,
        balancerTemplateRelativePath,
        balancerDataClientPathname,
        entryPointMap,
        babelPluginMap,
        groupMap,
        minify,
        logLevel,
        format,
        writeOnFileSystem,
      }),
    ])
  })

  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}

const generateEntryPointsFolders = async ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  entryPointMap,
  inlineSpecifierMap,
  babelPluginMap,
  groupMap,
  minify,
  format,
  logLevel,
  writeOnFileSystem,
}) => {
  await Promise.all(
    Object.keys(groupMap).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          projectPathname,
          bundleIntoRelativePath,
          importMapRelativePath,
          entryPointMap,
          inlineSpecifierMap,
          babelPluginMap,
          groupMap,
          minify,
          format,
          logLevel,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  platformGroupResolverRelativePath,
  balancerTemplateRelativePath,
  balancerDataClientPathname,
  entryPointMap,
  babelPluginMap,
  groupMap,
  minify,
  logLevel,
  format,
  writeOnFileSystem,
}) => {
  return Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          writeOnFileSystem,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            projectPathname,
            bundleIntoRelativePath,
            importMapRelativePath,
            platformGroupResolverRelativePath,
            babelPluginMap,
            groupMap,
            entryPointName,
            minify,
            logLevel,
            format,
            balancerTemplateRelativePath,
            balancerDataClientPathname,
          }),
        }),
      ])
    }),
  )
}
