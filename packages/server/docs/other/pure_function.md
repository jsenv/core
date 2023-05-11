## Pure function

Write the server logic with declarative pure function(s).

_A pure middleware:_

```js
const pureMiddleware = (request) => {
  if (request.pathname !== "/") {
    return null;
  }

  const responseBody = "Hello world";
  return {
    status: 200,
    headers: {
      "content-type": "text-plain",
      "content-length": Buffer.byteLength(responseBody),
    },
    body: responseBody,
  };
};
```

_An express middleware:_

```js
const expressMiddleware = (request, response, next) => {
  if (request.path !== "/") {
    next();
    return;
  }

  const responseBody = "Hello world";
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain");
  res.setHeader("content-length", Buffer.byteLength(responseBody));
  res.end(responseBody);
};
```

A _pure middleware_ is called a _service_ in `@jsenv/server` terminology.
