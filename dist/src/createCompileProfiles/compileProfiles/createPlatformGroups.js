"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createPlatformGroups = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

const createPlatformGroups = (compatMap, platformName) => {
  const platformVersions = Object.keys(compatMap).filter(pluginName => platformName in compatMap[pluginName]).map(pluginName => String(compatMap[pluginName][platformName])).concat("0.0.0") // at least version 0
  .filter((platformVersion, index, array) => array.indexOf(platformVersion) === index).sort(_projectStructureCompileBabel.versionCompare);
  const platformGroups = [];
  platformVersions.forEach(platformVersion => {
    const pluginNames = (0, _projectStructureCompileBabel.getPluginNamesForPlatform)(compatMap, platformName, platformVersion).sort();
    const existingGroup = platformGroups.find(platformGroup => {
      return platformGroup.pluginNames.join("") === pluginNames.join("");
    });

    if (existingGroup) {
      existingGroup.compatMap[platformName] = (0, _projectStructureCompileBabel.versionHighest)(existingGroup.compatMap[platformName], platformVersion);
    } else {
      platformGroups.push({
        pluginNames,
        compatMap: {
          [platformName]: platformVersion
        }
      });
    }
  });
  return platformGroups;
};

exports.createPlatformGroups = createPlatformGroups;
//# sourceMappingURL=createPlatformGroups.js.map