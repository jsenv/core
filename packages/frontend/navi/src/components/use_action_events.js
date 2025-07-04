import { useLayoutEffect } from "preact/hooks";

export const useActionEvents = (
  elementRef,
  { onReset, onPrevented, onAction, onStart, onError, onEnd },
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    const isForm = element.tagName === "FORM";
    const eventsToListenOnForm = {
      reset: onReset,
      actionprevented: onPrevented,
      action: onAction,
      actionstart: onStart,
      actionerror: onError,
      actionend: onEnd,
    };
    const eventsToListenOnElement = {
      cancel: onReset,
      actionprevented: onPrevented,
      action: onAction,
      actionstart: onStart,
      actionerror: onError,
      actionend: onEnd,
    };

    if (isForm) {
      return listenEvents(element, eventsToListenOnForm);
    }

    const form = element.form;
    if (form) {
      const removeFormEvents = listenEvents(form, eventsToListenOnForm);
      const removeElementEvents = listenEvents(
        element,
        eventsToListenOnElement,
      );
      return () => {
        removeFormEvents();
        removeElementEvents();
      };
    }

    return listenEvents(element, eventsToListenOnElement);
  }, [onReset, onPrevented, onAction, onStart, onError, onEnd]);
};

const listenEvents = (element, events) => {
  const cleanupCallbackSet = new Set();
  for (const event of Object.keys(events)) {
    const callback = events[event];
    element.addEventListener(event, callback);
    cleanupCallbackSet.add(() => {
      element.removeEventListener(event, callback);
    });
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
  };
};
