import { useDocumentUrl } from "@jsenv/navi/src/nav/browser_integration/document_url_signal.js";
import { getHrefTargetInfo } from "@jsenv/navi/src/nav/browser_integration/href_target_info.js";
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

// What the href means next to the page one is on depends on the document url,
// so a button with an href re-renders at every address write. One without
// never reaches here: it has nothing to re-compute, and every button on screen
// would otherwise pay for each write.
const ButtonWithHref = (props) => {
  const Next = useNextResolver();
  const { href, target, rel, pseudoState } = props;
  // Read for the subscription: getHrefTargetInfo reads window.location.
  useDocumentUrl();
  const { isSameSite, isCurrent } = getHrefTargetInfo(href);
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
