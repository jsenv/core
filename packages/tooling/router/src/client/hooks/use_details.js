import { useUrlBooleanParam } from "../url.js";

export const useDetails = (urlParam, { replace = true } = {}) => {
  const [opened, openDetails, closeDetails] = useUrlBooleanParam(urlParam, {
    replace,
  });

  return {
    open: opened,
    onToggle: (toggleEvent) => {
      if (toggleEvent.newState === "open") {
        openDetails();
      } else {
        closeDetails();
      }
    },
  };
};
