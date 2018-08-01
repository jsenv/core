// simulate what System.import is doing on nodejs
// aka getting the file content and evaluating it

var fs = require("fs");

var source = fs.readFileSync(`${__dirname}/file.es5.js`).toString();(0, eval)(source);
//# sourceURL=/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/src/sourceMapTest/comment-absolute-filesystem/main.js
//# sourceMappingURL=/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/src/sourceMapTest/comment-absolute-filesystem/main.es5.js.map