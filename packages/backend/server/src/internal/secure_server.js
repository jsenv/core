// The imports are dynamic so that "node:http2" / "node:https" are only parsed
// when a secure server is actually created.
export const createSecureServer = async ({
  certificate,
  privateKey,
  http2,
  http1Allowed,
}) => {
  if (http2) {
    const { createSecureServer } = await import("node:http2");
    return createSecureServer({
      cert: certificate,
      key: privateKey,
      allowHTTP1: http1Allowed,
    });
  }
  const { createServer } = await import("node:https");
  return createServer({
    cert: certificate,
    key: privateKey,
  });
};
