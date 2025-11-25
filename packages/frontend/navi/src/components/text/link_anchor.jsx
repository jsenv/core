import { useContext } from "preact/hooks";

import { Link } from "./link.jsx";
import { TitleLevelContext } from "./title.jsx";

import.meta.css = /* css */ `
  .navi_link_anchor[data-discrete] {
    position: absolute !important;
    top: 1em;
    left: -1em;
    width: 1em;
    height: 1em;
    font-size: 1em;
    opacity: 0;
    transform: translateY(-25%);
  }

  .navi_title .navi_link_anchor {
    font-size: 0.7em;
  }

  .navi_link.navi_link_anchor[data-visited] {
    /* We don't want to change the color of those links when they are visited */
    /* Here it makes no sense */
    --x-link-color: var(--link-color);
  }

  .navi_link_anchor[data-discrete]:focus,
  .navi_link_anchor[data-discrete]:focus-visible,
  *:hover > .navi_link_anchor {
    opacity: 1;
  }
  /* The anchor link is displayed only on :hover */
  /* So we "need" a visual indicator when it's shown by focus */
  /* (even if it's focused by mouse aka not :focus-visible) */
  /* otherwise we might wonder why we see this UI element */
  .navi_link_anchor[data-discrete][data-focus] {
    outline-width: 2px;
  }
`;

export const LinkAnchor = (props) => {
  const titleLevel = useContext(TitleLevelContext);

  return (
    <Link
      className="navi_link_anchor"
      color="inherit"
      id={props.href.slice(1)}
      data-discrete={props.discrete || titleLevel ? "" : undefined}
      {...props}
    />
  );
};
