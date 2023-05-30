# CORS

Cross origin resource sharing, also called CORS are disabled by default. They can be enabled using [jsenvServiceCORS](#jsenvServiceCORS)

```js
import { startServer, jsenvServiceCORS } from "@jsenv/server";

await startServer({
  services: [
    jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
  ],
});
```

## jsenvServiceCORS

This service ensure CORS headers **are always set**.
It's important to always set CORS headers, even on unexpected errors (500), or browser agents rightfully assumes CORS are disabled.

```js
import fetch from "node-fetch";
import {
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server";

const server = await startServer({
  services: [
    jsenvServiceErrorHandler(),
    jsenvServiceCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
    {
      handleRequest: () => {
        throw new Error("test");
      },
    },
  ],
});

const response = await fetch(server.origin);
response.headers.has("access-control-allow-origin"); // true
```

## accessControlAllowedOrigins

_accessControlAllowedOrigins_ parameter is an array of origins allowed when requesting your server. This parameter is optional with a default value of `[]`.

## accessControlAllowedMethods

_accessControlAllowedMethods_ parameter is an array or methods allowed when requesting your server. This parameter is optional with a default value of `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`

## accessControlAllowedHeaders

_accessControlAllowedHeaders_ parameter is an array of headers allowed when requesting your server. This parameter is optional with a default value of `["x-requested-with"]`.

## accessControlAllowRequestOrigin

_accessControlAllowRequestOrigin_ parameter is a boolean controlling if request origin is auto allowed. This parameter is optional and disabled by default.

Use this parameter to allow any origin.

## accessControlAllowRequestMethod

_accessControlAllowRequestMethod_ parameter is a boolean controlling if request method is auto allowed. This parameter is optional and disabled by default.

Use this parameter to allowed any request method.

## accessControlAllowRequestHeaders

_accessControlAllowRequestHeaders_ parameter is a boolean controlling if request headers are auto allowed. This parameter is optional and disabled by default.

Use this parameter to allowed any request headers.

## accessControlAllowCredentials

_accessControlAllowCredentials_ parameter is a boolean controlling if request credentials are allowed when requesting your server. This parameter is optional and disabled by default.

## accessControlMaxAge

_accessControlMaxAge_ parameter is a number representing an amount of seconds that can be used by client to cache access control headers values. This parameter is optional with a default value of `600`.
