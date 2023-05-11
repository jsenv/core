import { collectFiles } from "./collectFiles.js";

export const listFilesMatching = async ({
  directoryUrl = process.cwd(),
  patterns,
  signal,
}) => {
  if (typeof patterns !== "object" || patterns === null) {
    throw new TypeError(`patterns must be an object, got ${patterns}`);
  }
  const fileDatas = await collectFiles({
    signal,
    directoryUrl,
    associations: { matches: patterns },
    predicate: ({ matches }) => matches,
  });
  return fileDatas.map(({ url }) => url);
};
