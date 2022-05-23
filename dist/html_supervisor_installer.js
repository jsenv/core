// https://developer.mozilla.org/en-US/docs/Glossary/Primitive
const isComposite = value => {
  if (value === null) {
    return false;
  }

  const type = typeof value;

  if (type === "object") {
    return true;
  }

  if (type === "function") {
    return true;
  }

  return false;
};

const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();
const getCompositeGlobalPath = value => compositeWellKnownMap.get(value);
const getPrimitiveGlobalPath = value => primitiveWellKnownMap.get(value);

const visitGlobalObject = value => {
  const visitValue = (value, path) => {
    if (isComposite(value)) {
      // prevent infinite recursion
      if (compositeWellKnownMap.has(value)) {
        return;
      }

      compositeWellKnownMap.set(value, path);

      const visitProperty = property => {
        let descriptor;

        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          if (e.name === "SecurityError") {
            return;
          }

          throw e;
        }

        if (!descriptor) {
          // it's apparently possible to have getOwnPropertyNames returning
          // a property that later returns a null descriptor
          // for instance window.showModalDialog in webkit 13.0
          return;
        } // do not trigger getter/setter


        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, [...path, property]);
        }
      };

      Object.getOwnPropertyNames(value).forEach(name => visitProperty(name));
      Object.getOwnPropertySymbols(value).forEach(symbol => visitProperty(symbol));
    }

    primitiveWellKnownMap.set(value, path);
    return;
  };

  visitValue(value, []);
};

if (typeof window === "object") visitGlobalObject(window);
if (typeof global === "object") visitGlobalObject(global);

/**
 * transforms a javascript value into an object describing it.
 *
 */
