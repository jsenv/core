"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createGetScoreForGroupTranspilationComplexity = void 0;

const createGetScoreForGroupTranspilationComplexity = () => {
  const getPluginTranpilationComplexity = () => 1;

  const getGroupTranspilationComplexityScore = group => group.pluginNames.reduce((previous, pluginName) => previous + getPluginTranpilationComplexity(pluginName), 0);

  return getGroupTranspilationComplexityScore;
};

exports.createGetScoreForGroupTranspilationComplexity = createGetScoreForGroupTranspilationComplexity;
//# sourceMappingURL=createGetScoreForGroupTranspilationComplexity.js.map