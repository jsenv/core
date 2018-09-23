"use strict";

var http = require("http");
var fs = require("fs");
var vm = require("vm");

var server = http.createServer();

server.on("request", function (request, response) {
  var sourceMapContent = fs.readFileSync(__dirname + "/compiled/file.es5.js.map").toString();

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(sourceMapContent)
  });
  console.log("serving source map to", request.url);
  response.end(sourceMapContent);
});

var port = 8567;
server.listen(port, "127.0.0.1", function (error) {
  if (error) {
    throw error;
  } else {
    var concreteFilename = __dirname + "/build/file.es5.js/file.es5.js";
    var content = fs.readFileSync(concreteFilename).toString();

    var script = new vm.Script(content, { filename: "http://127.0.0.1:" + port + "/compiled/file.js" });

    script.runInThisContext();
  }
});
//# sourceMappingURL=index.js.map