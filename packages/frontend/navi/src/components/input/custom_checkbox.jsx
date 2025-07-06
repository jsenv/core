import.meta.css = /*css*/ `
.custom_checkbox {
  display: inline-flex;
  width: 11px;
  height: 11px;
  margin: 3px 3px 3px 4px;
  border: 1px solid #6b7280;
  border-radius: 2px;
  transition: all 0.15s ease;
}

.custom_checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.custom_checkbox:hover {
  border-color: #9ca3af;
}

.custom_checkbox[data-checked] {
  background: #3b82f6;
  border-color: #3b82f6;
}
.custom_checkbox[data-checked]:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.custom_checkbox svg {
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.15s ease;
  pointer-events: none;
}

.custom_checkbox[data-checked] svg {
  opacity: 1;
  transform: scale(1);
}

.custom_checkbox svg path {
  stroke: white;
}

.custom_checkbox[data-disabled] {
  background-color: light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3));
  color: light-dark(rgb(84, 84, 84), rgb(170, 170, 170));
  border-color: rgba(118, 118, 118, 0.3);

}
.custom_checkbox[data-disabled][data-checked] {
  background: #D3D3D3; 
  border-color: #D3D3D3;
}
.custom_checkbox[data-disabled][data-checked] svg path {
  stroke: #EEEEEE; 
}

.custom_checkbox[data-loading], .custom_checkbox[data-checked][data-loading]  {
  border-color: transparent;
}
`;

export const CustomCheckbox = ({
  checked = false,
  disabled = false,
  loading = false,
  children,
}) => {
  return (
    <div
      className="custom_checkbox"
      data-disabled={disabled ? "" : undefined}
      data-checked={checked ? "" : undefined}
      data-loading={loading ? "" : undefined}
    >
      {children}
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M10.5 2L4.5 9L1.5 5.5" fill="none" strokeWidth="2" />
      </svg>
    </div>
  );
};
