import {
  ensurePathnameTrailingSlash,
  removePathnameTrailingSlash,
  urlToFileSystemPath,
  yieldAncestorUrls,
} from "@jsenv/urls";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

// remember this: https://stackoverflow.com/a/31976060/24573072
// when deciding which replacement to use and willBeWrittenOnFilesystem is true
const WELL_KNOWN_ROOT = {
  name: "root",
  getReplacement: ({ preferFileUrl }) => {
    if (preferFileUrl) {
      return "file:///[root]";
    }
    return "[root]";
  },
};
const WELL_KNOWN_HOMEDIR = {
  name: "homedir",
  getReplacement: ({ willBeWrittenOnFilesystem, preferFileUrl }) => {
    if (willBeWrittenOnFilesystem) {
      if (preferFileUrl) {
        return "file:///[homedir]";
      }
      return "[homedir]";
    }
    if (preferFileUrl) {
      return "file:///~";
    }
    return "~";
  },
};
const WELL_KNOWN_CWD = {
  name: "cwd",
  getReplacement: ({ preferFileUrl }) => {
    if (preferFileUrl) {
      return "file:///cwd()";
    }
    return "cwd()";
  },
};
const createWellKnownPackage = (name) => {
  return {
    name,
    getReplacement: () => name,
  };
};
export const createWellKnown = (name, replacement = name) => {
  return {
    name,
    getReplacement: () => replacement,
  };
};

export const createReplaceFilesystemWellKnownValues = ({
  rootDirectoryUrl,
  // for unit tests
  isWindows = process.platform === "win32",
  ancestorPackagesDisabled,
  ancestorPackagesRootDirectoryUrl = "file:///",
  homedirDisabled,
  cwdDisabled,
  cwdUrl,
  cwdPath = process.cwd(),
} = {}) => {
  const wellKownUrlArray = [];
  const wellKnownPathArray = [];
  const addWellKnownFileUrl = (url, wellKnown, { position = "end" } = {}) => {
    url = new URL(url);
    const urlWithoutTrailingSlash = String(removePathnameTrailingSlash(url));
    const wellKnownUrl = {
      url: urlWithoutTrailingSlash,
      replace: (string, { willBeWrittenOnFilesystem }) => {
        const replacement = wellKnown.getReplacement({
          preferFileUrl: false,
          willBeWrittenOnFilesystem,
        });
        return string.replaceAll(urlWithoutTrailingSlash, replacement);
      },
    };
    const path =
      String(url) === String(cwdUrl)
        ? cwdPath
        : urlToFileSystemPath(urlWithoutTrailingSlash);
    const windowPathRegex = new RegExp(
      `${escapeRegexpSpecialChars(path)}(((?:\\\\(?:[\\w !#()-]+|[.]{1,2})+)*)(?:\\\\)?)`,
      "gm",
    );
    const wellKnownPath = {
      path,
      replace: isWindows
        ? (string, { willBeWrittenOnFilesystem }) => {
            const replacement = wellKnown.getReplacement({
              willBeWrittenOnFilesystem,
            });
            return string.replaceAll(windowPathRegex, (match, after) => {
              return `${replacement}${after.replaceAll("\\", "/")}`;
            });
          }
        : (string, { willBeWrittenOnFilesystem }) => {
            const replacement = wellKnown.getReplacement({
              willBeWrittenOnFilesystem,
            });
            return string.replaceAll(path, replacement);
          },
    };
    if (position === "start") {
      wellKownUrlArray.unshift(wellKnownUrl);
      wellKnownPathArray.unshift(wellKnownPath);
    } else {
      wellKownUrlArray.push(wellKnownUrl);
      wellKnownPathArray.push(wellKnownPath);
    }
    return () => {
      const urlIndex = wellKownUrlArray.indexOf(wellKnownUrl);
      if (urlIndex > -1) {
        wellKownUrlArray.splice(urlIndex, 1);
      }
      const pathIndex = wellKnownPathArray.indexOf(wellKnownPath);
      if (pathIndex !== -1) {
        wellKnownPathArray.splice(pathIndex, 1);
      }
    };
  };
  if (rootDirectoryUrl) {
    addWellKnownFileUrl(rootDirectoryUrl, WELL_KNOWN_ROOT);
  }
  /*
   * When running code inside a node project ancestor packages
   * should make things super predictible because
   * it will use a package.json name field
   * to replace files urls
   * And uses the highest ancestor package so that even if the file
   * is executed once within a package then outside that package
   * the replace value remains predictible as the highest package is used
   * The highest package is used because it's pushed first by
   * addWellKnownFileUrl
   */
  ancestor_packages: {
    if (ancestorPackagesDisabled) {
      break ancestor_packages;
    }
    const ancestorPackages = [];
    const cwd = cwdPath || process.cwd();
    const cwdUrl = ensurePathnameTrailingSlash(pathToFileURL(cwd));
    for (const ancestorUrl of yieldAncestorUrls(
      cwdUrl,
      ancestorPackagesRootDirectoryUrl,
      { yieldSelf: true },
    )) {
      const packageFileUrl = new URL("package.json", ancestorUrl);
      const packageDirectoryUrl = ancestorUrl;
      let packageFileContent;
      try {
        packageFileContent = readFileSync(packageFileUrl);
      } catch (e) {
        if (e.code === "ENOENT") {
          continue;
        }
        throw e;
      }
      let packageObject;
      try {
        packageObject = JSON.parse(packageFileContent);
      } catch {
        continue;
      }
      const packageName = packageObject.name;
      ancestorPackages.unshift({
        packageDirectoryUrl,
        packageName,
      });
    }
    for (const ancestorPackage of ancestorPackages) {
      addWellKnownFileUrl(
        ancestorPackage.packageDirectoryUrl,
        createWellKnownPackage(ancestorPackage.packageName),
      );
    }
  }
  home_dir: {
    if (homedirDisabled) {
      break home_dir;
    }
    const homedirPath = homedir();
    const homedirUrl = pathToFileURL(homedirPath);
    addWellKnownFileUrl(homedirUrl, WELL_KNOWN_HOMEDIR);
  }
  process_cwd: {
    if (cwdDisabled) {
      break process_cwd;
    }
    // we fallback on process.cwd()
    // but it's brittle because a file might be execute from anywhere
    // so it should be the last resort
    cwdUrl = cwdUrl || pathToFileURL(cwdPath);
    addWellKnownFileUrl(cwdUrl, WELL_KNOWN_CWD);
  }

  const replaceFileUrls = (string, { willBeWrittenOnFilesystem }) => {
    for (const wellKownUrl of wellKownUrlArray) {
      string = wellKownUrl.replace(string, {
        willBeWrittenOnFilesystem,
      });
    }
    return string;
  };
  const replaceFilePaths = (string, { willBeWrittenOnFilesystem }) => {
    for (const wellKownPath of wellKnownPathArray) {
      string = wellKownPath.replace(string, {
        willBeWrittenOnFilesystem,
      });
    }
    return string;
  };

  const replaceFilesystemWellKnownValues = (
    string,
    { willBeWrittenOnFilesystem = true } = {},
  ) => {
    const isUrl = typeof string === "object" && typeof string.href === "string";
    if (isUrl) {
      string = string.href;
    }
    string = replaceFileUrls(string, { willBeWrittenOnFilesystem });
    string = replaceFilePaths(string, { willBeWrittenOnFilesystem });
    return string;
  };
  replaceFilesystemWellKnownValues.addWellKnownFileUrl = addWellKnownFileUrl;
  return replaceFilesystemWellKnownValues;
};
