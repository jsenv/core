import { startDevServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate();

const server = await startDevServer({
  logLevel: "info",
  port: 3467,
  https: { certificate, privateKey },
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
});

console.log(
  `${server.origin}/recording/client/gif_encoder_dev/gif_encoder_dev.html
${server.origin}/recording/client/gif_encoder_jsenv_dev/gif_encoder_jsenv_dev.html
${server.origin}/recording/client/xterm_dev.html`,
);
