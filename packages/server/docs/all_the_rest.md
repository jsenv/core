# See also

## listenAnyIp

_listenAnyIp_ parameter is a boolean. When enabled server will be accessible by all machines connected to your network. This parameter is optional and disabled by default.

When you are on a secure internal network, you can enable this parameter to make your server accessible to other machine than yours.

## ip

_ip_ parameter is a string representing the ip server will listen. This parameter is optional with a default value of `"127.0.0.1"`.

## port

_port_ parameter is a number representing the port server will listen. This parameter is optional with a default value of `0`.

A value of `0` means server will listen to a random available port. In that case, if you want to know the listened port use [origin](#origin) value returned by startServer.

## portHint

_portHint_ parameter is a number representing the port you would like to listen. This parameter is optional without default value.

When _portHint_ is a number and _port_ is `0` server will try to listen _portHint_ if it's available, otherwise it will try the closest next port until it find an available port to listen.

## logLevel

_logLevel_ parameter is a string controlling how much logs server will write in the console. This parameters is optional with a default value of `"info"`.

— see [jsenv/jsenv-logger#logLevel](https://github.com/jsenv/jsenv-logger#logLevel)

## stopOnSIGINT

_stopOnSIGINT_ parameter is a boolean controlling if server stops itself when process SIGINT is occurs. This parameters is optional and enabled by default.

SIGINT occurs when you hit ctrl+c in your terminal for instance.

## stopOnExit

_stopOnSIGINT_ parameter is a boolean controlling if server stops itself when process exits. This parameters is optional and enabled by default.

## stopOnInternalError

_stopOnInternalError_ parameter is a boolean controlling if server stops itself when _requestToResponse_ throws an error. This parameter is optional and disabled by default.

## keepProcessAlive

_keepProcessAlive_ parameter is a boolean controlling if server keeps the process alive. This parameter is optional and enabled by default.

When false, if nothing keeps the process alive node process will end even if your server is still listening.

## requestWaitingCallback

_requestWaitingCallback_ parameter is a function called when a request is waiting for a long time. This parameter is optional with a default value logging a warning in the console.

## requestWaitingMs

_requestWaitingMs_ parameter is a number of milliseconds after which the request is considered as waiting. This parameter is optional with a default value of 20 seconds.

## startServer return value

```js
import { startServer } from "@jsenv/server"

const { origin, nodeServer, stop, stoppedPromise } = await startServer()
```

## origin

_origin_ is a string representing the url server is listening to.

An example value could be `"http://127.0.0.1:65289"`

## nodeServer

_nodeServer_ is the http_server instance used internally by the server. It exists in case you need to do something on the node server itself.

— see [http_server documentation on node.js](https://nodejs.org/api/http.html#http_class_http_server)

## stop

_stop_ is an async function asking server to be stopped.

Stop returns a promise resolved when server is completely stopped.

If you call stop without argument, promise is resolved with `STOP_REASON_NOT_SPECIFIED`, otherwise it is resolved with the value your provided.

## stoppedPromise

_stoppedPromise_ is a promise resolved when server is stopped. This promise is resolved with a reason explaining why server was stopped.

Each possible _reason_ is an object you can import like this:

```js
import {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGTERM,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_NOT_SPECIFIED,
} from "@jsenv/server"
```

_reason_ might also be a value you passed yourself.

```js
import { startServer } from "@jsenv/server"

const { stop, stoppedPromise } = await startServer()
stop(42)
const reason = await stoppedPromise
reason === 42 // true
```

If you call stop without passing any argument, _reason_ will be `STOP_REASON_NOT_SPECIFIED`.
