/*
 * A net server accepting both http and tls on the same port: the first byte
 * of each connection tells which one it is (0x16 is a TLS handshake) and the
 * socket is handed to the matching http or tls server.
 * https://stackoverflow.com/a/42019773/2634179
 *
 * The http and tls servers are exposed as _httpServer/_tlsServer because
 * "request", "upgrade" and "clientError" are emitted on them, not on the net
 * server (see listen_request.js).
 */

import http from "node:http";
import net from "node:net";
import { listenEvent } from "./listen_event.js";
import { createSecureServer } from "./secure_server.js";

export const createPolyglotServer = async ({
  http2 = false,
  http1Allowed = true,
  certificate,
  privateKey,
}) => {
  const httpServer = http.createServer();
  const tlsServer = await createSecureServer({
    certificate,
    privateKey,
    http2,
    http1Allowed,
  });
  const netServer = net.createServer({
    allowHalfOpen: false,
  });

  listenEvent(netServer, "connection", (socket) => {
    detectSocketProtocol(socket, (protocol) => {
      if (protocol === "http") {
        httpServer.emit("connection", socket);
        return;
      }

      if (protocol === "tls") {
        tlsServer.emit("connection", socket);
        return;
      }

      const response = [
        `HTTP/1.1 400 Bad Request`,
        `Content-Length: 0`,
        "",
        "",
      ].join("\r\n");
      socket.write(response);
      socket.end();
      socket.destroy();
      netServer.emit(
        "clientError",
        new Error("protocol error, Neither http, nor tls"),
        socket,
      );
    });
  });

  netServer._httpServer = httpServer;
  netServer._tlsServer = tlsServer;

  return netServer;
};

const detectSocketProtocol = (socket, protocolDetectedCallback) => {
  const tryToRead = () => {
    const buffer = socket.read(1);
    if (buffer === null) {
      socket.once("readable", tryToRead);
      return;
    }

    const firstByte = buffer[0];
    socket.unshift(buffer);
    if (firstByte === 22) {
      protocolDetectedCallback("tls");
      return;
    }
    if (firstByte > 32 && firstByte < 127) {
      protocolDetectedCallback("http");
      return;
    }
    protocolDetectedCallback(null);
  };

  tryToRead();
};
