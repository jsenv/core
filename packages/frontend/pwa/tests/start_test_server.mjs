import { startDevServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

export const startTestServer = async (rest) => {
  const { certificate, privateKey } = requestCertificate();
  const testServer = await startDevServer({
    logLevel: "warn",
    https: { certificate, privateKey },
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    clientAutoreload: false,
    supervisor: false,
    ...rest,
  });
  return testServer;
};
