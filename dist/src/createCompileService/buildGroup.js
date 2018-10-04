"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildGroup = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var stringifyGroups = function stringifyGroups(groups) {
  var lightGroups = groups.map(function (group) {
    return {
      id: group.id,
      pluginNames: group.pluginNames,
      compatMap: group.compatMap
    };
  });
  return JSON.stringify(lightGroups, null, "  ");
};

var buildGroup = function buildGroup(_ref) {
  var root = _ref.root,
      _ref$into = _ref.into,
      into = _ref$into === void 0 ? "group.config.json" : _ref$into;

  var _createGetGroupForPla = (0, _projectStructureCompileBabel.createGetGroupForPlatform)({
    moduleOutput: "systemjs"
  }),
      getGroupForPlatform = _createGetGroupForPla.getGroupForPlatform,
      getAllGroup = _createGetGroupForPla.getAllGroup;

  var groups = getAllGroup();
  var sortedGroups = groups.sort(function (a, b) {
    return b.pluginNames.length - a.pluginNames.length;
  }).reverse();
  sortedGroups[0].id = "ideal";
  sortedGroups[1].id = "best";
  sortedGroups.slice(2, -1).forEach(function (intermediateGroup, index) {
    intermediateGroup.id = "intermediate-".concat(index + 1);
  });
  sortedGroups[sortedGroups.length - 2].id = "worst";
  sortedGroups[sortedGroups.length - 1].id = "otherwise";
  (0, _projectStructureCompileBabel.writeFileFromString)("".concat(root, "/").concat(into), stringifyGroups(groups));
  return {
    groups: groups,
    getGroupIdForPlatform: function getGroupIdForPlatform(_ref2) {
      var platformName = _ref2.platformName,
          platformVersion = _ref2.platformVersion;
      return getGroupForPlatform({
        platformName: platformName,
        platformVersion: platformVersion
      }).id;
    },
    getPluginsFromGroupId: function getPluginsFromGroupId(groupId) {
      return groups.find(function (group) {
        return group.id === groupId;
      }).plugins;
    }
  };
};

exports.buildGroup = buildGroup;
//# sourceMappingURL=buildGroup.js.map