const decompose = (mainValue, {
  functionAllowed,
  prototypeStrict,
  ignoreSymbols
}) => {
  const valueMap = {};
  const recipeArray = [];

  const valueToIdentifier = (value, path = []) => {
    if (!isComposite(value)) {
      const existingIdentifier = identifierForPrimitive(value);

      if (existingIdentifier !== undefined) {
        return existingIdentifier;
      }

      const identifier = identifierForNewValue(value);
      recipeArray[identifier] = primitiveToRecipe(value);
      return identifier;
    }

    if (typeof Promise === "function" && value instanceof Promise) {
      throw new Error(createPromiseAreNotSupportedMessage({
        path
      }));
    }

    if (typeof WeakSet === "function" && value instanceof WeakSet) {
      throw new Error(createWeakSetAreNotSupportedMessage({
        path
      }));
    }

    if (typeof WeakMap === "function" && value instanceof WeakMap) {
      throw new Error(createWeakMapAreNotSupportedMessage({
        path
      }));
    }

    if (typeof value === "function" && !functionAllowed) {
      throw new Error(createForbiddenFunctionMessage({
        path
      }));
    }

    const existingIdentifier = identifierForComposite(value);

    if (existingIdentifier !== undefined) {
      return existingIdentifier;
    }

    const identifier = identifierForNewValue(value);
    const compositeGlobalPath = getCompositeGlobalPath(value);

    if (compositeGlobalPath) {
      recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
      return identifier;
    }

    const propertyDescriptionArray = [];
    Object.getOwnPropertyNames(value).forEach(propertyName => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
      const propertyNameIdentifier = valueToIdentifier(propertyName, [...path, propertyName]);
      const propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
      propertyDescriptionArray.push({
        propertyNameIdentifier,
        propertyDescription
      });
    });
    const symbolDescriptionArray = [];

    if (!ignoreSymbols) {
      Object.getOwnPropertySymbols(value).forEach(symbol => {
        const propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
        const symbolIdentifier = valueToIdentifier(symbol, [...path, "[".concat(symbol.toString(), "]")]);
        const propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
        symbolDescriptionArray.push({
          symbolIdentifier,
          propertyDescription
        });
      });
    }

    const methodDescriptionArray = computeMethodDescriptionArray(value, path);
    const extensible = Object.isExtensible(value);
    recipeArray[identifier] = createCompositeRecipe({
      propertyDescriptionArray,
      symbolDescriptionArray,
      methodDescriptionArray,
      extensible
    });
    return identifier;
  };

  const computePropertyDescription = (propertyDescriptor, propertyNameOrSymbol, path) => {
    if (propertyDescriptor.set && !functionAllowed) {
      throw new Error(createForbiddenPropertySetterMessage({
        path,
        propertyNameOrSymbol
      }));
    }

    if (propertyDescriptor.get && !functionAllowed) {
      throw new Error(createForbiddenPropertyGetterMessage({
        path,
        propertyNameOrSymbol
      }));
    }

    return {
      configurable: propertyDescriptor.configurable,
      writable: propertyDescriptor.writable,
      enumerable: propertyDescriptor.enumerable,
      getIdentifier: "get" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.get, [...path, String(propertyNameOrSymbol), "[[descriptor:get]]"]) : undefined,
      setIdentifier: "set" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.set, [...path, String(propertyNameOrSymbol), "[[descriptor:set]]"]) : undefined,
      valueIdentifier: "value" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.value, [...path, String(propertyNameOrSymbol), "[[descriptor:value]]"]) : undefined
    };
  };

  const computeMethodDescriptionArray = (value, path) => {
    const methodDescriptionArray = [];

    if (typeof Set === "function" && value instanceof Set) {
      const callArray = [];
      value.forEach((entryValue, index) => {
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, "[[SetEntryValue]]", index]);
        callArray.push([entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("add"),
        callArray
      });
    }

    if (typeof Map === "function" && value instanceof Map) {
      const callArray = [];
      value.forEach((entryValue, entryKey) => {
        const entryKeyIdentifier = valueToIdentifier(entryKey, [...path, "[[MapEntryKey]]", entryKey]);
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, "[[MapEntryValue]]", entryValue]);
        callArray.push([entryKeyIdentifier, entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("set"),
        callArray
      });
    }

    return methodDescriptionArray;
  };

  const identifierForPrimitive = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      if (Object.is(value, existingValue)) return true;
      return value === existingValue;
    });
  };

  const identifierForComposite = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      return value === existingValue;
    });
  };

  const identifierForNewValue = value => {
    const identifier = nextIdentifier();
    valueMap[identifier] = value;
    return identifier;
  };

  let currentIdentifier = -1;

  const nextIdentifier = () => {
    const identifier = String(parseInt(currentIdentifier) + 1);
    currentIdentifier = identifier;
    return identifier;
  };

  const mainIdentifier = valueToIdentifier(mainValue); // prototype, important to keep after the whole structure was visited
  // so that we discover if any prototype is part of the value

  const prototypeValueToIdentifier = prototypeValue => {
    // prototype is null
    if (prototypeValue === null) {
      return valueToIdentifier(prototypeValue);
    } // prototype found somewhere already


    const prototypeExistingIdentifier = identifierForComposite(prototypeValue);

    if (prototypeExistingIdentifier !== undefined) {
      return prototypeExistingIdentifier;
    } // mark prototype as visited


    const prototypeIdentifier = identifierForNewValue(prototypeValue); // prototype is a global reference ?

    const prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);

    if (prototypeGlobalPath) {
      recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
      return prototypeIdentifier;
    } // otherwise prototype is unknown


    if (prototypeStrict) {
      throw new Error(createUnknownPrototypeMessage({
        prototypeValue
      }));
    }

    return prototypeValueToIdentifier(Object.getPrototypeOf(prototypeValue));
  };

  const identifierForValueOf = (value, path = []) => {
    if (value instanceof Array) {
      return valueToIdentifier(value.length, [...path, "length"]);
    }

    if ("valueOf" in value === false) {
      return undefined;
    }

    if (typeof value.valueOf !== "function") {
      return undefined;
    }

    const valueOfReturnValue = value.valueOf();

    if (!isComposite(valueOfReturnValue)) {
      return valueToIdentifier(valueOfReturnValue, [...path, "valueOf()"]);
    }

    if (valueOfReturnValue === value) {
      return undefined;
    }

    throw new Error(createUnexpectedValueOfReturnValueMessage());
  };

  recipeArray.slice().forEach((recipe, index) => {
    if (recipe.type === "composite") {
      const value = valueMap[index];

      if (typeof value === "function") {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      }

      if (value instanceof RegExp) {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      } // valueOf, mandatory to uneval new Date(10) for instance.


      recipe.valueOfIdentifier = identifierForValueOf(value);
      const prototypeValue = Object.getPrototypeOf(value);
      recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
    }
  });
  return {
    recipeArray,
    mainIdentifier,
    valueMap
  };
};

const primitiveToRecipe = value => {
  if (typeof value === "symbol") {
    return symbolToRecipe(value);
  }

  return createPimitiveRecipe(value);
};

