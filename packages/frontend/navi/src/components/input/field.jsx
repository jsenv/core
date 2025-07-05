import { useLayoutEffect, useRef, useState } from "preact/hooks";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const Field = (props) => {
  const { label, input, disabled, ...rest } = props;

  const keys = Object.keys(props);
  const labelIndex = keys.indexOf("label");
  const inputIndex = keys.indexOf("input");
  const labelBeforeInput = labelIndex < inputIndex;

  const children = labelBeforeInput ? [label, input] : [input, label];

  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;
  const labelRef = useRef();
  useLayoutEffect(() => {
    if (!disabled) {
      return null;
    }
    let animationFrame;
    const updateInputDisabled = () => {
      const label = labelRef.current;
      const input = label.querySelector("input");
      if (!input) {
        setInputDisabled(false);
      } else {
        setInputDisabled(input.disabled);
      }
      animationFrame = requestAnimationFrame(updateInputDisabled);
    };
    updateInputDisabled();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [disabled]);

  return (
    <label
      ref={labelRef}
      data-disabled={innerDisabled ? "" : undefined}
      {...rest}
    >
      {children}
    </label>
  );
};
