"use strict";

global.System = {};
global.System.register = function (stuff, callback) {
  var expose = function expose(name, value) {
    console.log("exported", value, "under", name);
  };
  var context = {};

  var result = callback(expose, context);

  result.execute();
};

var fs = require("fs");

var source = fs.readFileSync(__dirname + "/file.es5.js").toString();

eval(source);
//# sourceMappingURL=index.js.map