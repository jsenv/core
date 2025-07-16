import { useLayoutEffect, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  .label_wrapper_for_opacity {
    display: inline-flex;
  }

  label[data-readonly] .label_wrapper_for_opacity {
    opacity: 0.5;
  }
`;

export const Field = (props) => {
  const { label, input, readOnly, ...rest } = props;

  const keys = Object.keys(props);
  const labelIndex = keys.indexOf("label");
  const inputIndex = keys.indexOf("input");
  const labelBeforeInput = labelIndex < inputIndex;

  const labelWrapped = <div className="label_wrapper_for_opacity">{label}</div>;

  const children = labelBeforeInput
    ? [labelWrapped, input]
    : [input, labelWrapped];

  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const labelRef = useRef();
  useLayoutEffect(() => {
    if (readOnly) {
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
