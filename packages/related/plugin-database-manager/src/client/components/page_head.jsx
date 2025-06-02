import.meta.css = /* css */ `
  header {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    align-items: center;
  }

  header h1 {
    margin: 0;
    line-height: 1em;
  }

  header > .actions {
  }
`;

export const PageHead = ({ children, actions = [] }) => {
  return (
    <header>
      {children}
      <div className="actions">
        {actions.map((action) => {
          return action.component;
        })}
      </div>
    </header>
  );
};
