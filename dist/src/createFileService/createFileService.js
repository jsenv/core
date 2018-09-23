"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createFileService = exports.convertFileSystemErrorToResponseProperties = undefined;

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _os = require("os");

var _os2 = _interopRequireDefault(_os);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _url = require("url");

var _helpers = require("../createCompileService/helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var mimetype = function mimetype(pathname) {
  var defaultMimetype = "application/octet-stream";

  var mimetypes = {
    // text
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    appcache: "text/cache-manifest",
    // application
    js: "application/javascript",
    json: "application/json",
    map: "application/json",
    xml: "application/xml",
    gz: "application/x-gzip",
    zip: "application/zip",
    pdf: "application/pdf",
    // image
    png: "image/png",
    gif: "image/gif",
    jpg: "image/jpeg",
    // audio
    mp3: "audio/mpeg"
  };

  var suffix = _path2["default"].extname(pathname).slice(1);
  if (suffix in mimetypes) {
    return mimetypes[suffix];
  }

  return defaultMimetype;
};

var isErrorWithCode = function isErrorWithCode(error, code) {
  return typeof error === "object" && error.code === code;
};

var convertFileSystemErrorToResponseProperties = exports.convertFileSystemErrorToResponseProperties = function convertFileSystemErrorToResponseProperties(error) {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      reason: "no permission to read file"
    };
  }

  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      reason: "no permission to read file"
    };
  }

  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      reason: "file not found"
    };
  }

  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      reason: "file is busy",
      headers: {
        "retry-after": 0.01 // retry in 10ms
      }
    };
  }

  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      reason: "too many file opened",
      headers: {
        "retry-after": 0.1 // retry in 100ms
      }
    };
  }

  return {
    status: 500,
    reason: "unknown file system error"
  };
};

var stat = function stat(location) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].stat(location, function (error, stat) {
      if (error) {
        reject(convertFileSystemErrorToResponseProperties(error));
      } else {
        resolve(stat);
      }
    });
  });
};

var readFile = function readFile(location) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].readFile(location, function (error, buffer) {
      if (error) {
        reject(convertFileSystemErrorToResponseProperties(error));
      } else {
        resolve(String(buffer));
      }
    });
  });
};

var listDirectoryContent = function listDirectoryContent(location) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].readdir(location, function (error, ressourceNames) {
      if (error) {
        reject(error);
      } else {
        resolve(ressourceNames);
      }
    });
  });
};

var createFileService = exports.createFileService = function createFileService() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$include = _ref.include,
      include = _ref$include === undefined ? function () {
    return true;
  } : _ref$include,
      _ref$locate = _ref.locate,
      locate = _ref$locate === undefined ? function (_ref2) {
    var url = _ref2.url;
    return url;
  } : _ref$locate,
      _ref$canReadDirectory = _ref.canReadDirectory,
      canReadDirectory = _ref$canReadDirectory === undefined ? false : _ref$canReadDirectory;

  return function (_ref3) {
    var method = _ref3.method,
        url = _ref3.url,
        requestHeaders = _ref3.headers;

    if (!include(url)) {
      return false;
    }

    var status = void 0;
    var reason = void 0;
    var headers = {};
    var body = void 0;

    headers["cache-control"] = "no-store";

    var promise = void 0;

    if (method === "GET" || method === "HEAD") {
      promise = Promise.resolve(locate({ method: method, url: url })).then(function (fileURL) {
        fileURL = new _url.URL(fileURL);
        // since https://github.com/nodejs/node/pull/10739
        // fs methods supports url as path
        // otherwise keep in mind that
        // new URL('file:///path/to/file.js').pathname returns 'path/to/file.js' on MAC
        // new URL('file:///C:/path/to/file.js').pathname returns '/C:/path/to/file.js' on WINDOWS
        // in order words you have to remove the leading '/' on windows
        // it does not work let's go path removing leading '/' on windows
        // const fileLocation = fileURL.toString()
        var fileLocation = _os2["default"].platform() === "win32" ? fileURL.pathname.slice(1) : fileURL.pathname;

        var cachedModificationDate = void 0;
        if (requestHeaders.has("if-modified-since")) {
          try {
            cachedModificationDate = new Date(requestHeaders.get("if-modified-since"));
          } catch (e) {
            status = 400;
            reason = "if-modified-since header is not a valid date";
            return {
              status: status,
              reason: reason,
              headers: headers,
              body: body
            };
          }
        }

        return stat(fileLocation).then(function (stat) {
          var actualModificationDate = stat.mtime;

          headers["last-modified"] = actualModificationDate.toUTCString();

          if (stat.isDirectory()) {
            if (canReadDirectory === false) {
              status = 403;
              reason = "not allowed to read directory";
              return;
            }

            return listDirectoryContent(fileLocation).then(JSON.stringify).then(function (directoryListAsJSON) {
              status = 200;
              headers["content-type"] = "application/json";
              headers["content-length"] = directoryListAsJSON.length;
              body = directoryListAsJSON;
            });
          }

          if (cachedModificationDate && Number(cachedModificationDate) < Number(actualModificationDate)) {
            status = 304;
            return;
          }

          headers["content-length"] = stat.size;

          var cachedETag = requestHeaders.get("if-none-match");
          if (cachedETag) {
            return readFile(fileLocation).then(function (content) {
              var eTag = (0, _helpers.createETag)(content);
              if (cachedETag === eTag) {
                status = 304;
              } else {
                status = 200;
                headers["content-type"] = mimetype(url.pathname);
                headers.ETag = eTag;
                body = content;
              }
            });
          }

          status = 200;
          headers["content-type"] = mimetype(url.pathname);
          body = _fs2["default"].createReadStream(fileLocation);
        }, function (_ref4) {
          var responseStatus = _ref4.status,
              responseReason = _ref4.reason,
              _ref4$headers = _ref4.headers,
              responseHeaders = _ref4$headers === undefined ? {} : _ref4$headers,
              responseBody = _ref4.body;

          status = responseStatus;
          reason = responseReason;
          Object.assign(headers, responseHeaders);
          body = responseBody;
          return Promise.resolve();
        });
      });
    } else {
      status = 501;
      promise = Promise.resolve();
    }

    return promise.then(function () {
      return {
        status: status,
        reason: reason,
        headers: headers,
        body: body
      };
    });
  };
};
//# sourceMappingURL=createFileService.js.map