import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";
import { startServer } from "@jsenv/server";
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
    routes: [
      {
        endpoint: "GET *",
        fetch: () => {
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
    const response = await fetch(`${serverHttpOrigin}/file.js?page=2`, {
      redirect: "manual",
    });
    const actual = {
      status: response.status,
      headers: Object.fromEntries(response.headers),
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

  server.stop();
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
    routes: [
      {
        endpoint: "GET *",
        fetch: () => {
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
    const response = await fetch(`${serverHttpOrigin}`, {
      redirect: "manual",
    });
    const actual = {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    };
    const expect = {
      status: 301,
      headers: {
        "connection": "keep-alive",
        "date": assert.any(String),
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

  server.stop();
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
      await fetch(serverHttpOrigin, { redirect: "manual" });
      throw new Error("should throw");
    } catch (e) {
      const actual = {
        cause: e.cause,
        message: e.message,
      };
      const expect = {
        cause: assert.any(Error),
        message: `fetch failed`,
      };
      assert({ actual, expect });
    }
  }

  server.stop();
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
    routes: [
      {
        endpoint: "GET *",
        fetch: (request) => {
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
    const response = await fetch(serverHttpOrigin);
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

  server.stop();
}
