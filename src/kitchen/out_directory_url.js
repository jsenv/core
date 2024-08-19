import { ensureWindowsDriveLetter } from "@jsenv/filesystem";
import { moveUrl, setUrlFilename, urlIsInsideOf } from "@jsenv/urls";

export const determineFileUrlForOutDirectory = (
  url,
  { filenameHint, rootDirectoryUrl, outDirectoryUrl },
) => {
  if (!outDirectoryUrl) {
    return url;
  }
  if (!url.startsWith("file:")) {
    return url;
  }
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", url);
    url = `${rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
  }
  if (filenameHint) {
    url = setUrlFilename(url, filenameHint);
  }
  return moveUrl({
    url,
    from: rootDirectoryUrl,
    to: outDirectoryUrl,
  });
};
