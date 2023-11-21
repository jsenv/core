export const assertDirectoryContent = (
  actualDirectoryContent,
  expectedDirectoryContent,
) => {
  if (process.env.NO_SNAPSHOT_ASSERTION) {
    return;
  }
  // TODO
};
