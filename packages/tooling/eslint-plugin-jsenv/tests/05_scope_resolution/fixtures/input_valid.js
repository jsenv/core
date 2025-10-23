// Valid: function name reused in different scope (dynamic import)
export const createSecureServer = async ({ certificate, privateKey }) => {
  const { createSecureServer } = await import("https");
  return createSecureServer({
    cert: certificate,
    key: privateKey,
  });
};
