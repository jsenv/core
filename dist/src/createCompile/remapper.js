"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.remapper = void 0;

const writeSourceMapLocation = ({
  source,
  location
}) => {
  return `${source}
//# sourceMappingURL=${location}`;
};

const remapper = ({
  inputSource,
  inputSourceMap,
  options,
  outputSourceMapName
}) => {
  if (typeof inputSourceMap !== "object" || inputSourceMap === null) {
    return null;
  } // delete inputSourceMap.sourcesContent
  // we could remove sources content, they can be fetched from server
  // removing them will decrease size of sourceMap BUT force
  // the client to fetch the source resulting in an additional http request
  // we could delete inputSourceMap.sourceRoot to ensure clientLocation is absolute
  // but it's not set anyway because not passed to babel during compilation
  // force a browser reload


  delete inputSourceMap.sourcesContent;

  if (options.remapMethod === "inline") {
    const mapAsBase64 = new Buffer(JSON.stringify(inputSourceMap)).toString("base64");
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`
    });
    return {
      outputSource
    };
  }

  if (options.remapMethod === "comment") {
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: `./${outputSourceMapName}`
    });
    return {
      outputSource
    };
  }

  return null;
};

exports.remapper = remapper;
//# sourceMappingURL=remapper.js.map