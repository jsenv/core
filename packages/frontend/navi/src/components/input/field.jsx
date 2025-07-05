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

  return (
    <label data-disabled={disabled ? "" : undefined} {...rest}>
      {children}
    </label>
  );
};
