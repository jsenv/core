import.meta.css = /* css */ `
  .text_and_count {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .count {
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const TextAndCount = ({ text, count }) => {
  return (
    <span className="text_and_count">
      <span className="label">{text}</span>
      {count > 0 && <span className="count">({count})</span>}
    </span>
  );
};
