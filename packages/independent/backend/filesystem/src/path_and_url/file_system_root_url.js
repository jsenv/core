export const fileSystemRootUrl =
  process.platform === "win32" ? `file:///${process.cwd()[0]}:/` : "file:///";
