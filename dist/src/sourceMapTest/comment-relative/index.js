"use strict";

var fs = require("fs");
var vm = require("vm");

var filename = __dirname + "/build/file.es5.js";
var content = fs.readFileSync(filename).toString();

var script = new vm.Script(content, { filename: filename });

script.runInThisContext();
//# sourceMappingURL=index.js.map