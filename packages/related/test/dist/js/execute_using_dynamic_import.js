import { writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { PerformanceObserver, performance } from "node:perf_hooks";

// https://developer.mozilla.org/en-US/docs/Glossary/Primitive

const isComposite = (value) => {
  if (value === null) {
    return false
  }

  const type = typeof value;
  if (type === "object") {
    return true
  }

  if (type === "function") {
    return true
  }

  return false
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();

const getCompositeGlobalPath = (value) => compositeWellKnownMap.get(value);

const getPrimitiveGlobalPath = (value) => primitiveWellKnownMap.get(value);

const visitGlobalObject = (value) => {
  const visitValue = (value, path) => {
    if (isComposite(value)) {
      // prevent infinite recursion
      if (compositeWellKnownMap.has(value)) {
        return
      }
      compositeWellKnownMap.set(value, path);

      const visitProperty = (property) => {
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          if (e.name === "SecurityError") {
            return
          }
          throw e
        }

        if (!descriptor) {
          // it's apparently possible to have getOwnPropertyNames returning
          // a property that later returns a null descriptor
          // for instance window.showModalDialog in webkit 13.0
          return
        }

        // do not trigger getter/setter
        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, [...path, property]);
        }
      };

      Object.getOwnPropertyNames(value).forEach((name) => visitProperty(name));
      Object.getOwnPropertySymbols(value).forEach((symbol) => visitProperty(symbol));
    }

    primitiveWellKnownMap.set(value, path);
    return
  };

  visitValue(value, []);
};

if (typeof window === "object") visitGlobalObject(window);

if (typeof global === "object") visitGlobalObject(global);

/**
 * transforms a javascript value into an object describing it.
 *
 */