const symbolToRecipe = symbol => {
  const globalSymbolKey = Symbol.keyFor(symbol);

  if (globalSymbolKey !== undefined) {
    return createGlobalSymbolRecipe(globalSymbolKey);
  }

  const symbolGlobalPath = getPrimitiveGlobalPath(symbol);

  if (!symbolGlobalPath) {
    throw new Error(createUnknownSymbolMessage({
      symbol
    }));
  }

  return createGlobalReferenceRecipe(symbolGlobalPath);
};

const createPimitiveRecipe = value => {
  return {
    type: "primitive",
    value
  };
};

const createGlobalReferenceRecipe = path => {
  const recipe = {
    type: "global-reference",
    path
  };
  return recipe;
};

const createGlobalSymbolRecipe = key => {
  return {
    type: "global-symbol",
    key
  };
};

const createCompositeRecipe = ({
  prototypeIdentifier,
  valueOfIdentifier,
  propertyDescriptionArray,
  symbolDescriptionArray,
  methodDescriptionArray,
  extensible
}) => {
  return {
    type: "composite",
    prototypeIdentifier,
    valueOfIdentifier,
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  };
};

const createPromiseAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return "promise are not supported.";
  }

  return "promise are not supported.\npromise found at: ".concat(path.join(""));
};

const createWeakSetAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return "weakSet are not supported.";
  }

  return "weakSet are not supported.\nweakSet found at: ".concat(path.join(""));
};

const createWeakMapAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) {
    return "weakMap are not supported.";
  }

  return "weakMap are not supported.\nweakMap found at: ".concat(path.join(""));
};

const createForbiddenFunctionMessage = ({
  path
}) => {
  if (path.length === 0) {
    return "function are not allowed.";
  }

  return "function are not allowed.\nfunction found at: ".concat(path.join(""));
};

const createForbiddenPropertyGetterMessage = ({
  path,
  propertyNameOrSymbol
}) => "property getter are not allowed.\ngetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));

const createForbiddenPropertySetterMessage = ({
  path,
  propertyNameOrSymbol
}) => "property setter are not allowed.\nsetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));

const createUnexpectedValueOfReturnValueMessage = () => "valueOf() must return a primitive of the object itself.";

const createUnknownSymbolMessage = ({
  symbol
}) => "symbol must be global, like Symbol.iterator, or created using Symbol.for().\nsymbol: ".concat(symbol.toString());

const createUnknownPrototypeMessage = ({
  prototypeValue
}) => "prototype must be global, like Object.prototype, or somewhere in the value.\nprototype constructor name: ".concat(prototypeValue.constructor.name);

// be carefull because this function is mutating recipe objects inside the recipeArray.
// this is not an issue because each recipe object is not accessible from the outside
// when used internally by uneval
const sortRecipe = recipeArray => {
  const findInRecipePrototypeChain = (recipe, callback) => {
    let currentRecipe = recipe; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (currentRecipe.type !== "composite") {
        break;
      }

      const prototypeIdentifier = currentRecipe.prototypeIdentifier;

      if (prototypeIdentifier === undefined) {
        break;
      }

      currentRecipe = recipeArray[prototypeIdentifier];

      if (callback(currentRecipe, prototypeIdentifier)) {
        return prototypeIdentifier;
      }
    }

    return undefined;
  };

  const recipeArrayOrdered = recipeArray.slice();
  recipeArrayOrdered.sort((leftRecipe, rightRecipe) => {
    const leftType = leftRecipe.type;
    const rightType = rightRecipe.type;

    if (leftType === "composite" && rightType === "composite") {
      const rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(leftRecipe, recipeCandidate => recipeCandidate === rightRecipe); // if left recipe requires right recipe, left must be after right

      if (rightRecipeIsInLeftRecipePrototypeChain) {
        return 1;
      }

      const leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(rightRecipe, recipeCandidate => recipeCandidate === leftRecipe); // if right recipe requires left recipe, right must be after left

      if (leftRecipeIsInRightRecipePrototypeChain) {
        return -1;
      }
    }

    if (leftType !== rightType) {
      // if left is a composite, left must be after right
      if (leftType === "composite") {
        return 1;
      } // if right is a composite, right must be after left


      if (rightType === "composite") {
        return -1;
      }
    }

    const leftIndex = recipeArray.indexOf(leftRecipe);
    const rightIndex = recipeArray.indexOf(rightRecipe); // left was before right, don't change that

    if (leftIndex < rightIndex) {
      return -1;
    } // right was after left, don't change that


    return 1;
  });
  return recipeArrayOrdered;
};

// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const escapeString = value => {
  const string = String(value);
  let i = 0;
  const j = string.length;
  var escapedString = "";

  while (i < j) {
    const char = string[i];
    let escapedChar;

    if (char === '"' || char === "'" || char === "\\") {
      escapedChar = "\\".concat(char);
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

  return escapedString;
};

const uneval = (value, {
  functionAllowed = false,
  prototypeStrict = false,
  ignoreSymbols = false
} = {}) => {
  const {
    recipeArray,
    mainIdentifier,
    valueMap
  } = decompose(value, {
    functionAllowed,
    prototypeStrict,
    ignoreSymbols
  });
  const recipeArraySorted = sortRecipe(recipeArray);
  let source = "(function () {\nvar globalObject\ntry {\n  globalObject = Function('return this')() || (42, eval)('this');\n} catch(e) {\n  globalObject = window;\n}\n\nfunction safeDefineProperty(object, propertyNameOrSymbol, descriptor) {\n  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);\n  if (currentDescriptor && !currentDescriptor.configurable) return\n  Object.defineProperty(object, propertyNameOrSymbol, descriptor)\n};\n";
  const variableNameMap = {};
  recipeArray.forEach((recipe, index) => {
    const indexSorted = recipeArraySorted.indexOf(recipe);
    variableNameMap[index] = "_".concat(indexSorted);
  });

  const identifierToVariableName = identifier => variableNameMap[identifier];

  const recipeToSetupSource = recipe => {
    if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe);
    if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe);
    if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe);
    return compositeRecipeToSetupSource(recipe);
  };

  const primitiveRecipeToSetupSource = ({
    value
  }) => {
    const type = typeof value;

    if (type === "string") {
      return "\"".concat(escapeString(value), "\";");
    }

    if (type === "bigint") {
      return "".concat(value.toString(), "n");
    }

    if (Object.is(value, -0)) {
      return "-0;";
    }

    return "".concat(String(value), ";");
  };

  const globalSymbolRecipeToSetupSource = recipe => {
    return "Symbol.for(\"".concat(escapeString(recipe.key), "\");");
  };

  const globalReferenceRecipeToSetupSource = recipe => {
    const pathSource = recipe.path.map(part => "[\"".concat(escapeString(part), "\"]")).join("");
    return "globalObject".concat(pathSource, ";");
  };

  const compositeRecipeToSetupSource = ({
    prototypeIdentifier,
    valueOfIdentifier
  }) => {
    if (prototypeIdentifier === undefined) {
      return identifierToVariableName(valueOfIdentifier);
    }

    const prototypeValue = valueMap[prototypeIdentifier];

    if (prototypeValue === null) {
      return "Object.create(null);";
    }

    const prototypeConstructor = prototypeValue.constructor;

    if (prototypeConstructor === Object) {
      return "Object.create(".concat(identifierToVariableName(prototypeIdentifier), ");");
    }

    if (valueOfIdentifier === undefined) {
      return "new ".concat(prototypeConstructor.name, "();");
    }

    if (prototypeConstructor.name === "BigInt") {
      return "Object(".concat(identifierToVariableName(valueOfIdentifier), ")");
    }

    return "new ".concat(prototypeConstructor.name, "(").concat(identifierToVariableName(valueOfIdentifier), ");");
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += "var ".concat(recipeVariableName, " = ").concat(recipeToSetupSource(recipe), "\n");
  });

  const recipeToMutateSource = (recipe, recipeVariableName) => {
    if (recipe.type === "composite") {
      return compositeRecipeToMutateSource(recipe, recipeVariableName);
    }

    return "";
  };

  const compositeRecipeToMutateSource = ({
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  }, recipeVariableName) => {
    let mutateSource = "";
    propertyDescriptionArray.forEach(({
      propertyNameIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, propertyNameIdentifier, propertyDescription);
    });
    symbolDescriptionArray.forEach(({
      symbolIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, symbolIdentifier, propertyDescription);
    });
    methodDescriptionArray.forEach(({
      methodNameIdentifier,
      callArray
    }) => {
      mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
    });

    if (!extensible) {
      mutateSource += generatePreventExtensionSource(recipeVariableName);
    }

    return mutateSource;
  };

  const generateDefinePropertySource = (recipeVariableName, propertyNameOrSymbolIdentifier, propertyDescription) => {
    const propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);
    const propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
    return "safeDefineProperty(".concat(recipeVariableName, ", ").concat(propertyOrSymbolVariableName, ", ").concat(propertyDescriptorSource, ");");
  };

  const generatePropertyDescriptorSource = ({
    configurable,
    writable,
    enumerable,
    getIdentifier,
    setIdentifier,
    valueIdentifier
  }) => {
    if (valueIdentifier === undefined) {
      return "{\n  configurable: ".concat(configurable, ",\n  enumerable: ").concat(enumerable, ",\n  get: ").concat(getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier), ",\n  set: ").concat(setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier), ",\n}");
    }

    return "{\n  configurable: ".concat(configurable, ",\n  writable: ").concat(writable, ",\n  enumerable: ").concat(enumerable, ",\n  value: ").concat(valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier), "\n}");
  };

  const generateMethodCallSource = (recipeVariableName, methodNameIdentifier, callArray) => {
    let methodCallSource = "";
    const methodVariableName = identifierToVariableName(methodNameIdentifier);
    callArray.forEach(argumentIdentifiers => {
      const argumentVariableNames = argumentIdentifiers.map(argumentIdentifier => identifierToVariableName(argumentIdentifier));
      methodCallSource += "".concat(recipeVariableName, "[").concat(methodVariableName, "](").concat(argumentVariableNames.join(","), ");");
    });
    return methodCallSource;
  };

  const generatePreventExtensionSource = recipeVariableName => {
    return "Object.preventExtensions(".concat(recipeVariableName, ");");
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += "".concat(recipeToMutateSource(recipe, recipeVariableName));
  });
  source += "return ".concat(identifierToVariableName(mainIdentifier), "; })()");
  return source;
};

