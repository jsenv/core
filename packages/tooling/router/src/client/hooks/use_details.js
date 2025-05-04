import { useUrlBooleanParam } from "../url.js";

export const useDetails = (urlParam) => {
  const [opened, openDetails, closeDetails] = useUrlBooleanParam(urlParam);

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