const decompose = (mainValue, { functionAllowed, prototypeStrict, ignoreSymbols }) => {
  const valueMap = {};
  const recipeArray = [];

  const valueToIdentifier = (value, path = []) => {
    if (!isComposite(value)) {
      const existingIdentifier = identifierForPrimitive(value);
      if (existingIdentifier !== undefined) {
        return existingIdentifier
      }
      const identifier = identifierForNewValue(value);
      recipeArray[identifier] = primitiveToRecipe(value);
      return identifier
    }

    if (typeof Promise === "function" && value instanceof Promise) {
      throw new Error(createPromiseAreNotSupportedMessage({ path }))
    }
    if (typeof WeakSet === "function" && value instanceof WeakSet) {
      throw new Error(createWeakSetAreNotSupportedMessage({ path }))
    }
    if (typeof WeakMap === "function" && value instanceof WeakMap) {
      throw new Error(createWeakMapAreNotSupportedMessage({ path }))
    }
    if (typeof value === "function" && !functionAllowed) {
      throw new Error(createForbiddenFunctionMessage({ path }))
    }

    const existingIdentifier = identifierForComposite(value);
    if (existingIdentifier !== undefined) {
      return existingIdentifier
    }
    const identifier = identifierForNewValue(value);

    const compositeGlobalPath = getCompositeGlobalPath(value);
    if (compositeGlobalPath) {
      recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
      return identifier
    }

    const propertyDescriptionArray = [];
    Object.getOwnPropertyNames(value).forEach((propertyName) => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
      const propertyNameIdentifier = valueToIdentifier(propertyName, [...path, propertyName]);
      const propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
      propertyDescriptionArray.push({ propertyNameIdentifier, propertyDescription });
    });

    const symbolDescriptionArray = [];
    if (!ignoreSymbols) {
      Object.getOwnPropertySymbols(value).forEach((symbol) => {
        const propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
        const symbolIdentifier = valueToIdentifier(symbol, [...path, `[${symbol.toString()}]`]);
        const propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
        symbolDescriptionArray.push({ symbolIdentifier, propertyDescription });
      });
    }

    const methodDescriptionArray = computeMethodDescriptionArray(value, path);

    const extensible = Object.isExtensible(value);

    recipeArray[identifier] = createCompositeRecipe({
      propertyDescriptionArray,
      symbolDescriptionArray,
      methodDescriptionArray,
      extensible,
    });
    return identifier
  };

  const computePropertyDescription = (propertyDescriptor, propertyNameOrSymbol, path) => {
    if (propertyDescriptor.set && !functionAllowed) {
      throw new Error(createForbiddenPropertySetterMessage({ path, propertyNameOrSymbol }))
    }
    if (propertyDescriptor.get && !functionAllowed) {
      throw new Error(createForbiddenPropertyGetterMessage({ path, propertyNameOrSymbol }))
    }

    return {
      configurable: propertyDescriptor.configurable,
      writable: propertyDescriptor.writable,
      enumerable: propertyDescriptor.enumerable,
      getIdentifier:
        "get" in propertyDescriptor
          ? valueToIdentifier(propertyDescriptor.get, [
              ...path,
              String(propertyNameOrSymbol),
              "[[descriptor:get]]",
            ])
          : undefined,
      setIdentifier:
        "set" in propertyDescriptor
          ? valueToIdentifier(propertyDescriptor.set, [
              ...path,
              String(propertyNameOrSymbol),
              "[[descriptor:set]]",
            ])
          : undefined,
      valueIdentifier:
        "value" in propertyDescriptor
          ? valueToIdentifier(propertyDescriptor.value, [
              ...path,
              String(propertyNameOrSymbol),
              "[[descriptor:value]]",
            ])
          : undefined,
    }
  };

  const computeMethodDescriptionArray = (value, path) => {
    const methodDescriptionArray = [];

    if (typeof Set === "function" && value instanceof Set) {
      const callArray = [];
      value.forEach((entryValue, index) => {
        const entryValueIdentifier = valueToIdentifier(entryValue, [
          ...path,
          `[[SetEntryValue]]`,
          index,
        ]);
        callArray.push([entryValueIdentifier]);
      });
      methodDescriptionArray.push({ methodNameIdentifier: valueToIdentifier("add"), callArray });
    }

    if (typeof Map === "function" && value instanceof Map) {
      const callArray = [];
      value.forEach((entryValue, entryKey) => {
        const entryKeyIdentifier = valueToIdentifier(entryKey, [
          ...path,
          "[[MapEntryKey]]",
          entryKey,
        ]);
        const entryValueIdentifier = valueToIdentifier(entryValue, [
          ...path,
          "[[MapEntryValue]]",
          entryValue,
        ]);
        callArray.push([entryKeyIdentifier, entryValueIdentifier]);
      });
      methodDescriptionArray.push({ methodNameIdentifier: valueToIdentifier("set"), callArray });
    }

    return methodDescriptionArray
  };

  const identifierForPrimitive = (value) => {
    return Object.keys(valueMap).find((existingIdentifier) => {
      const existingValue = valueMap[existingIdentifier];
      if (Object.is(value, existingValue)) return true
      return value === existingValue
    })
  };

  const identifierForComposite = (value) => {
    return Object.keys(valueMap).find((existingIdentifier) => {
      const existingValue = valueMap[existingIdentifier];
      return value === existingValue
    })
  };

  const identifierForNewValue = (value) => {
    const identifier = nextIdentifier();
    valueMap[identifier] = value;
    return identifier
  };

  let currentIdentifier = -1;
  const nextIdentifier = () => {
    const identifier = String(parseInt(currentIdentifier) + 1);
    currentIdentifier = identifier;
    return identifier
  };

  const mainIdentifier = valueToIdentifier(mainValue);

  // prototype, important to keep after the whole structure was visited
  // so that we discover if any prototype is part of the value
  const prototypeValueToIdentifier = (prototypeValue) => {
    // prototype is null
    if (prototypeValue === null) {
      return valueToIdentifier(prototypeValue)
    }

    // prototype found somewhere already
    const prototypeExistingIdentifier = identifierForComposite(prototypeValue);
    if (prototypeExistingIdentifier !== undefined) {
      return prototypeExistingIdentifier
    }

    // mark prototype as visited
    const prototypeIdentifier = identifierForNewValue(prototypeValue);

    // prototype is a global reference ?
    const prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);
    if (prototypeGlobalPath) {
      recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
      return prototypeIdentifier
    }

    // otherwise prototype is unknown
    if (prototypeStrict) {
      throw new Error(createUnknownPrototypeMessage({ prototypeValue }))
    }

    return prototypeValueToIdentifier(Object.getPrototypeOf(prototypeValue))
  };
  const identifierForValueOf = (value, path = []) => {
    if (value instanceof Array) {
      return valueToIdentifier(value.length, [...path, "length"])
    }

    if ("valueOf" in value === false) {
      return undefined
    }

    if (typeof value.valueOf !== "function") {
      return undefined
    }

    const valueOfReturnValue = value.valueOf();
    if (!isComposite(valueOfReturnValue)) {
      return valueToIdentifier(valueOfReturnValue, [...path, "valueOf()"])
    }

    if (valueOfReturnValue === value) {
      return undefined
    }

    throw new Error(createUnexpectedValueOfReturnValueMessage())
  };

  recipeArray.slice().forEach((recipe, index) => {
    if (recipe.type === "composite") {
      const value = valueMap[index];

      if (typeof value === "function") {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value,
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return
      }

      if (value instanceof RegExp) {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value,
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return
      }

      // valueOf, mandatory to uneval new Date(10) for instance.
      recipe.valueOfIdentifier = identifierForValueOf(value);
      const prototypeValue = Object.getPrototypeOf(value);
      recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
    }
  });

  return {
    recipeArray,
    mainIdentifier,
    valueMap,
  }
};

