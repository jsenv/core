export const normalizeHeaderName = (headerName) => {
  headerName = String(headerName);
  if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};
