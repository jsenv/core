import { promises } from "node:fs";
import {
  fileSystemPathToUrl,
  urlToFileSystemPath,
  resolveUrl,
  isFileSystemPath,
} from "@jsenv/urls";

import { readEntryStat } from "../stat/read_entry_stat.js";
import { removeEntry } from "../remove/remove_entry.js";
import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { ensureParentDirectories } from "./ensure_parent_directories.js";
import { readSymbolicLink } from "./read_symbolic_link.js";

// https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fspromises_symlink_target_path_type
const { symlink } = promises;
const isWindows = process.platform === "win32";

/**
 * Writes a symbolic link pointing from a filesystem node to an other
 * @param {string} from Where symlink is written
 * @param {string} to The symlink target
 * @param {"file" | "dir"} [type] Symlink type if you know it before hand
 * @param {boolean} [allowUseless=false] Prevent error when symlink already exists with the same target
 * @param {boolean} [allowOverwrite=false] Will replace any existing symlink
 */
export const writeSymbolicLink = async ({
  from,
  to,
  type,
  allowUseless = false,
  allowOverwrite = false,
}) => {
  const fromUrl = assertAndNormalizeFileUrl(from);
  const toInfo = getToInfo(to, fromUrl);
  // Node.js doc at https://nodejs.org/api/fs.html#fssymlinktarget-path-type-callback
  // states the following:
  // "If the type argument is not set, Node.js will autodetect
  // target type and use 'file' or 'dir'"
  // In practice, if code don't specify "type" on windows, you later get EPERM errors
  // when doing operation on the symlink such as "fs.stat"
  if (isWindows && typeof type === "undefined") {
    const toStats = await readEntryStat(toInfo.url, {
      nullIfNotFound: true,
    });
    type = toStats && toStats.isDirectory() ? "dir" : "file";
  }
  const symbolicLinkPath = urlToFileSystemPath(fromUrl);
  try {
    await symlink(toInfo.value, symbolicLinkPath, type);
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(fromUrl);
      await symlink(toInfo.value, symbolicLinkPath, type);
      return;
    }
    if (error.code === "EEXIST") {
      if (allowUseless) {
        const existingSymbolicLinkUrl = await readSymbolicLink(fromUrl);
        if (existingSymbolicLinkUrl === toInfo.url) {
          return;
        }
      }
      if (allowOverwrite) {
        await removeEntry(fromUrl);
        await symlink(toInfo.value, symbolicLinkPath, type);
        return;
      }
    }
    throw error;
  }
};

const getToInfo = (to, fromUrl) => {
  if (typeof to === "string") {
    // absolute filesystem path
    if (isFileSystemPath(to)) {
      const url = fileSystemPathToUrl(to);
      const value = to;
      return {
        url,
        value,
      };
    }

    // relative url
    if (to.startsWith("./") || to.startsWith("../")) {
      const url = resolveUrl(to, fromUrl);
      const value = to;
      return {
        url,
        value,
      };
    }

    // absolute url
    const url = resolveUrl(to, fromUrl);
    const value = urlToFileSystemPath(url);
    return {
      url,
      value,
    };
  }

  if (to instanceof URL) {
    const url = String(to);
    const value = urlToFileSystemPath(url);
    return {
      url,
      value,
    };
  }

  throw new TypeError(
    `symbolic link to must be a string or an url, received ${to}`,
  );
};
