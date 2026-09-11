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
 * Each position of the chain has a runner of its own, defined once: it renders
 * its resolver under a NextResolverContext holding the runner after it. A
 * resolver that re-renders on its own and renders <Next> therefore resumes at
 * its own position without any bookkeeping — the Next it was given is the one
 * made for it. A chain rendered by the hundred (a list's rows) pays two
 * components per position, the runner and the resolver, so nothing here is a
 * component that merely forwards.
 */
export const createComponentResolver = (resolvers, { pure } = {}) => {
  const runners = [];
  const lastIndex = resolvers.length - 1;
  for (let index = 0; index < resolvers.length; index++) {
    const Resolver = resolvers[index];
    const isLast = index === lastIndex;
    const Runner = (props) => (
      <NextResolverContext.Provider value={isLast ? null : runners[index + 1]}>
        <Resolver {...props} />
      </NextResolverContext.Provider>
    );
    Runner.displayName = `${Resolver.displayName || Resolver.name}Runner`;
    runners.push(Runner);
  }
  const FirstRunner = runners[0];
  const renderComponent = (props) => <FirstRunner {...props} />;

  if (!pure) {
    return renderComponent;
  }
  // The chain does not run again for props that say the same thing. The
  // signals integration already promises this for any component that READS a
  // signal ("props all === the previous ones → no render", relied on across
  // list.jsx) — but a chain head reads none, so without this a parent
  // re-rendering walks every resolver of every instance to conclude nothing
  // changed. For a component rendered by the hundred (a list's items), that
  // walk IS the cost of the parent's render. What still updates through the
  // bail: context (Preact re-renders subscribers directly) and signals (their
  // own subscription) — which is every way navi hands data down other than
  // props.
  // A FUNCTION component assigning shouldComponentUpdate on its own instance
  // (the pattern preact/compat's memo uses), and deliberately not a class: a
  // ref given to a class component is attached to the class INSTANCE, while a
  // function component receives it as a plain prop — and the chain forwards
  // it to the element the caller was reaching for.
  function PureRenderComponent(props) {
    this.shouldComponentUpdate = pureShouldComponentUpdate;
    return renderComponent(props);
  }
  return PureRenderComponent;
};

function pureShouldComponentUpdate(nextProps) {
  return shallowDiffers(this.props, nextProps);
}

const shallowDiffers = (a, b) => {
  for (const key in a) {
    if (!(key in b)) {
      return true;
    }
  }
  for (const key in b) {
    if (a[key] !== b[key]) {
      return true;
    }
  }
  return false;
};
