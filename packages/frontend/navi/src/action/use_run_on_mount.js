import { useEffect } from "preact/hooks";

export const useRunOnMount = (action, Component) => {
  useEffect(() => {
    action.run({
      reason: `<${Component.name} /> mounted`,
    });
  }, []);
};
