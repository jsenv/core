export const shouldUpdateVersion = (version) => {
  if (!version) {
    return false;
  }
  if (
    version.startsWith("./") ||
    version.startsWith("../") ||
    version.startsWith("file:")
  ) {
    return false;
  }
  if (version.startsWith("workspace:")) {
    return false;
  }
  // "*" means package accept anything
  // so there is no need to update it, it's always matching the latest version
  if (version === "*") {
    return false;
  }
  return true;
};
