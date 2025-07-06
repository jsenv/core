export const CUSTOM_CHECKBOX_COLORS = {
  borders: {
    default: "#6b7280",
    hover: "#9ca3af",
    disabled: "rgba(118, 118, 118, 0.3)",
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabledAndChecked: "#D3D3D3",
  },
  background: {
    checked: "#3b82f6",
    checkedAndHover: "#1d4ed8",
    disabled: "light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3))",
    disabledAndChecked: "#D3D3D3",
  },
  checkmark: {
    default: "white",
    disabled: "#EEEEEE",
  },
};

import.meta.css = /*css*/ `
.custom_checkbox {
  display: inline-flex;
  width: 11px;
  height: 11px;
  margin: 3px 3px 3px 4px;
  border: 1px solid ${CUSTOM_CHECKBOX_COLORS.borders.default};
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
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.hover};
}

.custom_checkbox[data-checked] {
  background: ${CUSTOM_CHECKBOX_COLORS.background.checked};
  border-color:${CUSTOM_CHECKBOX_COLORS.borders.checked};
}
.custom_checkbox[data-checked]:hover {
  background: ${CUSTOM_CHECKBOX_COLORS.background.checkedAndHover};
  border-color:${CUSTOM_CHECKBOX_COLORS.borders.checkedAndHover};
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
  stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.default};
}

.custom_checkbox[data-disabled] {
  background-color: ${CUSTOM_CHECKBOX_COLORS.background.disabled};
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabled};

}
.custom_checkbox[data-disabled][data-checked] {
  background: ${CUSTOM_CHECKBOX_COLORS.background.disabledAndChecked}; 
  border-color: ${CUSTOM_CHECKBOX_COLORS.borders.disabledAndChecked};
}
.custom_checkbox[data-disabled][data-checked] svg path {
  stroke: ${CUSTOM_CHECKBOX_COLORS.checkmark.disabled}; 
}

/* [data-loader-visible] .custom_checkbox[data-loading],
[data-loader-visible] .custom_checkbox[data-loading][data-checked]  {
  transition-property: background, transform, opacity, box-shadow;
  border-color: rgba(0, 0, 0, 0.5);
} */
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
