import { createElement } from "preact";

/**
 * Creates a renderComponent function that passes props through a chain of resolvers.
 * Each resolver is a component function rendered in sequence (hooks are allowed).
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
 * A chain step is one component: a runner, defined once per position, whose
 * render CALLS its resolver's body rather than rendering it as a child. The
 * body runs synchronously inside the runner's render — its hooks are the
 * runner's, at the same tree position on every render — and for exactly that
 * long, `useNextResolver()` answers with the runner after this one (null for
 * the last). Nothing is handed down through a context: a chain rendered by the
 * hundred (a list's rows) pays one component per step, not a provider and a
 * wrapper around each.
 *
 * A resolver that renders ANOTHER resolver — a type resolver picking the
 * component for `type="date"` — cannot render it as a JSX child: that child
 * would render later, outside any body, with no Next to read. It renders it
 * with `renderResolver(Resolver, props)`, which captures the Next of the body
 * it is called from and hands it to a runner made for that resolver — the
 * child continues the chain where its parent stood. Called anywhere else, or
 * a `useNextResolver()` reached outside a body, throws: the chain has no
 * silent answer to give there.
 */
export const createComponentResolver = (resolvers, { pure } = {}) => {
  const runners = [];
  const lastIndex = resolvers.length - 1;
  for (let index = 0; index < resolvers.length; index++) {
    const Resolver = resolvers[index];
    const isLast = index === lastIndex;
    function Runner(props) {
      return runResolverBody(
        this,
        Resolver,
        props,
        isLast ? null : runners[index + 1],
      );
    }
    Runner.displayName = Resolver.displayName || Resolver.name;
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

export const useNextResolver = () => {
  if (currentNext === OUTSIDE_RESOLVER_BODY) {
    throw new Error(
      "useNextResolver() called outside a resolver body: a resolver rendered by another resolver is rendered with renderResolver(Resolver, props), not as a JSX child.",
    );
  }
  return currentNext;
};

export const renderResolver = (Resolver, props) => {
  if (currentNext === OUTSIDE_RESOLVER_BODY) {
    throw new Error(
      `renderResolver(${Resolver.displayName || Resolver.name}) called outside a resolver body: only a resolver can render another one.`,
    );
  }
  let SubRunner = subRunnerByResolver.get(Resolver);
  if (!SubRunner) {
    SubRunner = function (props) {
      const { [NEXT_PROP]: next, ...ownProps } = props;
      return runResolverBody(this, Resolver, ownProps, next);
    };
    SubRunner.displayName = Resolver.displayName || Resolver.name;
    subRunnerByResolver.set(Resolver, SubRunner);
  }
  return createElement(SubRunner, { ...props, [NEXT_PROP]: currentNext });
};

// What useNextResolver() answers: the runner after the one whose body is
// running, null for the last — and, outside any body, a value that is neither.
const OUTSIDE_RESOLVER_BODY = Symbol("outside_resolver_body");
let currentNext = OUTSIDE_RESOLVER_BODY;
const runResolverBody = (instance, Resolver, props, next) => {
  const nextBefore = currentNext;
  currentNext = next;
  try {
    return Resolver.call(instance, props);
  } finally {
    currentNext = nextBefore;
  }
};

// One runner per resolver rendered through renderResolver, made on first use:
// the same component type on every render, so a resolver picked again is
// updated in place and another one picked is a remount, like any child.
const subRunnerByResolver = new WeakMap();
// Rides on the props of a sub-runner, stripped before the body sees them.
const NEXT_PROP = "navi-resolver-next";

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