const primitiveToRecipe = (value) => {
  if (typeof value === "symbol") {
    return symbolToRecipe(value)
  }

  return createPimitiveRecipe(value)
};

const symbolToRecipe = (symbol) => {
  const globalSymbolKey = Symbol.keyFor(symbol);
  if (globalSymbolKey !== undefined) {
    return createGlobalSymbolRecipe(globalSymbolKey)
  }

  const symbolGlobalPath = getPrimitiveGlobalPath(symbol);
  if (!symbolGlobalPath) {
    throw new Error(createUnknownSymbolMessage({ symbol }))
  }

  return createGlobalReferenceRecipe(symbolGlobalPath)
};

const createPimitiveRecipe = (value) => {
  return {
    type: "primitive",
    value,
  }
};

const createGlobalReferenceRecipe = (path) => {
  const recipe = {
    type: "global-reference",
    path,
  };
  return recipe
};

const createGlobalSymbolRecipe = (key) => {
  return {
    type: "global-symbol",
    key,
  }
};

const createCompositeRecipe = ({
  prototypeIdentifier,
  valueOfIdentifier,
  propertyDescriptionArray,
  symbolDescriptionArray,
  methodDescriptionArray,
  extensible,
}) => {
  return {
    type: "composite",
    prototypeIdentifier,
    valueOfIdentifier,
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible,
  }
};

const createPromiseAreNotSupportedMessage = ({ path }) => {
  if (path.length === 0) {
    return `promise are not supported.`
  }

  return `promise are not supported.
promise found at: ${path.join("")}`
};

const createWeakSetAreNotSupportedMessage = ({ path }) => {
  if (path.length === 0) {
    return `weakSet are not supported.`
  }

  return `weakSet are not supported.
weakSet found at: ${path.join("")}`
};

const createWeakMapAreNotSupportedMessage = ({ path }) => {
  if (path.length === 0) {
    return `weakMap are not supported.`
  }

  return `weakMap are not supported.
weakMap found at: ${path.join("")}`
};

const createForbiddenFunctionMessage = ({ path }) => {
  if (path.length === 0) {
    return `function are not allowed.`
  }

  return `function are not allowed.
function found at: ${path.join("")}`
};

const createForbiddenPropertyGetterMessage = ({
  path,
  propertyNameOrSymbol,
}) => `property getter are not allowed.
getter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createForbiddenPropertySetterMessage = ({
  path,
  propertyNameOrSymbol,
}) => `property setter are not allowed.
setter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createUnexpectedValueOfReturnValueMessage = () =>
  `valueOf() must return a primitive of the object itself.`;

const createUnknownSymbolMessage = ({
  symbol,
}) => `symbol must be global, like Symbol.iterator, or created using Symbol.for().
symbol: ${symbol.toString()}`;

const createUnknownPrototypeMessage = ({ prototypeValue }) =>
  `prototype must be global, like Object.prototype, or somewhere in the value.
prototype constructor name: ${prototypeValue.constructor.name}`;