const unevalException = value => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString;
  }

  return uneval(value, {
    ignoreSymbols: true
  });
};

const displayErrorInDocument = error => {
  const title = "An error occured";
  let theme = error && error.cause && error.cause.code === "PARSE_ERROR" ? "light" : "dark";
  let message = errorToHTML(error);
  const css = "\n    .jsenv-console {\n      background: rgba(0, 0, 0, 0.95);\n      position: absolute;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      z-index: 1000;\n      box-sizing: border-box;\n      padding: 1em;\n    }\n\n    .jsenv-console h1 {\n      color: red;\n      display: flex;\n      align-items: center;\n    }\n\n    #button-close-jsenv-console {\n      margin-left: 10px;\n    }\n\n    .jsenv-console pre {\n      overflow: auto;\n      max-width: 70em;\n      /* avoid scrollbar to hide the text behind it */\n      padding: 20px;\n    }\n\n    .jsenv-console pre[data-theme=\"dark\"] {\n      background: #111;\n      border: 1px solid #333;\n      color: #eee;\n    }\n\n    .jsenv-console pre[data-theme=\"light\"] {\n      background: #1E1E1E;\n      border: 1px solid white;\n      color: #EEEEEE;\n    }\n\n    .jsenv-console pre a {\n      color: inherit;\n    }\n    ";
  const html = "\n      <style type=\"text/css\">".concat(css, "></style>\n      <div class=\"jsenv-console\">\n        <h1>").concat(title, " <button id=\"button-close-jsenv-console\">X</button></h1>\n        <pre data-theme=\"").concat(theme, "\">").concat(message, "</pre>\n      </div>\n      ");
  const removeJsenvConsole = appendHMTLInside(html, document.body);

  document.querySelector("#button-close-jsenv-console").onclick = () => {
    removeJsenvConsole();
  };
};

const escapeHtml = string => {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const errorToHTML = error => {
  let html;

  if (error && error instanceof Error) {
    if (error.cause && error.cause.code === "PARSE_ERROR") {
      html = error.messageHTML || escapeHtml(error.message);
    } // stackTrace formatted by V8
    else if (Error.captureStackTrace) {
      html = escapeHtml(error.stack);
    } else {
      // other stack trace such as firefox do not contain error.message
      html = escapeHtml("".concat(error.message, "\n  ").concat(error.stack));
    }
  } else if (typeof error === "string") {
    html = error;
  } else if (error === undefined) {
    html = "undefined";
  } else {
    html = JSON.stringify(error);
  }

  const htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n");
  const htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
    transform: url => {
      return {
        href: url,
        text: url
      };
    }
  });
  return htmlWithLinks;
}; // `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })


