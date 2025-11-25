import { Link } from "./link.jsx";

import.meta.css = /* css */ `
  .navi_title > .navi_link[data-link-anchor] {
    position: absolute !important;
    top: 50%;
    left: -1em;
    width: 1em;
    height: 1em;
    font-size: 0.7em;
    opacity: 0;
    transform: translateY(-50%);
  }

  .navi_title > .navi_link[data-link-anchor]:focus,
  .navi_title > .navi_link[data-link-anchor]:focus-visible,
  .navi_title:hover > .navi_link[data-link-anchor] {
    opacity: 1;
  }

  /* The anchor link is displayed only on :hover */
  /* So we "need" a visual indicator when it's shown by focus */
  /* (even if it's focused by mouse aka not :focus-visible) */
  /* otherwise we might wonder why we see this UI element */
  .navi_title > .navi_link[data-link-anchor][data-focus] {
    outline-width: 2px;
  }
`;

export const LinkAnchor = (props) => {
  return <Link color="inherit" id={props.href.slice(1)} {...props} />;
};
