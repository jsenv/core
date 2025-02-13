import {
  goBack,
  goForward,
  reload,
  stopLoad,
  useCanGoBack,
  useCanGoForward,
  useCanStopLoad,
  useRouterReadyState,
} from "@jsenv/router";

export const NavControls = () => {
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();
  const routerReadyState = useRouterReadyState();
  const canStopLoad = useCanStopLoad();

  return (
    <fieldset>
      <legend>nav controls (or use browser controls)</legend>

      <div>router state: {routerReadyState}</div>

      <button
        disabled={!canStopLoad}
        onClick={() => {
          stopLoad();
        }}
      >
        Stop
      </button>
      <button
        disabled={!canGoBack}
        onClick={() => {
          goBack();
        }}
      >
        back
      </button>
      <button
        disabled={!canGoForward}
        onClick={() => {
          goForward();
        }}
      >
        forward
      </button>
      <button
        onClick={() => {
          reload();
        }}
      >
        reload
      </button>
    </fieldset>
  );
};
