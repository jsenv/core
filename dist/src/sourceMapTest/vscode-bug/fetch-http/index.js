"use strict";

var http = require("http");
var fs = require("fs");

var server = http.createServer();

server.on("request", function (request, response) {
  var sourceMapContent = fs.readFileSync(__dirname + "/file.es5.js.map").toString();

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(sourceMapContent)
  });
  console.log("serving source map to", request.url);
  response.end(sourceMapContent);
});

server.listen(8567, "127.0.0.1", function (error) {
  if (error) {
    throw error;
  } else {
    require("./file.es5.js");
  }
});
//# sourceMappingURL=index.js.map