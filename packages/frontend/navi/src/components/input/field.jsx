import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const Field = ({ label, input, disabled, ...rest }) => {
  return (
    <label data-disabled={disabled ? "" : undefined} {...rest}>
      {label}
      {input}
    </label>
  );
};
