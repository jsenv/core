import { collectFiles } from "@jsenv/filesystem";

export const listRelativeFileUrlToCover = async ({
  signal,
  rootDirectoryUrl,
  coverageInclude,
}) => {
  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    associations: { cover: coverageInclude },
    predicate: ({ cover }) => cover,
  });
  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl);
};
