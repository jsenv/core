import { measureWidestChildRow } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { stringifySpacingStyle } from "../box/box_style_util.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
    .navi_badge_list {
      --badge-list-spacing: var(--navi-s);
    }
  }
  .navi_badge_list {
    --badge-list-spacing-px: round(var(--badge-list-spacing), 1px);
    display: inline-block;
    margin-right: calc(-1 * var(--badge-list-spacing-px));
    margin-bottom: calc(-1 * var(--badge-list-spacing-px));
    flex-wrap: wrap;

    .navi_badge {
      margin-right: var(--badge-list-spacing-px);
      margin-bottom: var(--badge-list-spacing-px);
    }
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
  const { spacing = "xxl" } = props;

  return (
    <Text
      spacing="pre"
      className={withPropsClassName("navi_badge_list", className)}
      style={{
        "--badge-list-spacing": stringifySpacingStyle(spacing),
      }}
      {...props}
    >
      {childArray.length ? children : fallback}
    </Text>
  );
};
