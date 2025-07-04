const findEventTargetOrAncestor = (event, predicate, rootElement) => {
  const target = event.target;
  const result = predicate(target);
  if (result) {
    return result;
  }
  let parentElement = target.parentElement;
  while (parentElement && parentElement !== rootElement) {
    const parentResult = predicate(parentElement);
    if (parentResult) {
      return parentResult;
    }
    parentElement = parentElement.parentElement;
  }
  return null;
};
const formHasSubmitButton = (form) => {
  return form.querySelector(
    "button[type='submit'], input[type='submit'], input[type='image']",
  );
};
const getElementEffect = (element) => {
  const isButton = element.tagName === "BUTTON" || element.role === "button";
  if (element.tagName === "INPUT" || isButton) {
    if (element.type === "submit" || element.type === "image") {
      return "submit";
    }
    if (element.type === "reset") {
      return "reset";
    }
    if (isButton || element.type === "button") {
      const form = element.form;
      if (!form) {
        return "activate";
      }
      if (formHasSubmitButton(form)) {
        return "activate";
      }
      return "submit";
    }
  }
  return null;
};

by_click: {
  const onClick = (e) => {
    const target = e.target;
    const form = target.form;
    if (!form) {
      // happens outside a <form>
      if (target !== element && !element.contains(target)) {
        // happens outside this element
        return;
      }
      const effect = findEventTargetOrAncestor(e, getElementEffect, element);
      if (effect === "activate") {
        requestAction(e, {
          target: element,
          requester: target,
        });
      }
      // "reset", null
      return;
    }
    if (element.form !== form) {
      // happens in an other <form>, or the input has no <form>
      return;
    }
    const effect = findEventTargetOrAncestor(e, getElementEffect, form);
    if (effect === "submit") {
      // prevent "submit" event that would be dispatched by the browser after "click"
      // (not super important because our <form> listen the "action" and do does preventDefault on "submit")
      e.preventDefault();

      requestAction(e, {
        target: form,
        requester: target,
      });
    }
    // "activate", "reset", null
  };
  // window.addEventListener("click", onClick, { capture: true });
  cleanupCallbackSet.add(() => {
    window.removeEventListener("click", onClick, { capture: true });
  });
}
by_enter: {
  const onKeydown = (e) => {
    if (e.key !== "Enter") {
      return;
    }
    const target = e.target;
    const form = target.form;
    if (!form) {
      // happens outside a <form>
      if (target !== element && !element.contains(target)) {
        // happens outside this element
        return;
      }
      const effect = findEventTargetOrAncestor(e, getElementEffect, form);
      if (effect === "activate") {
        requestAction(e, {
          target: element,
          requester: target,
        });
      }
      return;
    }
    if (element.form !== form) {
      // happens in an other <form>, or the element has no <form>
      return;
    }
    const effect = findEventTargetOrAncestor(e, getElementEffect, form);
    if (effect === "activate") {
      requestAction(e, {
        target: element,
        submitter: target,
      });
      return;
    }
    // "submit", "reset", null
  };
  // window.addEventListener("keydown", onKeydown, { capture: true });
  cleanupCallbackSet.add(() => {
    window.removeEventListener("keydown", onKeydown, { capture: true });
  });
}
