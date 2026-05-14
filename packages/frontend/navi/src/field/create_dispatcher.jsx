import { createContext } from "preact";
import { useContext } from "preact/hooks";

/**
 * Creates a dispatch function that passes props through a chain of middlewares.
 * Each middleware is rendered as a proper component (hooks are allowed).
 * To pass through to the next middleware, a middleware calls useContext(DispatcherContext)
 * and renders the returned Dispatcher component with its props.
 * To terminate the chain early (e.g. render a specialized component), a middleware
 * renders its component directly without calling Dispatcher.
 *
 * Usage:
 *   const dispatch = createDispatcher([MiddlewareA, MiddlewareB], DispatcherContext);
 *   // Then inside a component render:
 *   dispatch(TargetComponent, props)
 *
 * DispatcherContext exposes a stable Dispatcher component so middlewares can continue
 * the chain via useContext(DispatcherContext).
 * MiddlewareIndexContext tracks which middleware is next so that when a middleware
 * re-renders and calls Dispatcher, the chain resumes from the correct position.
 */
export const createDispatcher = (middlewares, DispatcherContext) => {
  const MiddlewareIndexContext = createContext(0);
  const TargetComponentContext = createContext(null);

  const MiddlewareRunner = (props) => {
    const index = useContext(MiddlewareIndexContext);
    const TargetComponent = useContext(TargetComponentContext);
    if (index >= middlewares.length) {
      return <TargetComponent {...props} />;
    }
    const Middleware = middlewares[index];
    return (
      <MiddlewareIndexContext.Provider value={index + 1}>
        <Middleware {...props} />
      </MiddlewareIndexContext.Provider>
    );
  };

  // Stable component defined once per createDispatcher call.
  // Renders MiddlewareRunner directly — no new providers — so MiddlewareIndexContext
  // is inherited from the parent tree. When a middleware calls <Dispatcher>, the chain
  // resumes from index+1 (already set by the Provider wrapping that middleware).
  const DispatcherComponent = (props) => <MiddlewareRunner {...props} />;

  const dispatch = (TargetComponent, props) => {
    return (
      <DispatcherContext.Provider value={DispatcherComponent}>
        <TargetComponentContext.Provider value={TargetComponent}>
          <MiddlewareRunner {...props} />
        </TargetComponentContext.Provider>
      </DispatcherContext.Provider>
    );
  };

  return dispatch;
};
