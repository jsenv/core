// The file path belongs to the server machine: it joins the status text only
// when the server was started with canExposeSensitiveData.
export const convertFileSystemErrorToResponseProperties = (
  error,
  { canExposeSensitiveData },
) => {
  const location = canExposeSensitiveData ? ` at ${error.path}` : "";
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: `EACCES: No permission to read file${location}`,
    };
  }
  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: `EPERM: No permission to read file${location}`,
    };
  }
  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: `ENOENT: File not found${location}`,
    };
  }
  // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)
  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: `EBUSY: File is busy${location}`,
      headers: {
        "retry-after": 0.01, // retry in 10ms
      },
    };
  }
  // emfile means there is too many files currently opened
  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "EMFILE: too many file opened",
      headers: {
        "retry-after": 0.1, // retry in 100ms
      },
    };
  }
  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: `EISDIR: Unexpected directory operation${location}`,
    };
  }
  return null;
};

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};
