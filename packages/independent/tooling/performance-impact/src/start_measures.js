import { emitWarning, memoryUsage, resourceUsage } from "node:process";
import v8 from "node:v8";
import { runInNewContext } from "node:vm";

export const startMeasures = ({
  duration = true, // will be in milliseconds
  memoryHeap = false,
  filesystem = false,
  gc = false,
} = {}) => {
  if (gc && !global.gc) {
    v8.setFlagsFromString("--expose_gc");
    global.gc = runInNewContext("gc");
    emitWarning(`node must be started with --expose-gc`, {
      CODE: "EXPOSE_GC_IS_MISSING",
      detail: "global.gc forced with v8.setFlagsFromString",
    });
  }

  const measures = [];
  if (duration) {
    const beforeMs = Date.now();
    measures.push(() => {
      const afterMs = Date.now();
      const duration = afterMs - beforeMs;
      return {
        duration,
      };
    });
  }
  if (filesystem) {
    const _internalFs = process.binding("fs");
    const restoreCallbackSet = new Set();
    let fsOpenCall = 0;
    let fsStatCall = 0;
    const methodEffects = {
      open: () => {
        fsOpenCall++;
      },
      openFileHandle: () => {
        fsOpenCall++;
      },
      stat: () => {
        fsStatCall++;
      },
      lstat: () => {
        fsStatCall++;
      },
      access: () => {
        fsStatCall++;
      },
    };
    for (const method of Object.keys(methodEffects)) {
      const previous = _internalFs[method];
      if (typeof previous !== "function") {
        continue;
      }
      _internalFs[method] = function (...args) {
        methodEffects[method](...args);
        return previous.call(this, ...args);
      };
      restoreCallbackSet.add(() => {
        _internalFs[method] = previous;
      });
    }
    const beforeRessourceUsage = resourceUsage();
    measures.push(() => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      const afterRessourceUsage = resourceUsage();
      const fsRead = afterRessourceUsage.fsRead - beforeRessourceUsage.fsRead;
      const fsWrite =
        afterRessourceUsage.fsWrite - beforeRessourceUsage.fsWrite;
      return {
        fsOpenCall,
        fsStatCall,
        fsRead,
        fsWrite,
      };
    });
  }

  if (memoryHeap) {
    if (gc) {
      global.gc();
    }
    const beforeMemoryUsage = memoryUsage();
    measures.push(() => {
      if (gc) {
        global.gc();
      }
      const afterMemoryUsage = memoryUsage();
      return {
        // total means "allocated"
        memoryHeapTotal:
          afterMemoryUsage.heapTotal - beforeMemoryUsage.heapTotal,
        memoryHeapUsed: afterMemoryUsage.heapUsed - beforeMemoryUsage.heapUsed,
        external: afterMemoryUsage.external - beforeMemoryUsage.external,
        rss: afterMemoryUsage.rss - beforeMemoryUsage.rss,
        arrayBuffers:
          afterMemoryUsage.arrayBuffers - beforeMemoryUsage.arrayBuffers,
      };
    });
  }

  const stop = () => {
    let metrics = {};
    measures.forEach((measure) => {
      metrics = {
        ...metrics,
        ...measure(),
      };
    });
    return metrics;
  };

  return { stop };
};
