import { Abort } from "@jsenv/abort"
import { URL_META } from "@jsenv/url-meta"
import { urlToRelativeUrl } from "@jsenv/urls"

import { assertAndNormalizeDirectoryUrl } from "./directory_url_validation.js"
import { readDirectory } from "./readDirectory.js"
import { readEntryStat } from "./readEntryStat.js"
import { comparePathnames } from "./comparePathnames.js"

export const collectFiles = async ({
  signal = new AbortController().signal,
  directoryUrl,
  associations,
  predicate,
}) => {
  const rootDirectoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl)
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`)
  }
  associations = URL_META.resolveAssociations(associations, rootDirectoryUrl)

  const collectOperation = Abort.startOperation()
  collectOperation.addAbortSignal(signal)

  const matchingFileResultArray = []
  const visitDirectory = async (directoryUrl) => {
    collectOperation.throwIfAborted()
    const directoryItems = await readDirectory(directoryUrl)

    await Promise.all(
      directoryItems.map(async (directoryItem) => {
        const directoryChildNodeUrl = `${directoryUrl}${directoryItem}`
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
            !URL_META.urlChildMayMatch({
              url: subDirectoryUrl,
              associations,
              predicate,
            })
          ) {
            return
          }
          await visitDirectory(subDirectoryUrl)
          return
        }

        if (directoryChildNodeStats.isFile()) {
          const meta = URL_META.applyAssociations({
            url: directoryChildNodeUrl,
            associations,
          })
          if (!predicate(meta)) return

          const relativeUrl = urlToRelativeUrl(
            directoryChildNodeUrl,
            rootDirectoryUrl,
          )
          matchingFileResultArray.push({
            url: new URL(relativeUrl, rootDirectoryUrl).href,
            relativeUrl: decodeURIComponent(relativeUrl),
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

    // When we operate on thoose files later it feels more natural
    // to perform operation in the same order they appear in the filesystem.
    // It also allow to get a predictable return value.
    // For that reason we sort matchingFileResultArray
    matchingFileResultArray.sort((leftFile, rightFile) => {
      return comparePathnames(leftFile.relativeUrl, rightFile.relativeUrl)
    })
    return matchingFileResultArray
  } finally {
    await collectOperation.end()
  }
}
