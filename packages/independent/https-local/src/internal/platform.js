export const importPlatformMethods = async () => {
  const { platform } = process;
  if (platform === "darwin") {
    return await import("./mac/mac.js");
  }
  if (platform === "linux") {
    return await import("./linux/linux.js");
  }
  if (platform === "win32") {
    return await import("./windows/windows.js");
  }
  return await import("./unsupported_platform/unsupported_platform.js");
};