// be carefull because this function is mutating recipe objects inside the recipeArray.
// this is not an issue because each recipe object is not accessible from the outside
// when used internally by uneval
const sortRecipe = (recipeArray) => {
  const findInRecipePrototypeChain = (recipe, callback) => {
    let currentRecipe = recipe;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (currentRecipe.type !== "composite") {
        break
      }

      const prototypeIdentifier = currentRecipe.prototypeIdentifier;
      if (prototypeIdentifier === undefined) {
        break
      }

      currentRecipe = recipeArray[prototypeIdentifier];

      if (callback(currentRecipe, prototypeIdentifier)) {
        return prototypeIdentifier
      }
    }
    return undefined
  };

  const recipeArrayOrdered = recipeArray.slice();
  recipeArrayOrdered.sort((leftRecipe, rightRecipe) => {
    const leftType = leftRecipe.type;
    const rightType = rightRecipe.type;

    if (leftType === "composite" && rightType === "composite") {
      const rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(
        leftRecipe,
        (recipeCandidate) => recipeCandidate === rightRecipe,
      );
      // if left recipe requires right recipe, left must be after right
      if (rightRecipeIsInLeftRecipePrototypeChain) {
        return 1
      }

      const leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(
        rightRecipe,
        (recipeCandidate) => recipeCandidate === leftRecipe,
      );
      // if right recipe requires left recipe, right must be after left
      if (leftRecipeIsInRightRecipePrototypeChain) {
        return -1
      }
    }

    if (leftType !== rightType) {
      // if left is a composite, left must be after right
      if (leftType === "composite") {
        return 1
      }

      // if right is a composite, right must be after left
      if (rightType === "composite") {
        return -1
      }
    }

    const leftIndex = recipeArray.indexOf(leftRecipe);
    const rightIndex = recipeArray.indexOf(rightRecipe);
    // left was before right, don't change that
    if (leftIndex < rightIndex) {
      return -1
    }

    // right was after left, don't change that
    return 1
  });

  return recipeArrayOrdered
};

// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const escapeString = (value) => {
  const string = String(value);
  let i = 0;
  const j = string.length;
  var escapedString = "";
  while (i < j) {
    const char = string[i];
    let escapedChar;
    if (char === '"' || char === "'" || char === "\\") {
      escapedChar = `\\${char}`;
    } else if (char === "\n") {
      escapedChar = "\\n";
    } else if (char === "\r") {
      escapedChar = "\\r";
    } else if (char === "\u2028") {
      escapedChar = "\\u2028";
    } else if (char === "\u2029") {
      escapedChar = "\\u2029";
    } else {
      escapedChar = char;
    }
    escapedString += escapedChar;
    i++;
  }
  return escapedString
};

