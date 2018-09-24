"use strict";

var childProcess = require("child_process");

childProcess.fork(__dirname + "/main.es5.js", {
  execArgv: ["--inspect-brk"]
});
//# sourceURL=/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/src/sourceMapTest/comment-absolute-filesystem/index.js
//# sourceMappingURL=/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/src/sourceMapTest/comment-absolute-filesystem/index.es5.js.map
//# sourceMappingURL=index.es5.js.map