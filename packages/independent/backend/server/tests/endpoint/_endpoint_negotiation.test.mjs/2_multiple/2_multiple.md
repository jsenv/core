# [2_multiple](../../endpoint_negotiation.test.mjs#L132)

```js
const routes = [
  {
    endpoint: "GET /users",
    availableContentTypes: ["application/json", "text/plain"],
    availableLanguages: ["fr", "en"],
    response: (request, { contentNegotiation }) => {
      const message =
        contentNegotiation.language === "fr" ? "Bonjour" : "Hello";
      if (contentNegotiation.contentType === "application/json") {
        return Response.json({ message });
      }
      return new Response(message);
    },
  },
];
return {
  "GET users accepting css and language DE": await run({
    routes,
    method: "GET",
    path: "/users",
    headers: {
      "accept": "text/css",
      "accept-language": "de",
    },
  }),
  "GET users accepting text and language FR": await run({
    routes,
    method: "GET",
    path: "/users",
    headers: {
      "accept": "text/plain",
      "accept-language": "fr",
    },
  }),
};
```

# 1/2 logs
  <details>
  <summary>details</summary>

![img](log_group.svg)

<details>
  <summary>see without style</summary>

```console
GET http://127.0.0.1/users
  406 Not Acceptable
(node:38768) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGHUP listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at _addListener (node:events:598:17)
    at process.addListener (node:events:616:10)
    at SIGHUP (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:18:13)
    at @jsenv/core/packages/independent/shared/abort/src/callback_race.js:26:25
    at Array.forEach (<anonymous>)
    at raceCallbacks (@jsenv/core/packages/independent/shared/abort/src/callback_race.js:24:32)
    at raceProcessTeardownEvents (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:4:10)
    at @jsenv/core/packages/independent/backend/server/src/start_server.js:193:14
(node:38768) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at _addListener (node:events:598:17)
    at process.addListener (node:events:616:10)
    at SIGTERM (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:27:13)
    at @jsenv/core/packages/independent/shared/abort/src/callback_race.js:26:25
    at Array.forEach (<anonymous>)
    at raceCallbacks (@jsenv/core/packages/independent/shared/abort/src/callback_race.js:24:32)
    at raceProcessTeardownEvents (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:4:10)
    at @jsenv/core/packages/independent/backend/server/src/start_server.js:193:14
(node:38768) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGINT listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at _addListener (node:events:598:17)
    at process.addListener (node:events:616:10)
    at SIGINT (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:54:13)
    at @jsenv/core/packages/independent/shared/abort/src/callback_race.js:26:25
    at Array.forEach (<anonymous>)
    at raceCallbacks (@jsenv/core/packages/independent/shared/abort/src/callback_race.js:24:32)
    at raceProcessTeardownEvents (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:4:10)
    at @jsenv/core/packages/independent/backend/server/src/start_server.js:193:14
(node:38768) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 beforeExit listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at _addListener (node:events:598:17)
    at process.addListener (node:events:616:10)
    at beforeExit (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:36:13)
    at @jsenv/core/packages/independent/shared/abort/src/callback_race.js:26:25
    at Array.forEach (<anonymous>)
    at raceCallbacks (@jsenv/core/packages/independent/shared/abort/src/callback_race.js:24:32)
    at raceProcessTeardownEvents (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:4:10)
    at @jsenv/core/packages/independent/backend/server/src/start_server.js:193:14
(node:38768) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 exit listeners added to [process]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at _addListener (node:events:598:17)
    at process.addListener (node:events:616:10)
    at exit (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:45:13)
    at @jsenv/core/packages/independent/shared/abort/src/callback_race.js:26:25
    at Array.forEach (<anonymous>)
    at raceCallbacks (@jsenv/core/packages/independent/shared/abort/src/callback_race.js:24:32)
    at raceProcessTeardownEvents (@jsenv/core/packages/independent/shared/abort/src/process_teardown_events.js:4:10)
    at @jsenv/core/packages/independent/backend/server/src/start_server.js:193:14
```

</details>


</details>

# 2/2 resolve

```js
{
  "GET users accepting css and language DE": {
    "status": 406,
    "headers": {
      "available-content-types": "application/json, text/plain",
      "available-languages": "fr, en",
      "content-type": "text/plain;charset=UTF-8",
      "date": "<X>",
      "connection": "keep-alive",
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked"
    },
    "body": "The server cannot produce a response in a format acceptable to the client:\n- content-type The server cannot produce a response in any of the content types accepted by the request: \"text/css\".\nAvailable content types: application/json, text/plain\n- language The server cannot produce a response in any of the languages accepted by the request: \"de\".\nAvailable languages: fr, en"
  },
  "GET users accepting text and language FR": {
    "status": 200,
    "headers": {
      "content-type": "text/plain;charset=UTF-8",
      "vary": "accept",
      "date": "<X>",
      "connection": "keep-alive",
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked"
    },
    "body": "Bonjour"
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>