const uneval = (
  value,
  { functionAllowed = false, prototypeStrict = false, ignoreSymbols = false } = {},
) => {
  const { recipeArray, mainIdentifier, valueMap } = decompose(value, {
    functionAllowed,
    prototypeStrict,
    ignoreSymbols,
  });
  const recipeArraySorted = sortRecipe(recipeArray);

  let source = `(function () {
var globalObject
try {
  globalObject = Function('return this')() || (42, eval)('this');
} catch(e) {
  globalObject = window;
}

function safeDefineProperty(object, propertyNameOrSymbol, descriptor) {
  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);
  if (currentDescriptor && !currentDescriptor.configurable) return
  Object.defineProperty(object, propertyNameOrSymbol, descriptor)
};
`;

  const variableNameMap = {};
  recipeArray.forEach((recipe, index) => {
    const indexSorted = recipeArraySorted.indexOf(recipe);
    variableNameMap[index] = `_${indexSorted}`;
  });

  const identifierToVariableName = (identifier) => variableNameMap[identifier];

  const recipeToSetupSource = (recipe) => {
    if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe)
    if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe)
    if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe)
    return compositeRecipeToSetupSource(recipe)
  };

  const primitiveRecipeToSetupSource = ({ value }) => {
    const type = typeof value;

    if (type === "string") {
      return `"${escapeString(value)}";`
    }

    if (type === "bigint") {
      return `${value.toString()}n`
    }

    if (Object.is(value, -0)) {
      return "-0;"
    }

    return `${String(value)};`
  };

  const globalSymbolRecipeToSetupSource = (recipe) => {
    return `Symbol.for("${escapeString(recipe.key)}");`
  };

  const globalReferenceRecipeToSetupSource = (recipe) => {
    const pathSource = recipe.path.map((part) => `["${escapeString(part)}"]`).join("");
    return `globalObject${pathSource};`
  };

  const compositeRecipeToSetupSource = ({ prototypeIdentifier, valueOfIdentifier }) => {
    if (prototypeIdentifier === undefined) {
      return identifierToVariableName(valueOfIdentifier)
    }

    const prototypeValue = valueMap[prototypeIdentifier];
    if (prototypeValue === null) {
      return `Object.create(null);`
    }

    const prototypeConstructor = prototypeValue.constructor;
    if (prototypeConstructor === Object) {
      return `Object.create(${identifierToVariableName(prototypeIdentifier)});`
    }

    if (valueOfIdentifier === undefined) {
      return `new ${prototypeConstructor.name}();`
    }

    if (prototypeConstructor.name === "BigInt") {
      return `Object(${identifierToVariableName(valueOfIdentifier)})`
    }

    return `new ${prototypeConstructor.name}(${identifierToVariableName(valueOfIdentifier)});`
  };

  recipeArraySorted.forEach((recipe) => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `var ${recipeVariableName} = ${recipeToSetupSource(recipe)}
`;
  });

  const recipeToMutateSource = (recipe, recipeVariableName) => {
    if (recipe.type === "composite") {
      return compositeRecipeToMutateSource(recipe, recipeVariableName)
    }
    return ``
  };

  const compositeRecipeToMutateSource = (
    { propertyDescriptionArray, symbolDescriptionArray, methodDescriptionArray, extensible },
    recipeVariableName,
  ) => {
    let mutateSource = ``;

    propertyDescriptionArray.forEach(({ propertyNameIdentifier, propertyDescription }) => {
      mutateSource += generateDefinePropertySource(
        recipeVariableName,
        propertyNameIdentifier,
        propertyDescription,
      );
    });

    symbolDescriptionArray.forEach(({ symbolIdentifier, propertyDescription }) => {
      mutateSource += generateDefinePropertySource(
        recipeVariableName,
        symbolIdentifier,
        propertyDescription,
      );
    });

    methodDescriptionArray.forEach(({ methodNameIdentifier, callArray }) => {
      mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
    });

    if (!extensible) {
      mutateSource += generatePreventExtensionSource(recipeVariableName);
    }

    return mutateSource
  };

  const generateDefinePropertySource = (
    recipeVariableName,
    propertyNameOrSymbolIdentifier,
    propertyDescription,
  ) => {
    const propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);

    const propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
    return `safeDefineProperty(${recipeVariableName}, ${propertyOrSymbolVariableName}, ${propertyDescriptorSource});`
  };

  const generatePropertyDescriptorSource = ({
    configurable,
    writable,
    enumerable,
    getIdentifier,
    setIdentifier,
    valueIdentifier,
  }) => {
    if (valueIdentifier === undefined) {
      return `{
  configurable: ${configurable},
  enumerable: ${enumerable},
  get: ${getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier)},
  set: ${setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier)},
}`
    }

    return `{
  configurable: ${configurable},
  writable: ${writable},
  enumerable: ${enumerable},
  value: ${valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier)}
}`
  };

  const generateMethodCallSource = (recipeVariableName, methodNameIdentifier, callArray) => {
    let methodCallSource = ``;

    const methodVariableName = identifierToVariableName(methodNameIdentifier);
    callArray.forEach((argumentIdentifiers) => {
      const argumentVariableNames = argumentIdentifiers.map((argumentIdentifier) =>
        identifierToVariableName(argumentIdentifier),
      );

      methodCallSource += `${recipeVariableName}[${methodVariableName}](${argumentVariableNames.join(
        ",",
      )});`;
    });

    return methodCallSource
  };

  const generatePreventExtensionSource = (recipeVariableName) => {
    return `Object.preventExtensions(${recipeVariableName});`
  };

  recipeArraySorted.forEach((recipe) => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `${recipeToMutateSource(recipe, recipeVariableName)}`;
  });

  source += `return ${identifierToVariableName(mainIdentifier)}; })()`;

  return source
};

