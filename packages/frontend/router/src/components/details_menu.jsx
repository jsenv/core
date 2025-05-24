const style = /* css */ `
  .select_details {
  }

  .select_details summary {
    position: relative;
    display: inline-flex;
    gap: 0.5em;
    align-items: center;
    padding: 5px 16px;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    white-space: nowrap;
    vertical-align: middle;
    cursor: pointer;
    user-select: none;
    border: 1px solid;
    border-radius: 6px;
    appearance: none;
    transition: 80ms cubic-bezier(0.33, 1, 0.68, 1);
    transition-property: color, background-color, box-shadow, border-color;
    background-color: rgb(224, 230, 235);
    border-color: rgb(69, 76, 84);
  }

  .select_details summary:hover {
    background-color: rgb(218, 224, 231);
    border-color: rgb(69, 76, 84);
    transition-duration: 0.1s;
  }

  .select_details_menu {
    position: absolute;
    top: auto;
    width: 300px;
    height: auto;
    max-height: 480px;
    margin: 8px 0 16px 0;
    font-size: 12px;
    border-width: 1px;
    border-style: solid;
    border-color: rgb(69, 76, 84);
    border-radius: 6px;
    background-color: white;
    display: flex;
  }
`;

export const DetailsMenu = ({ label }) => {
  return (
    <details
      className="select_details"
      onFocusOut={(e) => {
        e.currentTarget.open = false;
      }}
    >
      <style>{style}</style>
      <summary>
        <span>{label}</span>
        <DropdownIcon width="12" height="12" />
      </summary>
      <div className="select_details_menu">Coucou</div>
    </details>
  );
};

const DropdownIcon = ({ width = 24, height = 24 }) => {
  return (
    <svg
      viewBox="0 0 100 50"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="0,0 100,0 50,50" />
    </svg>
  );
};
