import { createContext } from "preact";
import { useContext } from "preact/hooks";

const NextContext = createContext(null);

export const useNext = () => useContext(NextContext);

/**
 * Creates a renderComponent function that passes props through a chain of enhancers.
 * Each enhancer is rendered as a proper component (hooks are allowed).
 * To pass through to the next enhancer, an enhancer calls useNext() and renders
 * the returned Next component with its props.
 * To terminate the chain early (e.g. render a specialized component), an enhancer
 * renders its component directly without calling Next.
 *
 * Usage:
 *   const renderButton = createComponentResolver([EnhancerA, EnhancerB]);
 *   // Then inside a component render:
 *   renderButton(ButtonTarget, props)
 *
 * NextContext exposes a stable Next component so enhancers can continue
 * the chain via useNext().
 * EnhancerIndexContext tracks which enhancer is next so that when an enhancer
 * re-renders and calls Next, the chain resumes from the correct position.
 */
export const createComponentResolver = (enhancers) => {
  const EnhancerIndexContext = createContext(0);
  const TargetComponentContext = createContext(null);

  const ChainRunner = (props) => {
    const index = useContext(EnhancerIndexContext);
    const TargetComponent = useContext(TargetComponentContext);
    if (index >= enhancers.length) {
      return (
        <NextContext.Provider value={null}>
          <TargetComponent {...props} />
        </NextContext.Provider>
      );
    }
    const Enhancer = enhancers[index];
    return (
      <EnhancerIndexContext.Provider value={index + 1}>
        <Enhancer {...props} />
      </EnhancerIndexContext.Provider>
    );
  };

  // Stable component defined once per createComponentResolver call.
  // Renders ChainRunner directly — no new providers — so EnhancerIndexContext
  // is inherited from the parent tree. When an enhancer calls <Next>, the chain
  // resumes from index+1 (already set by the Provider wrapping that enhancer).
  const NextComponent = (props) => <ChainRunner {...props} />;

  const renderComponent = (TargetComponent, props) => {
    return (
      <NextContext.Provider value={NextComponent}>
        <TargetComponentContext.Provider value={TargetComponent}>
          <ChainRunner {...props} />
        </TargetComponentContext.Provider>
      </NextContext.Provider>
    );
  };

  return renderComponent;
};
