export const registerAction = (fn) => {
  if (isAction) {
    const route = {
      loadData: handler,
      loadUI: null,
      renderUI: null,
      node: null,
      isMatchingSignal: signal(false),
      loadingStateSignal: signal(IDLE),
      errorSignal: signal(null),
      error: null,
      match: ({ formAction }) => formAction.route === route,
      enter,
      leave,
      reportError,
      toString: () => handler.name,
    };
    effect(() => {
      route.error = route.errorSignal.value;
    });
    routeSet.add(route);
    return route;
  }

  return action;
};
