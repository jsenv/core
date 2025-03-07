import { fetchFileSystem } from "./fetch_filesystem.js";

export const createFileSystemFetch = (directoryUrl, options) => {
  return (request, helpers) => {
    return fetchFileSystem(request, helpers, directoryUrl, options);
  };
};
