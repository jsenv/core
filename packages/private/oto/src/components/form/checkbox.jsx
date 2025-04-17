export const Checkbox = ({ children, checked, onCheck, onUnCheck }) => {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (e.target.checked) {
            onCheck();
          } else {
            onUnCheck();
          }
        }}
      />
      {children}
    </label>
  );
};
