import { Overflow } from "./overflow.jsx";

import.meta.css = /* css */ `
  .text_and_count {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: 1;
    white-space: nowrap;
  }

  .count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const TextAndCount = ({ text, count }) => {
  return (
    <Overflow
      className="text_and_count"
      afterContent={count > 0 && <span className="count">({count})</span>}
    >
      <span className="label">{text}</span>
    </Overflow>
  );
};
