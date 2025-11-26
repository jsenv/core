import { useContext } from "preact/hooks";

import { Link } from "./link.jsx";
import { TitleLevelContext } from "./title.jsx";

import.meta.css = /* css */ ``;

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
