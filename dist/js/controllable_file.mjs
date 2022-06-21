import v8 from "node:v8";
import { u as uneval } from "./uneval.js";
import { performance, PerformanceObserver } from "node:perf_hooks";

const startObservingPerformances = () => {
  const measureEntries = []; // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html

  const perfObserver = new PerformanceObserver(( // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
  list) => {
    const perfMeasureEntries = list.getEntriesByType("measure");
    measureEntries.push(...perfMeasureEntries);
  });
  perfObserver.observe({
    entryTypes: ["measure"]
  });
  return async () => {
    // wait for node to call the performance observer
    await new Promise(resolve => {
      setTimeout(resolve);
    });
    performance.clearMarks();
    perfObserver.disconnect();
    return { ...readNodePerformance(),
      measures: measuresFromMeasureEntries(measureEntries)
    };
  };
};

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: performance.eventLoopUtilization()
  };
  return nodePerformance;
}; // remove getters that cannot be stringified


const asPlainObject = objectWithGetters => {
  const objectWithoutGetters = {};
  Object.keys(objectWithGetters).forEach(key => {
    objectWithoutGetters[key] = objectWithGetters[key];
  });
  return objectWithoutGetters;
};

const measuresFromMeasureEntries = measureEntries => {
  const measures = {}; // Sort to ensure measures order is predictable
  // It seems to be already predictable on Node 16+ but
  // it's not the case on Node 14.

  measureEntries.sort((a, b) => {
    return a.startTime - b.startTime;
  });
  measureEntries.forEach(( // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
  perfMeasureEntry) => {
    measures[perfMeasureEntry.name] = perfMeasureEntry.duration;
  });
  return measures;
};

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import": async ({
    fileUrl,
    collectPerformance
  }) => {
    const getNamespace = async () => {
      const namespace = await import(fileUrl);
      const namespaceResolved = {};
      await Promise.all([...Object.keys(namespace).map(async key => {
        const value = await namespace[key];
        namespaceResolved[key] = value;
      })]);
      return namespaceResolved;
    };

    if (collectPerformance) {
      const getPerformance = startObservingPerformances();
      const namespace = await getNamespace();
      const performance = await getPerformance();
      return {
        namespace,
        performance
      };
    }

    const namespace = await getNamespace();
    return {
      namespace
    };
  },
  "execute-using-require": async ({
    fileUrl
  }) => {
    const {
      createRequire
    } = await import("module");
    const {
      fileURLToPath
    } = await import("url");
    const filePath = fileURLToPath(fileUrl);

    const require = createRequire(fileUrl); // eslint-disable-next-line import/no-dynamic-require


    const namespace = require(filePath);

    const namespaceResolved = {};
    await Promise.all([...Object.keys(namespace).map(async key => {
      const value = await namespace[key];
      namespaceResolved[key] = value;
    })]);
    return namespaceResolved;
  }
};
const ACTION_REQUEST_EVENT_NAME = "action";
const ACTION_RESPONSE_EVENT_NAME = "action-result";
const ACTION_RESPONSE_STATUS_FAILED = "action-failed";
const ACTION_RESPONSE_STATUS_COMPLETED = "action-completed";

const sendActionFailed = error => {
  if (error.hasOwnProperty("toString")) {
    delete error.toString;
  }

  sendToParent(ACTION_RESPONSE_EVENT_NAME, // process.send algorithm does not send non enumerable values
  // so use @jsenv/uneval
  uneval({
    status: ACTION_RESPONSE_STATUS_FAILED,
    value: error
  }, {
    ignoreSymbols: true
  }));
};

const sendActionCompleted = value => {
  sendToParent(ACTION_RESPONSE_EVENT_NAME, // here we use JSON.stringify because we should not
  // have non enumerable value (unlike there is on Error objects)
  // otherwise uneval is quite slow to turn a giant object
  // into a string (and value can be giant when using coverage)
  JSON.stringify({
    status: ACTION_RESPONSE_STATUS_COMPLETED,
    value
  }));
};

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) {
    return;
  } // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.


  process.send({
    type,
    data
  });
};

const onceProcessMessage = (type, callback) => {
  const listener = event => {
    if (event.type === type) {
      // commenting line below keep this process alive
      removeListener(); // eslint-disable-next-line no-eval

      callback(eval(`(${event.data})`));
    }
  };

  const removeListener = () => {
    process.removeListener("message", listener);
  };

  process.on("message", listener);
  return removeListener;
};

const removeActionRequestListener = onceProcessMessage(ACTION_REQUEST_EVENT_NAME, async ({
  actionType,
  actionParams
}) => {
  const action = ACTIONS_AVAILABLE[actionType];

  if (!action) {
    sendActionFailed(new Error(`unknown action ${actionType}`));
    return;
  }

  let value;
  let failed = false;

  try {
    value = await action(actionParams);
  } catch (e) {
    failed = true;
    value = e;
  }

  if (process.env.NODE_V8_COVERAGE) {
    v8.takeCoverage(); // if (actionParams.stopCoverageAfterExecution) {
    //   v8.stopCoverage()
    // }
  } // setTimeout(() => {}, 100)


  if (failed) {
    sendActionFailed(value);
  } else {
    sendActionCompleted(value);
  } // removeActionRequestListener()


  if (actionParams.exitAfterAction) {
    removeActionRequestListener(); // for some reason this fixes v8 coverage directory sometimes empty on Ubuntu
    // process.exit()
  }
}); // remove listener to process.on('message')
// which is sufficient to let child process die
// assuming nothing else keeps it alive
// process.once("SIGTERM", removeActionRequestListener)
// process.once("SIGINT", removeActionRequestListener)

setTimeout(() => sendToParent("ready"));
