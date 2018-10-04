"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.composePlatformGroups = void 0;

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const platformGroupReducer = (previous, platformGroup) => {
  const groups = [];
  previous.forEach(firstPlatformGroup => {
    groups.push({
      pluginNames: firstPlatformGroup.pluginNames.slice(),
      compatMap: _objectSpread({}, firstPlatformGroup.compatMap)
    });
  });
  platformGroup.forEach(secondPlatformGroup => {
    const pluginNames = secondPlatformGroup.pluginNames;
    const existingGroup = groups.find(platformGroup => {
      return pluginNames.join("") === platformGroup.pluginNames.join("");
    });

    if (existingGroup) {
      existingGroup.compatMap = _objectSpread({}, existingGroup.compatMap, secondPlatformGroup.compatMap);
    } else {
      groups.push({
        pluginNames: secondPlatformGroup.pluginNames.slice(),
        compatMap: _objectSpread({}, secondPlatformGroup.compatMap)
      });
    }
  });
  return groups;
};

const composePlatformGroups = (...platformGroups) => {
  return platformGroups.reduce(platformGroupReducer, []);
};

exports.composePlatformGroups = composePlatformGroups;
//# sourceMappingURL=composePlatformGroups.js.map