const stringToStringWithLink = (source, {
  transform = url => {
    return {
      href: url,
      text: url
    };
  }
} = {}) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, match => {
    let linkHTML = "";
    const lastChar = match[match.length - 1]; // hotfix because our url regex sucks a bit

    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";

    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);

    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineNumber = lineAndColumMatch[1];
      const columnNumber = lineAndColumMatch[2];
      const url = match.slice(0, -lineAndColumnString.length);
      const {
        href,
        text
      } = transform(url);
      linkHTML = link({
        href,
        text: "".concat(text, ":").concat(lineNumber, ":").concat(columnNumber)
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);

      if (lineMatch) {
        const lineString = lineMatch[0];
        const lineNumber = lineMatch[1];
        const url = match.slice(0, -lineString.length);
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text: "".concat(text, ":").concat(lineNumber)
        });
      } else {
        const url = match;
        const {
          href,
          text
        } = transform(url);
        linkHTML = link({
          href,
          text
        });
      }
    }

    if (endsWithSeparationChar) {
      return "".concat(linkHTML).concat(lastChar);
    }

    return linkHTML;
  });
};

const link = ({
  href,
  text = href
}) => "<a href=\"".concat(href, "\">").concat(text, "</a>");

const appendHMTLInside = (html, parentNode) => {
  const temoraryParent = document.createElement("div");
  temoraryParent.innerHTML = html;
  return transferChildren(temoraryParent, parentNode);
};

const transferChildren = (fromNode, toNode) => {
  const childNodes = [].slice.call(fromNode.childNodes, 0);
  let i = 0;

  while (i < childNodes.length) {
    toNode.appendChild(childNodes[i]);
    i++;
  }

  return () => {
    let c = 0;

    while (c < childNodes.length) {
      fromNode.appendChild(childNodes[c]);
      c++;
    }
  };
};

const {
  Notification
} = window;

const displayErrorNotificationNotAvailable = () => {};

const displayErrorNotificationImplementation = (error, {
  icon
} = {}) => {
  if (Notification.permission === "granted") {
    const notification = new Notification("An error occured", {
      lang: "en",
      body: error ? error.stack : "undefined",
      icon
    });

    notification.onclick = () => {
      window.focus();
    };
  }
};

const displayErrorNotification = typeof Notification === "function" ? displayErrorNotificationImplementation : displayErrorNotificationNotAvailable;

