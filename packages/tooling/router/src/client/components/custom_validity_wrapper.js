// example of usage:
// const errorReporter = registerCustomValidity(input);
// errorReporter.set("error message");
// errorReporter.reset();
const wrapperWeakMap = new WeakMap();

export const createCustomValidityWrapper = (input) => {
  const fromCache = wrapperWeakMap.get(input);
  if (fromCache) {
    return fromCache;
  }

  const setAndReportValidity = (message) => {
    input.setCustomValidity(message);
    input.reportValidity();
  };
  const resetCustomValidity = () => {
    input.setCustomValidity("");
    input.removeAttribute("data-error", "");
  };
  const oninput = () => {
    if (wasJustSet) {
      // if code does set a custom validity message during input
      // we keep it, the next input will reset it
      return;
    }
    resetCustomValidity();
  };
  input.addEventListener("input", oninput);

  const validityMessageMap = new Map();
  let wasJustSet = false;
  const set = (key, message) => {
    validityMessageMap.set(key, message);
    setAndReportValidity(message);
    wasJustSet = true;
    setTimeout(() => {
      wasJustSet = false;
    }, 0);
  };

  const wrapper = {
    set,
    delete: (key) => {
      validityMessageMap.delete(key);
      if (validityMessageMap.size === 0) {
        resetCustomValidity();
      }
    },
  };
  wrapperWeakMap.set(input, wrapper);
  return wrapper;
};
