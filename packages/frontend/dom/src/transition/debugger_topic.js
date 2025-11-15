import { createPubSub } from "../pub_sub.js";

const [publishDebugger, subscribeDebugger] = createPubSub();

export const notifyDebuggerStart = () => {
  const results = publishDebugger();
  const notifyDebuggerEnd = () => {
    for (const result of results) {
      if (typeof result === "function") {
        result();
      }
    }
  };
  return notifyDebuggerEnd;
};

export { subscribeDebugger };
