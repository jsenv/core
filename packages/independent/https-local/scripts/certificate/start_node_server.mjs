import { requestCertificate } from "@jsenv/https-local";
import { createServer } from "node:https";

const { certificate, privateKey } = requestCertificate({
  altNames: ["localhost", "local.example"],
});

const server = createServer(
  {
    cert: certificate,
    key: privateKey,
  },
  (request, response) => {
    const body = "Hello world";
    response.writeHead(200, {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(body),
    });
    response.write(body);
    response.end();
  },
);
server.listen(8080);
console.log(`Server listening at https://local.example:8080`);