/*
 * Calling Profiler.startPreciseCoverage DO NOT propagate to
 * subprocesses (new Worker or child_process.fork())
 * So the best solution remains NODE_V8_COVERAGE
 * This profiler strategy remains useful when:
 * - As fallback when NODE_V8_COVERAGE is not configured
 * - If explicitely enabled with coverageMethodForNodeJs: "Profiler"
 *   - Used by jsenv during automated tests about coverage
 *   - Anyone prefering this approach over NODE_V8_COVERAGE and assuming
 *     it will not fork subprocess or don't care if coverage is missed for this code
 * - https://v8.dev/blog/javascript-code-coverage#for-embedders
 * - https://github.com/nodejs/node/issues/28283
 * - https://vanilla.aslushnikov.com/?Profiler.startPreciseCoverage
 */


const startJsCoverage = async ({
  callCount = true,
  detailed = true,
} = {}) => {
  const session = new Session();
  session.connect();
  const postSession = (action, options) => {
    const promise = new Promise((resolve, reject) => {
      session.post(action, options, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
    return promise;
  };

  await postSession("Profiler.enable");
  await postSession("Profiler.startPreciseCoverage", { callCount, detailed });

  const takeJsCoverage = async () => {
    const coverage = await postSession("Profiler.takePreciseCoverage");
    return coverage;
  };

  const stopJsCoverage = async () => {
    const coverage = await takeJsCoverage();
    await postSession("Profiler.stopPreciseCoverage");
    await postSession("Profiler.disable");
    return coverage;
  };

  return {
    takeJsCoverage,
    stopJsCoverage,
  };
};

const startObservingPerformances = () => {
  const measureEntries = [];
  // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html
  const perfObserver = new PerformanceObserver(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
      list,
    ) => {
      const perfMeasureEntries = list.getEntriesByType("measure");
      measureEntries.push(...perfMeasureEntries);
    },
  );
  perfObserver.observe({
    entryTypes: ["measure"],
  });
  return async () => {
    // wait for node to call the performance observer
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
    performance.clearMarks();
    perfObserver.disconnect();
    return {
      ...readNodePerformance(),
      measures: measuresFromMeasureEntries(measureEntries),
    };
  };
};

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: performance.eventLoopUtilization(),
  };
  return nodePerformance;
};

// remove getters that cannot be stringified
const asPlainObject = (objectWithGetters) => {
  const objectWithoutGetters = {};
  Object.keys(objectWithGetters).forEach((key) => {
    objectWithoutGetters[key] = objectWithGetters[key];
  });
  return objectWithoutGetters;
};

const measuresFromMeasureEntries = (measureEntries) => {
  const measures = {};
  // Sort to ensure measures order is predictable
  // It seems to be already predictable on Node 16+ but
  // it's not the case on Node 14.
  measureEntries.sort((a, b) => {
    return a.startTime - b.startTime;
  });
  measureEntries.forEach(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
      perfMeasureEntry,
    ) => {
      measures[perfMeasureEntry.name] = perfMeasureEntry.duration;
    },
  );
  return measures;
};

const executeUsingDynamicImport = async ({
  rootDirectoryUrl,
  fileUrl,
  collectPerformance,
  coverageEnabled,
  coverageConfig,
  coverageMethodForNodeJs,
  coverageFileUrl,
}) => {
  const result = {};
  const afterImportCallbacks = [];
  if (coverageEnabled && coverageMethodForNodeJs === "Profiler") {
    const { filterV8Coverage } = await import("./v8_coverage.js").then(n => n.v);
    const { stopJsCoverage } = await startJsCoverage();
    afterImportCallbacks.push(async () => {
      const coverage = await stopJsCoverage();
      const coverageLight = await filterV8Coverage(coverage, {
        rootDirectoryUrl,
        coverageConfig,
      });
      writeFileSync(
        new URL(coverageFileUrl),
        JSON.stringify(coverageLight, null, "  "),
      );
    });
  }
  if (collectPerformance) {
    const getPerformance = startObservingPerformances();
    afterImportCallbacks.push(async () => {
      const performance = await getPerformance();
      result.performance = performance;
    });
  }
  const namespace = await import(fileUrl);
  const namespaceResolved = {};
  await Promise.all(
    Object.keys(namespace).map(async (key) => {
      const value = await namespace[key];
      namespaceResolved[key] = value;
    }),
  );
  result.namespace = namespaceResolved;
  await afterImportCallbacks.reduce(async (previous, afterImportCallback) => {
    await previous;
    await afterImportCallback();
  }, Promise.resolve());
  return result;
};

export { executeUsingDynamicImport as e, uneval as u };
