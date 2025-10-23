const detectMac = () => {
  // Modern way using User-Agent Client Hints API
  if (window.navigator.userAgentData) {
    return window.navigator.userAgentData.platform === "macOS";
  }
  // Fallback to userAgent string parsing
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
};
export const isMac = detectMac();
