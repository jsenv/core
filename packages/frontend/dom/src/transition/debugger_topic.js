import { createPubSub } from "../pub_sub.js";

const [publishDebugger, subscribeDebugger] = createPubSub();

export const notifyDebuggerStart = () => {
  const publishResults = publishDebugger();
  const notifyDebuggerEnd = () => {
    for (const publishResult of publishResults) {
      if (typeof publishResult === "function") {
        publishResult();
      }
    }
  };
  return notifyDebuggerEnd;
};

export { subscribeDebugger };
