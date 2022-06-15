import { Abort } from "@jsenv/abort"

import { assertAndNormalizeDirectoryUrl } from "./assertAndNormalizeDirectoryUrl.js"
import { readEntryStat } from "./readEntryStat.js"
import { urlToFileSystemPath } from "./urlToFileSystemPath.js"
import { readSymbolicLink } from "./readSymbolicLink.js"
import { resolveUrl } from "./resolveUrl.js"
import { readDirectory } from "./readDirectory.js"
import { moveEntry } from "./moveEntry.js"
import { urlTargetsSameFileSystemPath } from "./internal/urlTargetsSameFileSystemPath.js"
import { statsToType } from "./internal/statsToType.js"

export const moveDirectoryContent = async ({
  signal = new AbortController().signal,
  from,
  to,
  overwrite,
  followLink = true,
} = {}) => {
  const fromUrl = assertAndNormalizeDirectoryUrl(from)
  const fromPath = urlToFileSystemPath(fromUrl)
  let toUrl = assertAndNormalizeDirectoryUrl(to)
  let toPath = urlToFileSystemPath(toUrl)

  const sourceStats = await readEntryStat(fromUrl, {
    nullIfNotFound: true,
    followLink: false,
  })
  if (!sourceStats) {
    throw new Error(`no directory to move content from at ${fromPath}`)
  }
  if (!sourceStats.isDirectory()) {
    const sourceType = statsToType(sourceStats)
    throw new Error(
      `found a ${sourceType} instead of a directory at ${fromPath}`,
    )
  }

  let destinationStats = await readEntryStat(toUrl, {
    nullIfNotFound: true,
    // we force false here but in fact we will follow the destination link
    // to know where we will actually move and detect useless move overrite etc..
    followLink: false,
  })
  if (followLink && destinationStats && destinationStats.isSymbolicLink()) {
    const linkTarget = await readSymbolicLink(toUrl)
    toUrl = resolveUrl(linkTarget, toUrl)
    toPath = urlToFileSystemPath(toUrl)
    destinationStats = await readEntryStat(toUrl, {
      nullIfNotFound: true,
    })
  }

  if (destinationStats === null) {
    throw new Error(`no directory to move content into at ${toPath}`)
  }
  if (!destinationStats.isDirectory()) {
    const destinationType = statsToType(destinationStats)
    throw new Error(
      `destination leads to a ${destinationType} instead of a directory at ${toPath}`,
    )
  }

  if (urlTargetsSameFileSystemPath(fromUrl, toUrl)) {
    throw new Error(
      `cannot move directory content, source and destination are the same (${fromPath})`,
    )
  }

  const moveOperation = Abort.startOperation()
  moveOperation.addAbortSignal(signal)
  try {
    moveOperation.throwIfAborted()
    const directoryEntries = await readDirectory(fromUrl)
    await Promise.all(
      directoryEntries.map(async (directoryEntry) => {
        const from = resolveUrl(directoryEntry, fromUrl)
        const to = resolveUrl(directoryEntry, toUrl)

        await moveOperation.withSignal(async (signal) => {
          await moveEntry({
            signal,
            from,
            to,
            overwrite,
            followLink,
          })
        })
      }),
    )
  } finally {
    await moveOperation.end()
  }
}
