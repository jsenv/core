"use strict";

var http = require("http");

var server = http.createServer();

server.on("request", function (request, response) {
  var sourceMapContent = "\n\n\t";

  response.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": Buffer.byteLength(sourceMapContent)
  });
  response.end(sourceMapContent);
});
//# sourceMappingURL=index.js.map