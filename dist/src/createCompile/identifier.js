"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.identifier = void 0;

var identifier = function identifier() {}; // import path from "path"
// const writeSourceLocation = ({ source, location }) => {
//   return `${source}
// //# sourceURL=${location}`
// }
// export const identifier = ({
//   rootLocation,
//   filename,
//   inputRelativeLocation,
//   outputRelativeLocation,
//   inputSource,
//   options,
// }) => {
//   if (options.identifyMethod === "relative") {
//     // client thinks we are at compiled/folder/file.js
//     const clientLocation = filename
//     // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
//     const serverLocation = path.resolve(rootLocation, outputRelativeLocation)
//     // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
//     const relativeLocation = path.relative(clientLocation, serverLocation)
//     return {
//       outputSource: writeSourceLocation({ source: inputSource, location: relativeLocation }),
//     }
//   }
//   if (options.identifyMethod === "absolute") {
//     // we will return /Users/dmail/rootLocation/relativeLocation
//     // we could also return https://ip:port/rootLocation/relativeLocation
//     const serverLocation = path.resolve(rootLocation, inputRelativeLocation)
//     return {
//       outputSource: writeSourceLocation({ source: inputSource, location: serverLocation }),
//     }
//   }
// }


exports.identifier = identifier;
//# sourceMappingURL=identifier.js.map