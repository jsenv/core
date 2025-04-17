import { useEffect } from "preact/hooks";

export const useKeyEffect = (keyCallbacks) => {
  const deps = [];
  const keys = Object.keys(keyCallbacks);
  const effects = {};
  for (const key of keys) {
    deps.push(key);
    const keyEffect = keyCallbacks[key];
    if (typeof keyEffect === "function") {
      deps.push(keyEffect);
      effects[key] = { enabled: true, callback: keyEffect };
    } else {
      const { enabled, callback } = keyEffect;
      deps.push(enabled, callback);
      effects[key] = keyEffect;
    }
  }

  useEffect(() => {
    const onKeyDown = (keydownEvent) => {
      const eventKey = keydownEvent.key;
      const keyEffect = effects[eventKey];
      if (keyEffect?.enabled) {
        keydownEvent.preventDefault();
        keyEffect.callback(keydownEvent);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, deps);
};
