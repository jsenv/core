"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.composeGroups = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const composePluginNames = (pluginList, secondPluginList) => {
  return [...pluginList, ...secondPluginList.filter(plugin => pluginList.indexOf(plugin) === -1)];
};

const groupReducer = (previous, group) => {
  const pluginNames = composePluginNames(previous.pluginNames, group.pluginNames).sort();
  const previousCompatMap = previous.compatMap;
  const groupCompatMap = group.compatMap;

  const compatMap = _objectSpread({}, previousCompatMap);

  Object.keys(groupCompatMap).forEach(platformName => {
    const platformVersion = groupCompatMap[platformName];
    compatMap[platformName] = String(platformName in compatMap ? (0, _projectStructureCompileBabel.versionHighest)(compatMap[platformName], platformVersion) : platformVersion);
  });
  return {
    pluginNames,
    compatMap
  };
};

const composeGroups = (...groups) => {
  return groups.reduce(groupReducer, {
    pluginNames: [],
    compatMap: {}
  });
};

exports.composeGroups = composeGroups;
//# sourceMappingURL=composeGroups.js.map