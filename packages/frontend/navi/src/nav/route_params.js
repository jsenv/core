import { effect } from "@preact/signals";

// Function to establish signal-route connections
export const connectSignalToRoute = (
  signal,
  route,
  paramName,
  routePrivateProperties,
  options = {},
) => {
  const { defaultValue, debug } = options;

  // Set up route parameter description
  route.describeParam(paramName, {
    default: defaultValue,
    // Add other param config here
  });

  const { matchingSignal, rawParamsSignal } = routePrivateProperties;
  // URL -> Signal synchronization
  effect(() => {
    const matching = matchingSignal.value;
    const params = rawParamsSignal.value;
    const urlParamValue = params[paramName];

    if (!matching) {
      return;
    }

    if (debug) {
      console.debug(
        `[stateSignal] URL -> Signal: ${paramName}=${urlParamValue}`,
      );
    }

    signal.value = urlParamValue;
  });

  // Signal -> URL synchronization
  effect(() => {
    const value = signal.value;
    const params = rawParamsSignal.value;
    const urlParamValue = params[paramName];
    const matching = matchingSignal.value;

    if (!matching || value === urlParamValue) {
      return;
    }

    if (debug) {
      console.debug(`[stateSignal] Signal -> URL: ${paramName}=${value}`);
    }

    route.replaceParams({ [paramName]: value });
  });
};
