import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  .navi_icon {
    display: inline-block;
    box-sizing: border-box;
    min-width: 1.5em;
    height: 1.5em;
    max-height: 1.5em;
    padding-right: var(
      --padding-right,
      var(--padding-x, var(--padding, 0.4em))
    );
    padding-left: var(--padding-left, var(--padding-x, var(--padding, 0.4em)));
    text-align: center;
    line-height: 1.5em;
    vertical-align: middle;
  }
`;

export const Icon = ({ href, children, ...props }) => {
  const innerChildren = href ? (
    <svg width="100%" height="100%">
      <use href={href} />
    </svg>
  ) : (
    children
  );

  let { box, width, height } = props;
  if (width !== undefined || height !== undefined) {
    box = true;
  }

  return (
    <Text
      {...props}
      box={box}
      className="navi_icon"
      data-width={width}
      data-height={height}
    >
      {innerChildren}
    </Text>
  );
};
