import { useLayoutEffect, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  label[data-readonly] {
    opacity: 0.5;
  }
`;

export const Field = (props) => {
  const { label, input, readOnly, ...rest } = props;

  const keys = Object.keys(props);
  const labelIndex = keys.indexOf("label");
  const inputIndex = keys.indexOf("input");
  const labelBeforeInput = labelIndex < inputIndex;

  const children = labelBeforeInput ? [label, input] : [input, label];

  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const labelRef = useRef();
  useLayoutEffect(() => {
    if (!readOnly) {
      return null;
    }
    let animationFrame;
    const updateInputDisabled = () => {
      const label = labelRef.current;
      const input = label.querySelector("input");
      if (!input) {
        setInputReadOnly(false);
      } else {
        setInputReadOnly(input.readonly || input.hasAttribute("data-readonly"));
      }
      animationFrame = requestAnimationFrame(updateInputDisabled);
    };
    updateInputDisabled();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [readOnly]);

  return (
    <label
      ref={labelRef}
      data-readonly={innerReadOnly ? "" : undefined}
      {...rest}
    >
      {children}
    </label>
  );
};
