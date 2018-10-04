"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createGetScoreForGroupCompatMap = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

const createGetScoreFromVersionUsage = stats => {
  const versionNames = Object.keys(stats);

  if (versionNames.length === 0) {
    return () => null;
  }

  const sortedVersions = versionNames.sort((versionA, versionB) => (0, _projectStructureCompileBabel.versionIsBelow)(versionA, versionB));
  const highestVersion = sortedVersions.shift();
  return platformVersion => {
    if (platformVersion === highestVersion || (0, _projectStructureCompileBabel.versionIsAbove)(platformVersion, highestVersion)) {
      return stats[highestVersion];
    }

    const closestVersion = sortedVersions.find(version => {
      return platformVersion === version || (0, _projectStructureCompileBabel.versionIsAbove)(platformVersion, version);
    });
    return closestVersion ? stats[closestVersion] : null;
  };
};

const createGetScoreFromPlatformUsage = stats => {
  const platformNames = Object.keys(stats);
  const scoreMap = {};
  platformNames.forEach(platformName => {
    scoreMap[platformName] = createGetScoreFromVersionUsage(stats[platformName]);
  });
  return (platformName, platformVersion) => {
    if (platformName in scoreMap) {
      const versionUsage = scoreMap[platformName](platformVersion);
      return versionUsage === null ? stats.other : versionUsage;
    }

    return stats.other;
  };
};

const createGetScoreForGroupCompatMap = stats => {
  const getScoreFromPlatformUsage = createGetScoreFromPlatformUsage(stats);

  const getPlatformScore = (platformName, platformVersion) => {
    return getScoreFromPlatformUsage(platformName, platformVersion);
  };

  const getScore = groupCompatMap => {
    return Object.keys(groupCompatMap).reduce((previous, platformName) => {
      return previous + getPlatformScore(platformName, groupCompatMap[platformName]);
    }, 0);
  };

  return getScore;
};

exports.createGetScoreForGroupCompatMap = createGetScoreForGroupCompatMap;
//# sourceMappingURL=createGetScoreForGroupCompatMap.js.map