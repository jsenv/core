"use strict";

// simulate what System.import is doing on nodejs
// aka getting the file content and evaluating it

var fs = require("fs");

var source = fs.readFileSync(__dirname + "/file.es5.js").toString();(0, eval)(source);
//# sourceMappingURL=main.js.map