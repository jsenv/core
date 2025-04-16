import { URL_META } from "@jsenv/url-meta";
import { urlToRelativeUrl } from "@jsenv/urls";

import { comparePathnames } from "../path_and_url/compare_pathnames.js";
import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";
import { readDirectorySync } from "../read_write/read_directory_sync.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";

export const visitStructureSync = ({
  directoryUrl,
  associations,
  predicate,
  onDirectory = () => {},
  onMatch = () => {},
}) => {
  const rootDirectoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }
  associations = URL_META.resolveAssociations(associations, rootDirectoryUrl);
  const matchingFileResultArray = [];
  const visitDirectory = (directoryUrl) => {
    const directoryItems = readDirectorySync(directoryUrl);
    const matchingFileInfoArray = [];
    for (const directoryItem of directoryItems) {
      const directoryChildNodeUrl = `${directoryUrl}${directoryItem}`;
      let directoryChildNodeStats;
      try {
        directoryChildNodeStats = readEntryStatSync(directoryChildNodeUrl, {
          // we ignore symlink because recursively traversed
          // so symlinked file will be discovered.
          // Moreover if they lead outside of directoryPath it can become a problem
          // like infinite recursion of whatever.
          // that we could handle using an object of pathname already seen but it will be useless
          // because directoryPath is recursively traversed
          followLink: false,
        });
      } catch (e) {
        if (e && e.code === "ENOENT") {
          continue;
        }
        throw e;
      }
      if (directoryChildNodeStats.isDirectory()) {
        const subDirectoryUrl = `${directoryChildNodeUrl}/`;
        if (
          !URL_META.urlChildMayMatch({
            url: subDirectoryUrl,
            associations,
            predicate,
          })
        ) {
          continue;
        }
        onDirectory({
          url: subDirectoryUrl,
          relativeUrl: urlToRelativeUrl(subDirectoryUrl, rootDirectoryUrl),
          stats: directoryChildNodeStats,
          isDirectory: true,
        });
        visitDirectory(subDirectoryUrl);
        continue;
      }
      if (directoryChildNodeStats.isFile()) {
        const meta = URL_META.applyAssociations({
          url: directoryChildNodeUrl,
          associations,
        });
        if (!predicate(meta)) {
          continue;
        }
        const relativeUrl = urlToRelativeUrl(
          directoryChildNodeUrl,
          rootDirectoryUrl,
        );
        matchingFileResultArray.push({
          url: new URL(relativeUrl, rootDirectoryUrl).href,
          relativeUrl: decodeURIComponent(relativeUrl),
          meta,
          fileStats: directoryChildNodeStats,
        });
        matchingFileInfoArray.push({
          url: directoryChildNodeUrl,
          relativeUrl,
          stats: directoryChildNodeStats,
        });
        continue;
      }
    }
    let i = 0;
    while (i < matchingFileInfoArray.length) {
      const matchingFileInfo = matchingFileInfoArray[i];
      onMatch(matchingFileInfo, {
        prev: i === 0 ? null : matchingFileInfoArray[i - 1],
        next:
          i === matchingFileInfoArray.length - 1
            ? null
            : matchingFileInfoArray[i + 1],
      });
      i++;
    }
  };
  visitDirectory(rootDirectoryUrl);
  // When we operate on thoose files later it feels more natural
  // to perform operation in the same order they appear in the filesystem.
  // It also allow to get a predictable return value.
  // For that reason we sort matchingFileResultArray
  matchingFileResultArray.sort((leftFile, rightFile) => {
    return comparePathnames(leftFile.relativeUrl, rightFile.relativeUrl);
  });
  return matchingFileResultArray;
};
