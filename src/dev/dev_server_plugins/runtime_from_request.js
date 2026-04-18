const runtimeBySecChUa = new Map();
const runtimeByUserAgent = new Map();

export const getRuntimeFromRequest = (request) => {
  const secChUa = request.headers["sec-ch-ua"];
  if (secChUa) {
    const cached = runtimeBySecChUa.get(secChUa);
    if (cached) {
      return cached;
    }
    const result = parseSecChUaHeader(secChUa);
    if (result) {
      runtimeBySecChUa.set(secChUa, result);
      return result;
    }
  }
  const userAgent = request.headers["user-agent"] || "";
  const cached = runtimeByUserAgent.get(userAgent);
  if (cached) {
    return cached;
  }
  const result = parseUserAgentHeader(userAgent);
  runtimeByUserAgent.set(userAgent, result);
  return result;
};

const parseSecChUaHeader = (secChUa) => {
  // sec-ch-ua format: "Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"
  const brands = [];
  const regex = /"([^"]+)";v="([^"]+)"/g;
  let match;
  while ((match = regex.exec(secChUa)) !== null) {
    const name = match[1];
    const version = match[2];
    // skip "Not X;Brand" noise entries
    if (!name.includes("Not") && !name.includes("Brand")) {
      brands.push({ name, version });
    }
  }
  if (brands.length === 0) {
    return null;
  }
  // Prefer the non-Chromium brand (e.g. "Google Chrome", "Microsoft Edge")
  // Fall back to "Chromium" if no specific brand found
  let brand = brands.find((b) => b.name !== "Chromium");
  if (!brand) {
    brand = brands[0];
  }
  const runtimeName = brandNameToRuntimeName(brand.name);
  const runtimeVersion = brand.version;
  return { runtimeName, runtimeVersion };
};

const brandNameToRuntimeName = (brandName) => {
  const lower = brandName.toLowerCase();
  if (lower === "google chrome") {
    return "chrome";
  }
  if (lower === "headlesschrome") {
    return "chrome";
  }
  if (lower === "microsoft edge") {
    return "edge";
  }
  if (lower === "opera") {
    return "opera";
  }
  if (lower === "samsung internet") {
    return "samsung";
  }
  if (lower === "chromium") {
    return "chrome";
  }
  // other Chromium-based browsers share Chrome's compatibility
  return "chrome";
};

const parseUserAgentHeader = (userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    };
  }
  // iOS Safari must be checked before Safari (UA contains both)
  if (userAgent.includes("Mobile") && userAgent.includes("Safari")) {
    const iosSafariMatch = userAgent.match(/\bOS (\d+)[._](\d+)(?:[._](\d+))?/);
    if (iosSafariMatch) {
      const major = iosSafariMatch[1];
      const minor = iosSafariMatch[2] || "0";
      const patch = iosSafariMatch[3] || "0";
      return {
        runtimeName: "ios_safari",
        runtimeVersion: `${major}.${minor}.${patch}`,
      };
    }
  }
  if (!userAgent.includes("Chrome") && userAgent.includes("Safari")) {
    const safariMatch = userAgent.match(/\bVersion\/(\d+)\.(\d+)(?:\.(\d+))?/);
    if (safariMatch) {
      const major = safariMatch[1];
      const minor = safariMatch[2] || "0";
      const patch = safariMatch[3] || "0";
      return {
        runtimeName: "safari",
        runtimeVersion: `${major}.${minor}.${patch}`,
      };
    }
  }
  const firefoxMatch = userAgent.match(/\bFirefox\/(\d+)\.(\d+)\b/);
  if (firefoxMatch) {
    const major = firefoxMatch[1];
    const minor = firefoxMatch[2] || "0";
    return { runtimeName: "firefox", runtimeVersion: `${major}.${minor}.0` };
  }
  // generic Chromium-based fallback (should normally be handled by sec-ch-ua)
  const chromeMatch = userAgent.match(/\bChrome\/(\d+)\.(\d+)\b/);
  if (chromeMatch) {
    const major = chromeMatch[1];
    const minor = chromeMatch[2] || "0";
    return { runtimeName: "chrome", runtimeVersion: `${major}.${minor}.0` };
  }
  return { runtimeName: "unknown", runtimeVersion: "unknown" };
};
