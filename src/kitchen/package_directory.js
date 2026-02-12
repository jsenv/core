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
    find: (url) =>
      url.startsWith("file:") ? lookupPackageDirectory(url) : null,
    read: readPackageAtOrNull,
  };
  return packageDirectory;
};
