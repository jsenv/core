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
  ...props
}) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const { ref } = props;

  useLayoutEffect(() => {
    if (!shrinkWrap) {
      return undefined;
    }
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    let observer;
    let rafId;
    const applyWidth = () => {
      el.style.width = "";
      const optimalWidth = measureWidestChildRow(el);
      if (optimalWidth === null) {
        return;
      }
      el.style.width = `${Math.ceil(optimalWidth)}px`;
    };
    applyWidth();
    const parent = el.parentElement;
    if (parent) {
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyWidth);
      });
      observer.observe(parent);
    }
    window.addEventListener("resize", applyWidth);
    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", applyWidth);
    };
  });

  const childArray = toChildArray(children);
  return (
    <Box
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
