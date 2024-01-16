# logger

Control verbosity of logs during a function execution.

[![npm package](https://img.shields.io/npm/v/@jsenv/humanize.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/humanize)

You want to use `@jsenv/humanize` when you have many logs with different purposes and controls which type of logs are actually written.

## createLogger

`createLogger` is a function receiving a `logLevel` and returning a `logger` object.

```js
import { createLogger } from "@jsenv/humanize";

const functionWithLogs = ({ logLevel }) => {
  const logger = createLogger({ logLevel });

  logger.debug("start doing whetevr");
  logger.info("some useful info");
  logger.debug("doing whatever is done");
  logger.warn("be careful about blah-blah");
  logger.error("oops an error occured while doing whatever");
};

functionWithLogs({ logLevel: "debug" });
functionWithLogs({ logLevel: "info" });
functionWithLogs({ logLevel: "warn" });
functionWithLogs({ logLevel: "error" });
functionWithLogs({ logLevel: "off" });
```

### logLevel

`logLevel` parameter is a string controlling verbosity of the returned `logger`.

The possible logLevel values are:

- `"off"`
- `"debug"`
- `"info"`
- `"warn"`
- `"error"`

If you are rigorous, each logLevel value is exported as a constant that you can use like this:

```js
import { createLogger, LOG_LEVEL_INFO } from "@jsenv/humanize";

createLogger({ logLevel: LOG_LEVEL_INFO });
```

## logger

`logger` is an object with methods logging a message with a given level.<br />
It is returned by `createLogger`, and has the following shape: `{ debug, info, warn, error }`. Each method calls the corresponding console method or do nothing depending on the `logLevel`.

```js
import { createLogger } from "@jsenv/humanize";

const logger = createLogger({ logLevel: "info" });
logger.debug("hello");
```

Logs nothing

```js
import { createLogger } from "@jsenv/humanize";

const logger = createLogger({ logLevel: "info" });
logger.info("hello");
```

Logs `Hello`

## Migration from console

Using `@jsenv/humanize` means converting console methods into logger methods. `console.info` becomes `logger.info` and so on.

But keep in mind there is no `logger.log`. This is because a log level named "log" would not fit into the log level hierachy below.

```
error > warn > info > debug
```

It means you have to convert `console.log` into `logger.debug` or `logger.info`.
