import { createContext } from "preact";
import { useContext } from "preact/hooks";

/**
 * Creates a dispatch function that passes props through a chain of middlewares.
 * The first middleware that returns a non-null result wins.
 * If a middleware calls back into the dispatcher (e.g. to delegate rendering),
 * the dispatcher automatically skips already-run middlewares — no infinite loop.
 *
 * Usage:
 *   const dispatch = createDispatcher([MiddlewareA, MiddlewareB], DispatcherContext);
 *   // Then inside a component render:
 *   dispatch(TargetComponent, props)
 *
 * Each middleware receives the same props and must return either a JSX element or null.
 * All middlewares are always called (so hooks are always invoked in the same order).
 * The first non-null result wins. Middlewares that don't apply must return null.
 * TargetComponent is what every middleware ultimately wants to render into.
 * DispatcherContext exposes the dispatcher so middlewares can access it via useContext.
 */
export const createDispatcher = (middlewares, DispatcherContext) => {
  const AttemptIndexContext = createContext(0);
  const TargetComponentContext = createContext(null);

  const MiddlewareRunner = (props) => {
    const attemptIndex = useContext(AttemptIndexContext);
    const TargetComponent = useContext(TargetComponentContext);
    let winner = null;
    let winnerIndex = -1;
    for (let i = attemptIndex; i < middlewares.length; i++) {
      const result = middlewares[i](props);
      if (result !== null) {
        winner = result;
        winnerIndex = i;
      }
    }
    if (winner !== null) {
      return (
        <AttemptIndexContext.Provider value={winnerIndex + 1}>
          {winner}
        </AttemptIndexContext.Provider>
      );
    }
    return <TargetComponent {...props} />;
  };

  const dispatch = (TargetComponent, props) => {
    const Dispatcher = (p) => dispatch(TargetComponent, p);

    return (
      <DispatcherContext.Provider value={Dispatcher}>
        <TargetComponentContext.Provider value={TargetComponent}>
          <MiddlewareRunner {...props} />
        </TargetComponentContext.Provider>
      </DispatcherContext.Provider>
    );
  };

  return dispatch;
};
