import { toChildArray } from "preact";

export const Cell = ({
  vertical = false,
  spacing,
  children,
  // width,
  // height,
  ...props
}) => {
  children = toChildArray(children);
  const style = {
    ...props.style,
    display: "grid",
    // width,
    // height,
  };

  if (children.length) {
    if (vertical) {
      let rows = [];
      for (const child of children) {
        const height = child.props?.height;
        rows.push(height === "..." ? "1fr" : height || "auto");
      }
      style.gridTemplateRows = rows.join(" ");
    } else {
      let columns = [];
      for (const child of children) {
        const width = child.props?.width;
        columns.push(width === "..." ? "1fr" : width || "auto");
      }
      style.gridTemplateColumns = columns.join(" ");
    }
  }
  if (spacing) {
    style.gridGap = spacing;
  }
  return (
    <div {...props} style={style}>
      {children}
    </div>
  );
};
