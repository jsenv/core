import {
  fileSystemPathToUrl,
  isFileSystemPath,
  urlToFileSystemPath,
} from "@jsenv/urls";

export const sourcemapConverter = {
  toFileUrls: (sourcemap) => {
    return {
      ...sourcemap,
      sources: sourcemap.sources.map((source) => {
        return isFileSystemPath(source) ? fileSystemPathToUrl(source) : source;
      }),
    };
  },
  toFilePaths: (sourcemap) => {
    return {
      ...sourcemap,
      sources: sourcemap.sources.map((source) => {
        return urlToFileSystemPath(source);
      }),
    };
  },
};
