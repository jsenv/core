import { assert } from "@jsenv/assert";
import {
  createFileSystemFetch,
  jsenvServiceRequestAliases,
  startServer,
} from "@jsenv/server";

let resourceBeforeAlias;
let resource;
const server = await startServer({
  logLevel: "error",
  keepProcessAlive: false,
  services: [
    jsenvServiceRequestAliases({
      "/alias.json": "/data.json",
      "/*.js": "/file.js",
      "/dir/*": "/dir/a.txt",
      "/*/deep/*.js": "/*/deep/file.js",
    }),
    {
      routes: [
        {
          endpoint: "GET *",
          fetch: (request, helpers) => {
            resourceBeforeAlias = request.original
              ? request.original.resource
              : undefined;
            resource = request.resource;
            return createFileSystemFetch(import.meta.resolve("./"))(
              request,
              helpers,
            );
          },
        },
      ],
    },
  ],
});

{
  const response = await fetch(`${server.origin}/src/deep/whatever.js`);
  const actual = {
    resourceBeforeAlias,
    resource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  };
  const expect = {
    resourceBeforeAlias: "/src/deep/whatever.js",
    resource: "/src/deep/file.js",
    status: 200,
    headers: {
      "content-type": "text/javascript",
    },
  };
  assert({ actual, expect });
}

{
  const response = await fetch(`${server.origin}/alias.json?foo=foo&test=1`);
  const actual = {
    resourceBeforeAlias,
    resource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  };
  const expect = {
    resourceBeforeAlias: "/alias.json?foo=foo&test=1",
    resource: "/data.json?foo=foo&test=1",
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  };
  assert({ actual, expect });
}

{
  const response = await fetch(`${server.origin}/diuei.js`);
  const actual = {
    resourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  };
  const expect = {
    resourceBeforeAlias: "/diuei.js",
    status: 200,
    headers: {
      "content-type": "text/javascript",
    },
  };
  assert({ actual, expect });
}

{
  const response = await fetch(`${server.origin}/diuei.js/`);
  const actual = {
    resourceBeforeAlias,
    status: response.status,
  };
  const expect = {
    resourceBeforeAlias: undefined,
    status: 404,
  };
  assert({ actual, expect });
}

{
  const response = await fetch(`${server.origin}/dir/toto`);
  const actual = {
    resourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  };
  const expect = {
    resourceBeforeAlias: "/dir/toto",
    status: 200,
    headers: {
      "content-type": "text/plain",
    },
  };
  assert({ actual, expect });
}

server.stop();
