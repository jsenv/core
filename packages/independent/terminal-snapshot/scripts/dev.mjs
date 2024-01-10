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
  `open ${server.origin}/video_recording/client/gif_encoder_dev/gif_encoder_dev.html`,
);
