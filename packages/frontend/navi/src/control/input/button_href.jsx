import { documentUrlSignal } from "@jsenv/navi/src/nav/browser_integration/document_url_signal.js";
import {
  getHrefTargetInfo,
  useHrefTargetFlag,
} from "@jsenv/navi/src/nav/browser_integration/href_target_info.js";
import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";

export const ButtonHrefResolver = (props) => {
  const Next = useNextResolver();
  if (props.href !== undefined) {
    return renderResolver(ButtonWithHref, props);
  }
  return <Next {...props} />;
};

// Whether the href is the page one is on depends on the address, and re-renders
// the button only when it flips (see useHrefTargetFlag). Whether it leaves the
// site does not depend on the address.
const ButtonWithHref = (props) => {
  const Next = useNextResolver();
  const { href, target, rel, pseudoState } = props;
  const isCurrent = useHrefTargetFlag(href, "isCurrent");
  const { isSameSite } = getHrefTargetInfo(href, documentUrlSignal.peek());
  return (
    <Next
      {...props}
      target={
        target === undefined ? (isSameSite ? undefined : "_blank") : target
      }
      rel={
        rel === undefined
          ? isSameSite
            ? undefined
            : "noopener noreferrer"
          : rel
      }
      // Under whatever the caller already says: a route knows better whether
      // it is the page one is on (see button_route.jsx), and a demo can force
      // the state.
      pseudoState={{ ":-navi-href-current": isCurrent, ...pseudoState }}
    />
  );
};
