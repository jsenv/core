# Lifecycle

```js
import { startServer } from "@jsenv/server";

const server = await startServer({ port: 3000 });
server.origin; // "http://localhost:3000"
server.origins; // { local: "http://localhost:3000", localip: "http://127.0.0.1:3000" }
server.port; // 3000
server.getStatus(); // "opened"
```

`startServer` resolves once the server listens. With `port: 0` (the default) the OS picks a free port, `server.port` tells which one; `portHint` asks for a port and takes the next free one when it is busy. `hostname` ("localhost" by default) can be an ip. `acceptAnyIp: true` listens on every interface so that other machines reach the server, at `server.origins.externalip`.

## Stopping

```js
await server.stop();
server.getStatus(); // "stopped"
```

`stop` closes the pending connections (a request still running is answered 503) and resolves once everything is closed. It takes a reason, anything, which `stoppedPromise` resolves with:

```js
import { startServer, STOP_REASON_PROCESS_SIGINT } from "@jsenv/server";

const server = await startServer();
server.stoppedPromise.then((reason) => {
  if (reason === STOP_REASON_PROCESS_SIGINT) {
    console.log("stopped by ctrl+c");
  }
});
```

The server stops by itself on SIGINT (`stopOnSIGINT`, off inside a cluster worker where the primary process is in charge) and on SIGHUP, SIGTERM, beforeExit, exit (`stopOnExit`); the reasons are the `STOP_REASON_PROCESS_*` exports. `stopOnInternalError` stops it when a route throws. The `signal` option cancels the start itself.

## Keeping the process alive

A listening server keeps the process alive. `keepProcessAlive: false` lets the process exit when nothing else runs — tests want that: the server stops on its own once the test is done.

## Running something as long as the server runs

```js
server.addEffect(() => {
  const interval = setInterval(doSomething, 1000);
  return () => {
    clearInterval(interval);
  };
});
```

The callback runs right away, the function it returns runs when the server stops. Plugins have `serverListening` and `serverStopped` hooks for the same purpose (see [plugins](./plugins.md)).
