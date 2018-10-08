"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertFileSystemErrorToResponseProperties = void 0;

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};

const convertFileSystemErrorToResponseProperties = error => {
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
  } // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)


  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      reason: "file is busy",
      headers: {
        "retry-after": 0.01 // retry in 10ms

      }
    };
  } // emfile means there is too many files currently opened


  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      reason: "too many file opened",
      headers: {
        "retry-after": 0.1 // retry in 100ms

      }
    };
  }

  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      reason: "Unexpected directory operation"
    };
  }

  return {
    status: 500,
    reason: "unknown file system error"
  };
};

exports.convertFileSystemErrorToResponseProperties = convertFileSystemErrorToResponseProperties;
//# sourceMappingURL=convertFileSystemErrorToResponseProperties.js.map