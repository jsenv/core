"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openBrowserServer = void 0;

var _openCompileServer = require("../openCompileServer/openCompileServer.js");

var _openServer = require("../openServer/openServer.js");

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

const getClientScript = ({
  compileURL,
  url
}) => {
  const fileRelativeToRoot = url.pathname.slice(1);
  return `window.System.import("${compileURL}/${fileRelativeToRoot}")`;
};

const openBrowserServer = ({
  root,
  port = 0
}) => {
  return (0, _openCompileServer.openCompileServer)({
    url: `http://127.0.0.1:0`,
    rootLocation: root
  }).then(server => {
    console.log(`compiling ${root} at ${server.url}`);
    return (0, _openServer.openServer)({
      url: `http://127.0.0.1:${port}`
    }).then(runServer => {
      runServer.addRequestHandler(request => {
        if (request.url.pathname === "/") {// on voudrait ptet servir du html
          // pour expliquer comment run les fichier etc
        }

        return (0, _createHTMLForBrowser.createHTMLForBrowser)({
          script: getClientScript({
            compileURL: server.compileURL,
            url: request.url
          })
        }).then(html => {
          return {
            status: 200,
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(html),
              "cache-control": "no-store"
            },
            body: html
          };
        });
      });
      console.log(`executing ${root} at ${runServer.url}`);
      return runServer;
    });
  });
};

exports.openBrowserServer = openBrowserServer;
//# sourceMappingURL=openBrowserServer.js.map