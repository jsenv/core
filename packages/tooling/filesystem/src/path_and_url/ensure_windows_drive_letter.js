import { fileSystemPathToUrl } from "@jsenv/urls";

const isWindows = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl(process.cwd());

/**
 * Some url might be resolved or remapped to url without the windows drive letter.
 * For instance
 * new URL('/foo.js', 'file:///C:/dir/file.js')
 * resolves to
 * 'file:///foo.js'
 *
 * But on windows it becomes a problem because we need the drive letter otherwise
 * url cannot be converted to a filesystem path.
 *
 * ensureWindowsDriveLetter ensure a resolved url still contains the drive letter.
 */

export const ensureWindowsDriveLetter = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch {
    throw new Error(`absolute url expect but got ${url}`);
  }

  if (!isWindows) {
    return url;
  }

  try {
    baseUrl = String(new URL(baseUrl));
  } catch {
    throw new Error(
      `absolute baseUrl expect but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }

  if (!url.startsWith("file://")) {
    return url;
  }
  const afterProtocol = url.slice("file://".length);
  // we still have the windows drive letter
  if (extractDriveLetter(afterProtocol)) {
    return url;
  }

  // drive letter was lost, restore it
  const baseUrlOrFallback = baseUrl.startsWith("file://")
    ? baseUrl
    : baseUrlFallback;
  const driveLetter = extractDriveLetter(
    baseUrlOrFallback.slice("file://".length),
  );
  if (!driveLetter) {
    throw new Error(
      `drive letter expect on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`,
    );
  }
  return `file:///${driveLetter}:${afterProtocol}`;
};

const extractDriveLetter = (resource) => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(resource[1]) && resource[2] === ":") {
    return resource[1];
  }
  return null;
};
