import { chmodSync } from "node:fs";

import { assertAndNormalizeFileUrl } from "../../path_and_url/file_url_validation.js";
import { permissionsToBinaryFlags } from "./permissions.js";

export const writeEntryPermissionsSync = (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  let binaryFlags;
  if (typeof permissions === "object") {
    permissions = {
      owner: {
        read: getPermissionOrComputeDefault("read", "owner", permissions),
        write: getPermissionOrComputeDefault("write", "owner", permissions),
        execute: getPermissionOrComputeDefault("execute", "owner", permissions),
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions),
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault(
          "execute",
          "others",
          permissions,
        ),
      },
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }

  chmodSync(new URL(sourceUrl), binaryFlags);
};

const actionLevels = { read: 0, write: 1, execute: 2 };
const subjectLevels = { others: 0, group: 1, owner: 2 };

const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];
    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }

    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(
      (actionFallbackCandidate) =>
        actionLevels[actionFallbackCandidate] > actionLevel &&
        actionFallbackCandidate in subjectPermissions,
    );
    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }

  const subjectLevel = subjectLevels[subject];
  // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?
  const subjectFallback = Object.keys(subjectLevels).find(
    (subjectFallbackCandidate) =>
      subjectLevels[subjectFallbackCandidate] > subjectLevel &&
      subjectFallbackCandidate in permissions,
  );
  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions
      ? subjectPermissions[action]
      : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }

  return false;
};
