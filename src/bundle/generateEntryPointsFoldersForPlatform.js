import { createCancellationToken } from "@dmail/cancellation"
import { generateEntryPointsForPlatform } from "./generateEntryPointsForPlatform.js"

export const generateEntryPointsFoldersForPlatform = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  into,
  entryPointsDescription,
  compileDescription,
  rollupOptions,
}) => {
  await Promise.all(
    Object.keys(compileDescription).map((compileId) => {
      return generateEntryPointsForPlatform({
        cancellationToken,
        projectFolder,
        into: `${into}/${compileId}`,
        entryPointsDescription,
        babelPluginDescription: compileDescription[compileId].babelPluginDescription,
        rollupOptions,
      })
    }),
  )
}
