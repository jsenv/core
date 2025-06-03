import { useEffect, useRef } from "preact/hooks";
import { useUrlBooleanParam } from "../url.js";

export const useDetailsControlledByUrlSearchParam = (
  urlParam,
  { replace = true } = {},
) => {
  const [opened, openDetails, closeDetails] = useUrlBooleanParam(urlParam, {
    replace,
  });

  /**
   * Browser will dispatch "toggle" event even if we set open={true}
   * When rendering the component for the first time
   * We have to ensure the initial "toggle" event is ignored.
   *
   * If we don't do that code will think the details has changed and run logic accordingly
   * For example it will try to navigate to the current url while we are already there
   *
   * See:
   * - https://techblog.thescore.com/2024/10/08/why-we-decided-to-change-how-the-details-element-works/
   * - https://github.com/whatwg/html/issues/4500
   * - https://stackoverflow.com/questions/58942600/react-html-details-toggles-uncontrollably-when-starts-open
   *
   */
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);

  return {
    open: opened,
    onToggle: (toggleEvent) => {
      if (!mountedRef.current) {
        return;
      }
      if (toggleEvent.newState === "open") {
        openDetails();
      } else {
        closeDetails();
      }
    },
  };
};
