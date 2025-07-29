export const getCallerInfo = (targetFunction = null, additionalOffset = 0) => {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, stack) => stack;

    const error = new Error();
    const stack = error.stack;

    if (!stack || stack.length === 0 || !Array.isArray(stack)) {
      return { raw: "unknown" };
    }

    let targetIndex = -1;

    if (targetFunction) {
      // ✅ Chercher la fonction cible par référence directe
      for (let i = 0; i < stack.length; i++) {
        const frame = stack[i];
        const frameFunction = frame.getFunction();

        // ✅ Comparaison directe par référence
        if (frameFunction === targetFunction) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return {
          raw: `target function not found in stack`,
          targetFunction: targetFunction.name,
        };
      }

      // ✅ Prendre la fonction qui appelle targetFunction + offset
      const callerIndex = targetIndex + 1 + additionalOffset;

      if (callerIndex >= stack.length) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          targetFunction: targetFunction.name,
          requestedIndex: callerIndex,
          stackLength: stack.length,
        };
      }

      const callerFrame = stack[callerIndex];
      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        targetFunction: targetFunction.name,
        offset: additionalOffset,
      };
    }

    // ✅ Comportement original si pas de targetFunction
    if (stack.length > 2) {
      const callerFrame = stack[2 + additionalOffset];

      if (!callerFrame) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          requestedIndex: 2 + additionalOffset,
          stackLength: stack.length,
        };
      }

      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        offset: additionalOffset,
      };
    }

    return { raw: "unknown" };
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
};
