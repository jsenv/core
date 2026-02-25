import { createPubSub } from "@jsenv/dom";

export const listenInputValue = (
  input,
  callback,
  { waitForChange = false, debounce = 0 } = {},
) => {
  if (waitForChange) {
    return listenInputValueChange(input, callback);
  }
  const [teardown, addTeardown] = createPubSub();
  let currentValue = input.value;
  let timeout;
  const onAsyncEvent = (e) => {
    timeout = setTimeout(() => {
      onEvent(e);
    }, 0);
  };

  let onEvent;
  if (debounce) {
    let debounceTimeout;
    onEvent = (e) => {
      clearTimeout(timeout);
      clearTimeout(debounceTimeout);

      const value = input.value;
      if (value === currentValue) {
        return;
      }
      currentValue = value;

      debounceTimeout = setTimeout(() => {
        callback(e);
      }, debounce);
    };
  } else {
    onEvent = (e) => {
      clearTimeout(timeout);

      const value = input.value;
      if (value === currentValue) {
        return;
      }
      currentValue = value;
      callback(e);
    };
  }

  // Standard user input (typing)
  input.addEventListener("input", onEvent);
  addTeardown(() => {
    input.removeEventListener("input", onEvent);
  });

  // Autocomplete, programmatic changes, form restoration
  input.addEventListener("change", onEvent);
  addTeardown(() => {
    input.removeEventListener("change", onEvent);
  });

  // Form reset - need to check the form
  const form = input.form;
  if (form) {
    // Form reset happens asynchronously, check value after reset completes
    form.addEventListener("reset", onAsyncEvent);
    addTeardown(() => {
      form.removeEventListener("reset", onAsyncEvent);
    });
  }

  // Paste events (some browsers need special handling)
  input.addEventListener("paste", onEvent);
  addTeardown(() => {
    input.removeEventListener("paste", onEvent);
  });

  // Focus events to catch programmatic changes that don't fire other events
  // (like when value is set before user interaction)
  input.addEventListener("focus", onEvent);
  addTeardown(() => {
    input.removeEventListener("focus", onEvent);
  });

  // "navi_delete_content" behaves like an async event
  // a bit like form reset because
  // our action will be updated async after the component re-renders
  // and we need to wait that to happen to properly call action with the right value
  input.addEventListener("navi_delete_content", onAsyncEvent);
  addTeardown(() => {
    input.removeEventListener("navi_delete_content", onAsyncEvent);
  });
  return () => {
    teardown();
  };
};

const listenInputValueChange = (input, callback) => {
  const [teardown, addTeardown] = createPubSub();

  let valueAtInteraction;
  const oninput = () => {
    valueAtInteraction = undefined;
  };
  const onkeydown = (e) => {
    if (e.key === "Enter") {
      /**
       * Browser trigger a "change" event right after the enter is pressed
       * if the input value has changed.
       * We need to prevent the next change event otherwise we would request action twice
       */
      valueAtInteraction = input.value;
    }
    if (e.key === "Escape") {
      /**
       * Browser trigger a "change" event right after the escape is pressed
       * if the input value has changed.
       * We need to prevent the next change event otherwise we would request action when
       * we actually want to cancel
       */
      valueAtInteraction = input.value;
    }
  };
  const onchange = (e) => {
    if (
      valueAtInteraction !== undefined &&
      e.target.value === valueAtInteraction
    ) {
      valueAtInteraction = undefined;
      return;
    }
    callback(e);
  };
  input.addEventListener("input", oninput);
  input.addEventListener("keydown", onkeydown);
  input.addEventListener("change", onchange);
  addTeardown(() => {
    input.removeEventListener("input", oninput);
    input.removeEventListener("keydown", onkeydown);
    input.removeEventListener("change", onchange);
  });

  programmatic_change: {
    // Handle programmatic value changes that don't trigger browser change events
    //
    // Problem: When input values are set programmatically (not by user typing),
    // browsers don't fire the 'change' event. However, our application logic
    // still needs to detect these changes.
    //
    // Example scenario:
    // 1. User starts editing (letter key pressed, value set programmatically)
    // 2. User doesn't type anything additional (this is the key part)
    // 3. User clicks outside to finish editing
    // 4. Without this code, no change event would fire despite the fact that the input value did change from its original state
    //
    // This distinction is crucial because:
    //
    // - If the user typed additional text after the initial programmatic value,
    //   the browser would fire change events normally
    // - But when they don't type anything else, the browser considers it as "no user interaction"
    //   even though the programmatic initial value represents a meaningful change
    //
    // We achieve this by checking if the input value has changed between focus and blur without any user interaction
    // if yes we fire the callback because input value did change
    let valueAtStart = input.value;
    let interacted = false;

    const onfocus = () => {
      interacted = false;
      valueAtStart = input.value;
    };
    const oninput = (e) => {
      if (!e.isTrusted) {
        // non trusted "input" events will be ignored by the browser when deciding to fire "change" event
        // we ignore them too
        return;
      }
      interacted = true;
    };
    const onblur = (e) => {
      if (interacted) {
        return;
      }
      if (valueAtStart === input.value) {
        return;
      }
      callback(e);
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);
    addTeardown(() => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    });
  }

  return teardown;
};
