import { fetchFileSystem } from "./fetch_filesystem.js";

export const createFileSystemRequestHandler = (directoryUrl, options) => {
  return (request, helpers) => {
    return fetchFileSystem(request, helpers, directoryUrl, options);
  };
};
