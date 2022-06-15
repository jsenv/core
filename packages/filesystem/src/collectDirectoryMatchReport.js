import { Abort } from "@jsenv/abort"
import {
  normalizeStructuredMetaMap,
  urlCanContainsMetaMatching,
  urlToMeta,
} from "@jsenv/url-meta"

import { ensureUrlTrailingSlash } from "./internal/ensureUrlTrailingSlash.js"
import { assertAndNormalizeDirectoryUrl } from "./assertAndNormalizeDirectoryUrl.js"
import { readDirectory } from "./readDirectory.js"
import { readEntryStat } from "./readEntryStat.js"
import { urlToRelativeUrl } from "./urlToRelativeUrl.js"
import { comparePathnames } from "./comparePathnames.js"

export const collectDirectoryMatchReport = async ({
  signal = new AbortController().signal,
  directoryUrl,
  structuredMetaMap,
  predicate,
}) => {
  const matchingArray = []
  const ignoredArray = []

  const rootDirectoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl)
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`)
  }
  const structuredMetaMapNormalized = normalizeStructuredMetaMap(
    structuredMetaMap,
    rootDirectoryUrl,
  )

  const collectOperation = Abort.startOperation()
  collectOperation.addAbortSignal(signal)

  const visitDirectory = async (directoryUrl) => {
    collectOperation.throwIfAborted()
    const directoryItems = await readDirectory(directoryUrl)

    await Promise.all(
      directoryItems.map(async (directoryItem) => {
        const directoryChildNodeUrl = `${directoryUrl}${directoryItem}`
        const relativeUrl = urlToRelativeUrl(
          directoryChildNodeUrl,
          rootDirectoryUrl,
        )

        collectOperation.throwIfAborted()
        const directoryChildNodeStats = await readEntryStat(
          directoryChildNodeUrl,
          {
            // we ignore symlink because recursively traversed
            // so symlinked file will be discovered.
            // Moreover if they lead outside of directoryPath it can become a problem
            // like infinite recursion of whatever.
            // that we could handle using an object of pathname already seen but it will be useless
            // because directoryPath is recursively traversed
            followLink: false,
          },
        )

        if (directoryChildNodeStats.isDirectory()) {
          const subDirectoryUrl = `${directoryChildNodeUrl}/`

          if (
            !urlCanContainsMetaMatching({
              url: subDirectoryUrl,
              structuredMetaMap: structuredMetaMapNormalized,
              predicate,
            })
          ) {
            ignoredArray.push({
              relativeUrl: ensureUrlTrailingSlash(relativeUrl),
              fileStats: directoryChildNodeStats,
            })

            return
          }

          await visitDirectory(subDirectoryUrl)
          return
        }

        if (directoryChildNodeStats.isFile()) {
          const meta = urlToMeta({
            url: directoryChildNodeUrl,
            structuredMetaMap: structuredMetaMapNormalized,
          })
          if (!predicate(meta)) {
            ignoredArray.push({
              relativeUrl,
              meta,
              fileStats: directoryChildNodeStats,
            })
            return
          }

          matchingArray.push({
            relativeUrl,
            meta,
            fileStats: directoryChildNodeStats,
          })
          return
        }
      }),
    )
  }

  try {
    await visitDirectory(rootDirectoryUrl)

    return {
      matchingArray: sortByRelativeUrl(matchingArray),
      ignoredArray: sortByRelativeUrl(ignoredArray),
    }
  } finally {
    await collectOperation.end()
  }
}

const sortByRelativeUrl = (array) =>
  array.sort((left, right) => {
    return comparePathnames(left.relativeUrl, right.relativeUrl)
  })
