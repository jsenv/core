import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";
import {
  testServerCertificate,
  testServerCertificatePrivateKey,
} from "@jsenv/server/tests/test_certificate.js";

// http1 server
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    https: {
      certificate: testServerCertificate,
      privateKey: testServerCertificatePrivateKey,
    },
    services: [
      {
        handleRequest: () => {
          return {
            status: 200,
            body: "Welcome, HTTPS user!",
          };
        },
      },
    ],
  });

  // 301 on http
  {
    const serverHttpOriginUrl = new URL(server.origin);
    serverHttpOriginUrl.protocol = "http";
    const serverHttpOrigin = serverHttpOriginUrl.href.slice(0, -1);
    const response = await fetchUrl(`${serverHttpOrigin}/file.js?page=2`, {
      redirect: "manual",
    });
    const actual = {
      status: response.status,
      headers: headersToObject(response.headers),
      body: await response.text(),
    };
    const expect = {
      status: 301,
      headers: {
        "connection": "keep-alive",
        "date": actual.headers.date,
        "keep-alive": "timeout=5",
        "location": `${server.origin}/file.js?page=2`,
        "transfer-encoding": "chunked",
      },
      body: "",
    };
    assert({ actual, expect });
  }

  // 200 in https
  {
    const response = await fetchUrl(`${server.origin}`, {
      ignoreHttpsError: true,
    });
    const actual = {
      status: response.status,
      body: await response.text(),
    };
    const expect = {
      status: 200,
      body: "Welcome, HTTPS user!",
    };
    assert({ actual, expect });
  }
}

// http2 server
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    https: {
      certificate: testServerCertificate,
      privateKey: testServerCertificatePrivateKey,
    },
    http2: true,
    services: [
      {
        handleRequest: () => {
          return {
            status: 200,
            body: "Welcome, HTTPS user!",
          };
        },
      },
    ],
  });

  // 301 on http
  {
    const serverHttpOriginUrl = new URL(server.origin);
    serverHttpOriginUrl.protocol = "http";
    const serverHttpOrigin = serverHttpOriginUrl.href.slice(0, -1);
    const response = await fetchUrl(`${serverHttpOrigin}`, {
      redirect: "manual",
    });
    const actual = {
      status: response.status,
      headers: headersToObject(response.headers),
      body: await response.text(),
    };
    const expect = {
      status: 301,
      headers: {
        "connection": "keep-alive",
        "date": actual.headers.date,
        "keep-alive": "timeout=5",
        "location": `${server.origin}/`,
        "transfer-encoding": "chunked",
      },
      body: "",
    };
    assert({ actual, expect });
  }

  // 200 in https
  {
    const response = await fetchUrl(`${server.origin}`, {
      ignoreHttpsError: true,
    });
    const actual = {
      status: response.status,
      body: await response.text(),
    };
    const expect = {
      status: 200,
      body: "Welcome, HTTPS user!",
    };
    assert({ actual, expect });
  }
}

// redirection disabled, no http request received
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    https: {
      certificate: testServerCertificate,
      privateKey: testServerCertificatePrivateKey,
    },
    redirectHttpToHttps: false,
  });

  // no response on http
  {
    const serverHttpOriginUrl = new URL(server.origin);
    serverHttpOriginUrl.protocol = "http";
    const serverHttpOrigin = serverHttpOriginUrl.href.slice(0, -1);
    try {
      await fetchUrl(serverHttpOrigin, { redirect: "manual" });
      throw new Error("should throw");
    } catch (e) {
      const actual = {
        code: e.code,
        message: e.message,
      };
      const expect = {
        code: "ECONNRESET",
        message: `request to ${serverHttpOrigin}/ failed, reason: socket hang up`,
      };
      assert({ actual, expect });
    }
  }
}

// allowHttpRequestOnHttps enabled (means we want to handle http request)
{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    https: {
      certificate: testServerCertificate,
      privateKey: testServerCertificatePrivateKey,
    },
    allowHttpRequestOnHttps: true,
    services: [
      {
        handleRequest: (request) => {
          return {
            status: 200,
            headers: {
              "content-type": "text/plain",
            },
            body: request.origin,
          };
        },
      },
    ],
  });

  // request origin is http on http request
  {
    const serverHttpOriginUrl = new URL(server.origin);
    serverHttpOriginUrl.protocol = "http";
    const serverHttpOrigin = serverHttpOriginUrl.href.slice(0, -1);
    const response = await fetchUrl(serverHttpOrigin);
    const actual = {
      status: response.status,
      body: await response.text(),
    };
    const expect = {
      status: 200,
      body: serverHttpOrigin,
    };
    assert({ actual, expect });
  }

  // request origin is https on https requests
  {
    const response = await fetchUrl(server.origin, { ignoreHttpsError: true });
    const actual = {
      status: response.status,
      body: await response.text(),
    };
    const expect = {
      status: 200,
      body: server.origin,
    };
    assert({ actual, expect });
  }
}
