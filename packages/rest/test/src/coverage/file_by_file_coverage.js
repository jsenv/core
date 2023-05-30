import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  isFileSystemPath,
} from "@jsenv/urls";

export const normalizeFileByFileCoveragePaths = (
  fileByFileCoverage,
  rootDirectoryUrl,
) => {
  const fileByFileNormalized = {};
  Object.keys(fileByFileCoverage).forEach((key) => {
    const fileCoverage = fileByFileCoverage[key];
    const { path } = fileCoverage;
    const url = isFileSystemPath(path)
      ? fileSystemPathToUrl(path)
      : new URL(path, rootDirectoryUrl).href;
    const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
    fileByFileNormalized[`./${relativeUrl}`] = {
      ...fileCoverage,
      path: `./${relativeUrl}`,
    };
  });
  return fileByFileNormalized;
};
