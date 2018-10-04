"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompileProfiles = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var _compileProfiles = require("./compileProfiles/compileProfiles.js");

var _createGetProfileForPlatform = require("./createGetProfileForPlatform.js");

const stringifyResult = ({
  profiles,
  fallback
}) => {
  return JSON.stringify([...profiles, fallback], null, "  ");
};

const createCompileProfiles = ({
  root,
  into = "group.config.json"
}) => {
  return Promise.resolve().then(() => {
    const result = (0, _compileProfiles.compileProfiles)({
      moduleOutput: "systemjs",
      identify: true
    });
    (0, _projectStructureCompileBabel.writeFileFromString)(`${root}/${into}`, stringifyResult(result));
    const getProfileForPlatform = (0, _createGetProfileForPlatform.createGetProfileForPlatform)(result);
    return {
      getGroupIdForPlatform: (...args) => getProfileForPlatform(...args).id,
      getPluginsFromGroupId: groupId => {
        const profile = (0, _createGetProfileForPlatform.findProfileMatching)(result, profile => profile.id === groupId);
        return (0, _projectStructureCompileBabel.getPluginsFromNames)(profile.pluginNames);
      }
    };
  });
};

exports.createCompileProfiles = createCompileProfiles;
//# sourceMappingURL=createCompileProfiles.js.map