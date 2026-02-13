import {
  lookupPackageDirectory as lookupPackageDirectoryDefault,
  readPackageAtOrNull,
} from "@jsenv/filesystem";

export const createPackageDirectory = ({
  sourceDirectoryUrl,
  lookupPackageDirectory = lookupPackageDirectoryDefault,
}) => {
  const packageDirectory = {
    url: lookupPackageDirectory(sourceDirectoryUrl),
    find: (url) => {
      const urlString = typeof url === "string" ? url : url?.href;
      if (!urlString.startsWith("file:")) {
        return null;
      }
      return lookupPackageDirectory(url);
    },
    read: readPackageAtOrNull,
  };
  return packageDirectory;
};
