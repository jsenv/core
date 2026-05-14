import { createContext } from "preact";
import { useContext } from "preact/hooks";

const NextResolverContext = createContext(null);

export const useNextResolver = () => useContext(NextResolverContext);

/**
 * Creates a renderComponent function that passes props through a chain of resolvers.
 * Each resolver is a Preact component rendered in sequence (hooks are allowed).
 * To pass through to the next resolver, call useNextResolver() and render the
 * returned Next component with the desired props.
 * To terminate the chain early (e.g. render a specialized component), render
 * directly without calling Next.
 *
 * Usage:
 *   const renderButton = createComponentResolver([ResolverA, ResolverB]);
 *   // Then inside a component render:
 *   renderButton(ButtonTarget, props)
 *
 * NextResolverContext exposes a stable Next component so resolvers can continue
 * the chain via useNextResolver().
 * ResolverIndexContext tracks which resolver is next so that when a resolver
 * re-renders and calls Next, the chain resumes from the correct position.
 */
export const createComponentResolver = (resolvers) => {
  const ResolverIndexContext = createContext(0);
  const TargetComponentContext = createContext(null);

  const ChainRunner = (props) => {
    const index = useContext(ResolverIndexContext);
    const TargetComponent = useContext(TargetComponentContext);
    if (index >= resolvers.length) {
      return (
        <NextResolverContext.Provider value={null}>
          <TargetComponent {...props} />
        </NextResolverContext.Provider>
      );
    }
    const Resolver = resolvers[index];
    return (
      <ResolverIndexContext.Provider value={index + 1}>
        <Resolver {...props} />
      </ResolverIndexContext.Provider>
    );
  };

  // Stable component defined once per createComponentResolver call.
  // Renders ChainRunner directly — no new providers — so ResolverIndexContext
  // is inherited from the parent tree. When a resolver calls <Next>, the chain
  // resumes from index+1 (already set by the Provider wrapping that resolver).
  const NextComponent = (props) => <ChainRunner {...props} />;

  const renderComponent = (TargetComponent, props) => {
    return (
      <NextResolverContext.Provider value={NextComponent}>
        <TargetComponentContext.Provider value={TargetComponent}>
          <ChainRunner {...props} />
        </TargetComponentContext.Provider>
      </NextResolverContext.Provider>
    );
  };

  return renderComponent;
};
