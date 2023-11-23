import { readdirSync, realpathSync } from "node:fs";
import { fileSystemPathToUrl, urlToFileSystemPath } from "@jsenv/urls";

export const getRealFileSystemUrlSync = (
  fileUrl,
  { followLink = true } = {},
) => {
  const pathname = new URL(fileUrl).pathname;
  const parts = pathname.slice(1).split("/");
  let reconstructedFileUrl = `file:///`;
  if (process.platform === "win32") {
    const windowsDriveLetter = parts.shift();
    reconstructedFileUrl += `${windowsDriveLetter}/`;
  }
  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const name = parts[i];
    i++;
    let namesOnFileSystem;
    try {
      namesOnFileSystem = readdirSync(
        // When Node.js receives "C:/" on windows it returns
        // the process.cwd() directory content...
        // This can be fixed by passing "file:///C:/" directly but as a url object
        new URL(reconstructedFileUrl),
      );
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return null;
      }
      throw e;
    }
    const foundOnFilesystem = namesOnFileSystem.includes(name);
    if (foundOnFilesystem) {
      reconstructedFileUrl += name;
    } else {
      const nameOnFileSystem = namesOnFileSystem.find(
        (nameCandidate) => nameCandidate.toLowerCase() === name.toLowerCase(),
      );
      if (!nameOnFileSystem) {
        return null;
      }
      reconstructedFileUrl += nameOnFileSystem;
    }
    if (i === parts.length) {
      if (followLink) {
        const realPath = realpathSync.native(
          urlToFileSystemPath(reconstructedFileUrl),
        );
        return fileSystemPathToUrl(realPath);
      }
      return reconstructedFileUrl;
    }
    reconstructedFileUrl += "/";
  }
};
