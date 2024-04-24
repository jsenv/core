export const analyseFunction = (fn) => {
  const fnSource = String(fn);

  arrow: {
    if (fnSource.startsWith("(")) {
      return {
        ...defaultResult,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
      };
    }
    const arrowAsyncMatch = fnSource.match(/^async\s+\(/);
    if (arrowAsyncMatch) {
      return {
        ...defaultResult,
        type: "arrow",
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true,
      };
    }
  }
  classes: {
    if (fnSource.startsWith("class ")) {
      return {
        ...defaultResult,
        type: "class",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("{")),
      };
    }
  }
  classic: {
    const classicAsyncGeneratorMatch = fnSource.match(/^async\s+function\s*\*/);
    if (classicAsyncGeneratorMatch) {
      return {
        ...defaultResult,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true,
        isGenerator: true,
      };
    }
    const classicAsyncMatch = fnSource.match(/^async\s+function/);
    if (classicAsyncMatch) {
      return {
        ...defaultResult,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isAsync: true,
      };
    }
    const classicGeneratorMatch = fnSource.match(/^function\s*\*/);
    if (classicGeneratorMatch) {
      return {
        ...defaultResult,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
        isGenerator: true,
      };
    }
    if (fnSource.startsWith("function")) {
      return {
        ...defaultResult,
        type: "classic",
        name: fn.name,
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
      };
    }
  }
  method: {
    if (fnSource.startsWith("get ")) {
      return {
        ...defaultResult,
        type: "method",
        getterName: fn.name.slice("get ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
      };
    }
    if (fnSource.startsWith("set ")) {
      return {
        ...defaultResult,
        type: "method",
        setterName: fn.name.slice("set ".length),
        argsAndBodySource: fnSource.slice(fnSource.indexOf("(")),
      };
    }
    const methodComputedAsyncGeneratorMatch = fnSource.match(
      /^async\s+\*\s*\[([\s\S]*?)\]\s*\(/,
    );
    if (methodComputedAsyncGeneratorMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(
          methodComputedAsyncGeneratorMatch[0].length - 1,
        ),
        isAsync: true,
        isGenerator: true,
      };
    }
    const methodComputedAsyncMatch = fnSource.match(
      /^async\s+\[([\s\S]*?)\]\s*\(/,
    );
    if (methodComputedAsyncMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedAsyncMatch[1],
        argsAndBodySource: fnSource.slice(
          methodComputedAsyncMatch[0].length - 1,
        ),
        isAsync: true,
      };
    }
    const methodComputedMatch = fnSource.match(/^\[([\s\S]*?)\]\s*\(/);
    if (methodComputedMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodNameIsComputed: true,
        methodName: methodComputedMatch[1],
        argsAndBodySource: fnSource.slice(methodComputedMatch[0].length - 1),
      };
    }
    const methodAsyncGeneratorMatch = fnSource.match(
      /^async\s+\*\s*([\S]+)\s*\(/,
    );
    if (methodAsyncGeneratorMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodName: methodAsyncGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(
          methodAsyncGeneratorMatch[0].length - 1,
        ),
        isAsync: true,
        isGenerator: true,
      };
    }
    const methodAsyncMatch = fnSource.match(/^async\s+([\S]+)\s*\(/);
    if (methodAsyncMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodName: methodAsyncMatch[1],
        argsAndBodySource: fnSource.slice(methodAsyncMatch[0].length - 1),
        isAsync: true,
        methodAsyncMatch,
      };
    }
    const methodGeneratorMatch = fnSource.match(/^\*\s*([\S]+)\s*\(/);
    if (methodGeneratorMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodName: methodGeneratorMatch[1],
        argsAndBodySource: fnSource.slice(methodGeneratorMatch[0].length - 1),
        isGenerator: true,
      };
    }
    const methodMatch = fnSource.match(/^([\S]+)\s*\(/);
    if (methodMatch) {
      return {
        ...defaultResult,
        type: "method",
        methodName: methodMatch[1],
        argsAndBodySource: fnSource.slice(methodMatch[0].length - 1),
      };
    }
  }

  return defaultResult;
};

const defaultResult = {
  type: "", // "classic", "method", "arrow", "class"
  name: "",
  methodNameIsComputed: false,
  methodName: "",
  getterName: "",
  setterName: "",
  isAsync: false,
  isGenerator: false,
  argsAndBodySource: "",
};
