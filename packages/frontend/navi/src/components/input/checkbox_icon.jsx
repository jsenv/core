import.meta.css = /*css*/ `
.checkbox_icon {
  display: inline-flex;
  width: 10.5px;
  height: 10.5px;
  margin: 3px 3px 3px 4px;
  border: 1.5px solid #6b7280;
  border-radius: 2px;
  transition: all 0.15s ease;
}

.checkbox_icon:hover {
  border-color: #9ca3af;
}

.checkbox_icon[data-checked] {
  background: #3b82f6;
  border-color: #3b82f6;
}
.checkbox_icon[data-checked]:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.checkbox_icon svg {
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.15s ease;
}

.checkbox_icon[data-checked] svg {
  opacity: 1;
  transform: scale(1);
}

.checkbox_icon svg path {

}
`;

export const CheckboxIcon = ({ checked = false, pending = false }) => {
  return (
    <div
      className="checkbox_icon"
      data-checked={checked ? "" : undefined}
      data-pending={pending ? "" : undefined}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M10.5 2L4.5 9L1.5 5.5"
          fill="none"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};
