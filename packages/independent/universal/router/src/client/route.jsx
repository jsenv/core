import { useErrorBoundary } from "preact/hooks";

export const connectRoute = (route, Component) => {
  let resolveFirstRender;
  let rejectFirstRender;
  route.addEnterTask(async () => {
    // rendering the component is part of the route tasks
    // but only the first render
    // we must wait for the component to be rendered
    const firstRenderPromise = new Promise((resolve, reject) => {
      resolveFirstRender = resolve;
      rejectFirstRender = reject;
    });
    await firstRenderPromise;
  });
  const ConnectedComponent = () => {
    const [error] = useErrorBoundary();
    if (error) {
      if (rejectFirstRender) {
        rejectFirstRender(error);
        resolveFirstRender = undefined;
        rejectFirstRender = undefined;
      }
      // en cas d'erreur on veut notifier la route
      // et cela fait partie du process de load
      return <p>An error occured: {error.message}</p>;
    }
    if (resolveFirstRender) {
      resolveFirstRender();
      resolveFirstRender = undefined;
      rejectFirstRender = undefined;
    }
    return <Component />;
  };
  return ConnectedComponent;
};
