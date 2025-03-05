import {
  createFileSystemFetch,
  jsenvServiceErrorHandler,
  startServer,
} from "@jsenv/server";

export const startFileServer = ({
  rootDirectoryUrl,
  debug = false,
  canUseLongTermCache = () => false,
  services = [],
  ...rest
}) => {
  return startServer({
    logLevel: debug ? "info" : "error",
    keepProcessAlive: debug,
    port: debug ? 9777 : 0,
    services: [
      ...services,
      jsenvServiceErrorHandler({ sendErrorDetails: true }),
    ],
    routes: [
      {
        endpoint: "GET *",
        response: createFileSystemFetch(rootDirectoryUrl, {
          canReadDirectory: true,
          cacheControl: (request) =>
            canUseLongTermCache(request)
              ? `private,max-age=3600,immutable` // 1hour
              : "private,max-age=0,must-revalidate",
        }),
      },
    ],
    ...rest,
  });
};
