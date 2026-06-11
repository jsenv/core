import { measureWidestChildRow } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";

const css = /* css */ `
  @layer navi {
  }
  .navi_badge_list {
    flex-wrap: wrap;
  }
`;

export const BadgeList = ({
  fallback,
  children,
  className,
  shrinkWrap = true,
  maxRows,
  ...props
}) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { ref } = props;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    let observer;
    let rafId;
    const applyLayout = () => {
      // Reset constraints so measurements are unconstrained
      if (shrinkWrap) {
        el.style.width = "";
        const optimalWidth = measureWidestChildRow(el);
        if (optimalWidth !== null) {
          el.style.width = `${Math.ceil(optimalWidth)}px`;
        }
      }

      if (maxRows !== undefined) {
        el.style.maxHeight = "";
        el.style.overflow = "";
        const containerTop = el.getBoundingClientRect().top;
        const rowTops = [];
        for (const child of el.children) {
          const childTop = Math.round(
            child.getBoundingClientRect().top - containerTop,
          );
          if (!rowTops.includes(childTop)) {
            rowTops.push(childTop);
          }
          if (rowTops.length > maxRows) {
            break;
          }
        }
        if (rowTops.length >= maxRows) {
          const lastAllowedTop = rowTops[maxRows - 1];
          let maxBottom = 0;
          for (const child of el.children) {
            const rect = child.getBoundingClientRect();
            const childTop = Math.round(rect.top - containerTop);
            if (childTop === lastAllowedTop) {
              const childBottom = Math.round(rect.bottom - containerTop);
              if (childBottom > maxBottom) {
                maxBottom = childBottom;
              }
            }
          }
          el.style.maxHeight = `${maxBottom}px`;
          el.style.overflow = "hidden";
        }
      }
    };
    applyLayout();
    const parent = el.parentElement;
    if (parent) {
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyLayout);
      });
      observer.observe(parent);
    }
    window.addEventListener("resize", applyLayout);
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", applyLayout);
    };
  });

  const childArray = toChildArray(children);
  return (
    <Box
      inline
      flex="x"
      alignY="center"
      spacing="xs"
      className={withPropsClassName("navi_badge_list", className)}
      {...props}
    >
      {childArray.length ? children : fallback}
    </Box>
  );
};
