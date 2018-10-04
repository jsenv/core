"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createGetProfileForPlatform = exports.findProfileMatching = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

const findProfileForPlatform = (groups, platformName, platformVersion) => {
  const profileMatchingPlatform = groups.find(({
    compatMap
  }) => {
    if (platformName in compatMap === false) {
      return false;
    }

    const platformVersionForProfile = compatMap[platformName];
    return (0, _projectStructureCompileBabel.versionIsBelowOrEqual)(platformVersionForProfile, platformVersion);
  });
  return profileMatchingPlatform;
};

const findProfileMatching = ({
  profiles,
  fallback
}, predicate) => {
  return profiles.find(predicate) || fallback;
};

exports.findProfileMatching = findProfileMatching;

const createGetProfileForPlatform = ({
  profiles,
  fallback
}) => {
  return ({
    platformName,
    platformVersion
  }) => {
    return findProfileForPlatform(profiles, platformName, platformVersion) || fallback;
  };
};

exports.createGetProfileForPlatform = createGetProfileForPlatform;
//# sourceMappingURL=createGetProfileForPlatform.js.map