const {
  __html_supervisor__
} = window;
const installHtmlSupervisor = ({
  logs,
  measurePerf
}) => {

  const scriptExecutionResults = {};
  let collectCalled = false;
  let pendingExecutionCount = 0;
  let resolveScriptExecutionsPromise;
  const scriptExecutionsPromise = new Promise(resolve => {
    resolveScriptExecutionsPromise = resolve;
  });

  const onExecutionStart = name => {
    scriptExecutionResults[name] = null; // ensure execution order is reflected into the object

    pendingExecutionCount++;

    if (measurePerf) {
      performance.mark("execution_start");
    }
  };

  const onExecutionSettled = (name, executionResult) => {
    if (measurePerf) {
      performance.measure("execution", "execution_start");
    }

    scriptExecutionResults[name] = executionResult;
    pendingExecutionCount--;

    if (pendingExecutionCount === 0 && collectCalled) {
      resolveScriptExecutionsPromise();
    }
  };

  const onExecutionError = (executionResult, {
    currentScript,
    errorExposureInNotification = false,
    errorExposureInDocument = true
  }) => {
    const error = executionResult.error;

    if (error && error.code === "NETWORK_FAILURE") {
      if (currentScript) {
        const errorEvent = new Event("error");
        currentScript.dispatchEvent(errorEvent);
      }
    } else if (typeof error === "object") {
      const globalErrorEvent = new Event("error");
      globalErrorEvent.filename = error.filename;
      globalErrorEvent.lineno = error.line || error.lineno;
      globalErrorEvent.colno = error.column || error.columnno;
      globalErrorEvent.message = error.message;
      window.dispatchEvent(globalErrorEvent);
    }

    if (errorExposureInNotification) {
      displayErrorNotification(error);
    }

    if (errorExposureInDocument) {
      displayErrorInDocument(error);
    }

    executionResult.exceptionSource = unevalException(error);
    delete executionResult.error;
  };

  const getNavigationStartTime = () => {
    try {
      return window.performance.timing.navigationStart;
    } catch (e) {
      return Date.now();
    }
  };

  const performExecution = async ({
    src,
    type,
    currentScript,
    execute // https://developer.mozilla.org/en-US/docs/web/html/element/script

  }) => {
    if (logs) {
      console.group("[jsenv] loading ".concat(type, " ").concat(src));
    }

    onExecutionStart(src);
    let completed;
    let result;
    let error;

    try {
      result = await execute();
      completed = true;
    } catch (e) {
      completed = false;
      error = e;
    }

    if (completed) {
      const executionResult = {
        status: "completed",
        namespace: result,
        coverage: window.__coverage__
      };
      onExecutionSettled(src, executionResult);

      if (logs) {
        console.log("".concat(type, " load ended"));
        console.groupEnd();
      }

      return;
    }

    const executionResult = {
      status: "errored",
      coverage: window.__coverage__
    };

    if (error.name === "SyntaxError") ;

    executionResult.error = error;
    onExecutionSettled(src, executionResult);
    onExecutionError(executionResult, {
      currentScript
    });

    {
      if (typeof window.reportError === "function") {
        window.reportError(error);
      } else {
        console.error(error);
      }
    }

    if (logs) {
      console.groupEnd();
    }
  };

  const queue = [];
  let previousDonePromise = null;

  const dequeue = () => {
    const next = queue.shift();

    if (next) {
      __html_supervisor__.addScriptToExecute(next);
    } else {
      const nextDefered = deferQueue.shift();

      if (nextDefered) {
        __html_supervisor__.addScriptToExecute(nextDefered);
      }
    }
  };

  const deferQueue = [];
  let previousDeferDonePromise = null;

  __html_supervisor__.addScriptToExecute = async scriptToExecute => {
    if (scriptToExecute.async) {
      performExecution(scriptToExecute);
      return;
    }

    const useDeferQueue = scriptToExecute.defer || scriptToExecute.type === "js_module";

    if (useDeferQueue) {
      if (document.readyState !== "interactive") {
        deferQueue.push(scriptToExecute);
        return;
      }

      if (previousDonePromise) {
        // defer must wait for the regular script to be done
        deferQueue.push(scriptToExecute);
        return;
      }

      if (previousDeferDonePromise) {
        deferQueue.push(scriptToExecute);
        return;
      }

      previousDeferDonePromise = performExecution(scriptToExecute);
      await previousDeferDonePromise;
      previousDeferDonePromise = null;
      dequeue();
      return;
    }

    if (previousDonePromise) {
      queue.push(scriptToExecute);
      return;
    }

    previousDonePromise = performExecution(scriptToExecute);
    await previousDonePromise;
    previousDonePromise = null;
    dequeue();
  };

  if (document.readyState !== "intractive" && document.readyState !== "complete") {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        const nextDefered = deferQueue.shift();

        if (nextDefered) {
          __html_supervisor__.addScriptToExecute(nextDefered);
        }
      }
    });
  }

  __html_supervisor__.collectScriptResults = async () => {
    collectCalled = true;

    if (pendingExecutionCount === 0) {
      resolveScriptExecutionsPromise();
    } else {
      await scriptExecutionsPromise;
    }

    let status = "completed";
    let exceptionSource = "";
    Object.keys(scriptExecutionResults).forEach(key => {
      const scriptExecutionResult = scriptExecutionResults[key];

      if (scriptExecutionResult.status === "errored") {
        status = "errored";
        exceptionSource = scriptExecutionResult.exceptionSource;
      }
    });
    return {
      status,
      ...(status === "errored" ? {
        exceptionSource
      } : {}),
      startTime: getNavigationStartTime(),
      endTime: Date.now(),
      scriptExecutionResults
    };
  };

  const {
    scriptsToExecute
  } = __html_supervisor__;
  const copy = scriptsToExecute.slice();
  scriptsToExecute.length = 0;
  copy.forEach(scriptToExecute => {
    __html_supervisor__.addScriptToExecute(scriptToExecute);
  });
};
const superviseScriptTypeModule = ({
  src,
  isInline
}) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "js_module",
    isInline,
    execute: () => import(new URL(src, document.location.href).href)
  });
};

export { installHtmlSupervisor, superviseScriptTypeModule };

//# sourceMappingURL=html_supervisor_installer.js.map
