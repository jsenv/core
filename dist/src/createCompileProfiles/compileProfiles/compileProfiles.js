"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compileProfiles = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var _createPlatformGroups = require("./createPlatformGroups.js");

var _composePlatformGroups = require("./composePlatformGroups.js");

var _createGetScoreForGroupTranspilationComplexity = require("./createGetScoreForGroupTranspilationComplexity.js");

var _splitGroups = require("./splitGroups.js");

var _createGetScoreForGroupCompatMap = require("./createGetScoreForGroupCompatMap.js");

var _statMapGeneric = require("./statMapGeneric.js");

// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
const PLATFORM_NAMES = ["chrome", "edge", "firefox", "safari", "node", "ios", "opera", "electron"];

const createGroupsForPlatforms = (compatMap, platformNames) => {
  const platformGroups = platformNames.map(platformName => (0, _createPlatformGroups.createPlatformGroups)(compatMap, platformName));
  const groups = (0, _composePlatformGroups.composePlatformGroups)(...platformGroups);
  return groups;
};

const sortGroupByComplexity = groups => {
  const getScoreForGroupTranspilationComplexity = (0, _createGetScoreForGroupTranspilationComplexity.createGetScoreForGroupTranspilationComplexity)();
  const sortedGroups = groups.sort((a, b) => getScoreForGroupTranspilationComplexity(a) - getScoreForGroupTranspilationComplexity(b));
  return sortedGroups;
};

const compileProfiles = ({
  stats = _statMapGeneric.statMapGeneric,
  compatMap = _projectStructureCompileBabel.compatMapBabel,
  size = 4,
  platformNames = PLATFORM_NAMES,
  moduleOutput,
  identify = false,
  pluginNames = Object.keys(compatMap)
} = {}) => {
  compatMap = (0, _projectStructureCompileBabel.getCompatMapSubset)(compatMap, pluginNames);
  compatMap = (0, _projectStructureCompileBabel.getCompatMapWithModule)(compatMap, moduleOutput);
  const groupsForPlatforms = createGroupsForPlatforms(compatMap, platformNames);
  const getScoreForGroupCompatMap = (0, _createGetScoreForGroupCompatMap.createGetScoreForGroupCompatMap)(stats);
  const groupsForPlatformsSubset = (0, _splitGroups.splitGroups)(groupsForPlatforms, ({
    compatMap
  }) => getScoreForGroupCompatMap(compatMap), size);
  const sortedGroups = sortGroupByComplexity(groupsForPlatformsSubset);
  const groupWithEverything = {
    pluginNames: Object.keys(compatMap),
    compatMap: {}
  };
  const profiles = sortedGroups;
  const fallback = groupWithEverything;

  if (identify) {
    profiles[0].id = "best";
    profiles.slice(1, -1).forEach((intermediateProfile, index) => {
      intermediateProfile.id = `intermediate-${index + 1}`;
    });
    profiles[profiles.length - 1].id = "worst";
    fallback.id = "otherwise";
  }

  return {
    profiles,
    fallback
  };
};

exports.compileProfiles = compileProfiles;
//# sourceMappingURL=compileProfiles.js.map