import { assert } from "@jsenv/assert";

import { startServer } from "@jsenv/server";
import { createObservable } from "@jsenv/server/src/interfacing_with_node/observable.js";
import {
  testServerCertificate,
  testServerCertificatePrivateKey,
} from "../../server/tests/test_certificate.js";

import { fetchUrl } from "@jsenv/fetch";

let serverResponsePromise;
const server = await startServer({
  logLevel: "warn",
  https: {
    certificate: testServerCertificate,
    privateKey: testServerCertificatePrivateKey,
  },
  keepProcessAlive: false,
  port: 8998,
  services: [
    {
      handleRequest: async () => {
        const response = await serverResponsePromise;
        return response;
      },
    },
  ],
});

// cancel request before response is found
{
  const abortController = new AbortController();
  serverResponsePromise = new Promise(() => {});
  const clientResponsePromise = fetchUrl(server.origin, {
    signal: abortController.signal,
  });
  abortController.abort();
  try {
    await clientResponsePromise;
    throw new Error("should throw");
  } catch (error) {
    const actual = error.name;
    const expect = "AbortError";
    assert({ actual, expect });
  }
}

// cancel request while server is responding
{
  const abortController = new AbortController();
  serverResponsePromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 200,
      });
    }, 1000);
  });
  const clientResponsePromise = fetchUrl(server.origin, {
    signal: abortController.signal,
    ignoreHttpsError: true,
  });
  try {
    setTimeout(() => {
      abortController.abort();
    }, 200);
    await clientResponsePromise;
    throw new Error("should throw");
  } catch (error) {
    const actual = error.name;
    const expect = "AbortError";
    assert({ actual, expect });
  }
}

// cancel request while body is written
{
  const abortController = new AbortController();
  serverResponsePromise = Promise.resolve({
    status: 200,
    body: createObservable(({ next }) => {
      next("Hello");
      // never call complete, response is pending
    }),
  });
  const clientResponsePromise = fetchUrl(server.origin, {
    signal: abortController.signal,
    ignoreHttpsError: true,
  });
  const response = await clientResponsePromise;
  try {
    setTimeout(() => {
      abortController.abort();
    });
    await response.text();
    throw new Error("should throw");
  } catch (error) {
    const actual = {
      name: error.name,
      type: error.type,
      message: error.message,
    };
    const expect = {
      name: "AbortError",
      type: "aborted",
      message: "The operation was aborted.",
    };
    assert({ actual, expect });
  }
}

// cancel after body is written
{
  const abortController = new AbortController();
  serverResponsePromise = Promise.resolve({
    status: 200,
    body: "Hello",
  });
  const clientResponsePromise = fetchUrl(server.origin, {
    signal: abortController.signal,
    ignoreHttpsError: true,
  });
  const response = await clientResponsePromise;
  const actual = await response.text();
  const expect = "Hello";
  assert({ actual, expect });
  abortController.abort();
}
