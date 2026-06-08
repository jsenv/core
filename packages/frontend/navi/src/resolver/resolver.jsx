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
 * The last entry in the array is the final/target component — it receives null
 * from useNextResolver() indicating it is terminal.
 *
 * Usage:
 *   const renderButton = createComponentResolver([ResolverA, ResolverB, ButtonTarget]);
 *   // Then inside a component render:
 *   renderButton(props)
 *
 * NextResolverContext exposes a stable Next component so resolvers can continue
 * the chain via useNextResolver().
 * ResolverIndexContext tracks which resolver is next so that when a resolver
 * re-renders and calls Next, the chain resumes from the correct position.
 */
export const createComponentResolver = (resolvers) => {
  const ResolverIndexContext = createContext(0);

  const ChainRunner = (props) => {
    const index = useContext(ResolverIndexContext);
    if (index >= resolvers.length) {
      return null;
    }
    const Resolver = resolvers[index];
    const isLast = index === resolvers.length - 1;
    return (
      <ResolverIndexContext.Provider value={index + 1}>
        {isLast ? (
          <NextResolverContext.Provider value={null}>
            <Resolver {...props} />
          </NextResolverContext.Provider>
        ) : (
          <Resolver {...props} />
        )}
      </ResolverIndexContext.Provider>
    );
  };

  // Stable component defined once per createComponentResolver call.
  // Renders ChainRunner directly — no new providers — so ResolverIndexContext
  // is inherited from the parent tree. When a resolver calls <Next>, the chain
  // resumes from index+1 (already set by the Provider wrapping that resolver).
  const NextComponent = (props) => <ChainRunner {...props} />;

  const renderComponent = (props) => {
    return (
      <NextResolverContext.Provider value={NextComponent}>
        <ResolverIndexContext.Provider value={0}>
          <ChainRunner {...props} />
        </ResolverIndexContext.Provider>
      </NextResolverContext.Provider>
    );
  };

  return renderComponent;
};
