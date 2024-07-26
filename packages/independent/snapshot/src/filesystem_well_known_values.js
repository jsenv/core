import {
  ensurePathnameTrailingSlash,
  removePathnameTrailingSlash,
} from "@jsenv/urls";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  const addWellKnownFileUrl = (url, urlReplacement) => {
    const pathReplacement = urlReplacement.startsWith("file:///")
      ? urlReplacement.slice("file:///".length)
      : urlReplacement;
    const filesystemReplacement =
      pathReplacement === "~" ? "<homedir>" : pathReplacement;
    const urlWithoutTrailingSlash = removePathnameTrailingSlash(url);
    wellKownUrlArray.push({
      url: urlWithoutTrailingSlash,
      replace: (string, { stringType }) => {
        const replacement =
          stringType === "filesystem" ? filesystemReplacement : urlReplacement;
        return string.replaceAll(urlWithoutTrailingSlash, replacement);
      },
    });
    const path =
      url === cwdUrl ? cwdPath : fileURLToPath(urlWithoutTrailingSlash);
    const windowPathRegex = new RegExp(
      `${escapeRegexpSpecialChars(path)}(((?:\\\\(?:[\\w !#()-]+|[.]{1,2})+)*)(?:\\\\)?)`,
      "gm",
    );
    wellKnownPathArray.push({
      path,
      replace: isWindows
        ? (string, { stringType }) => {
            const replacement =
              stringType === "filesystem"
                ? filesystemReplacement
                : pathReplacement;
            return string.replaceAll(windowPathRegex, (match, after) => {
              return `${replacement}${after.replaceAll("\\", "/")}`;
            });
          }
        : (string, { stringType }) => {
            const replacement =
              stringType === "filesystem"
                ? filesystemReplacement
                : pathReplacement;
            return string.replaceAll(path, replacement);
          },
    });
  };

  if (rootDirectoryUrl) {
    addWellKnownFileUrl(rootDirectoryUrl, "file:///<root>");
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
    let currentUrl = cwdUrl;
    while (currentUrl.href !== ancestorPackagesRootDirectoryUrl) {
      const packageFileUrl = new URL("package.json", currentUrl);
      const packageDirectoryUrl = currentUrl;
      currentUrl = new URL(getParentUrl(currentUrl));
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
      } catch (e) {
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
        ancestorPackage.packageName,
      );
    }
  }
  home_dir: {
    if (homedirDisabled) {
      break home_dir;
    }
    const homedirPath = homedir();
    const homedirUrl = pathToFileURL(homedirPath);
    addWellKnownFileUrl(homedirUrl, "file:///~");
  }
  process_cwd: {
    if (cwdDisabled) {
      break process_cwd;
    }
    // we fallback on process.cwd()
    // but it's brittle because a file might be execute from anywhere
    // so it should be the last resort
    cwdUrl = cwdUrl || pathToFileURL(cwdPath);
    addWellKnownFileUrl(cwdUrl, "file:///cwd()");
  }

  const replaceFileUrls = (string, { stringType }) => {
    for (const wellKownUrl of wellKownUrlArray) {
      const replaceResult = wellKownUrl.replace(string, { stringType });
      if (replaceResult !== string) {
        return replaceResult;
      }
    }
    return string;
  };
  const replaceFilePaths = (string, { stringType }) => {
    for (const wellKownPath of wellKnownPathArray) {
      const replaceResult = wellKownPath.replace(string, { stringType });
      if (replaceResult !== string) {
        return replaceResult;
      }
    }
    return string;
  };

  return (string, { stringType } = {}) => {
    string = replaceFileUrls(string, { stringType });
    string = replaceFilePaths(string, { stringType });
    return string;
  };
};

const getParentUrl = (url) => {
  url = String(url);
  // With node.js new URL('../', 'file:///C:/').href
  // returns "file:///C:/" instead of "file:///"
  const resource = url.slice("file://".length);
  const slashLastIndex = resource.lastIndexOf("/");
  if (slashLastIndex === -1) {
    return url;
  }
  const lastCharIndex = resource.length - 1;
  if (slashLastIndex === lastCharIndex) {
    const slashBeforeLastIndex = resource.lastIndexOf("/", slashLastIndex - 1);
    if (slashBeforeLastIndex === -1) {
      return url;
    }
    return `file://${resource.slice(0, slashBeforeLastIndex + 1)}`;
  }

  return `file://${resource.slice(0, slashLastIndex + 1)}`;
};
