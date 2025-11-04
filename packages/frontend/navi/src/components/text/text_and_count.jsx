import { TextOverflow } from "./text_overflow.jsx";

import.meta.css = /* css */ `
  .navi_text_and_count {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .navi_count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;

export const TextAndCount = ({ text, count }) => {
  return (
    <TextOverflow
      className="navi_text_and_count"
      afterContent={count > 0 && <span className="navi_count">({count})</span>}
    >
      {text}
    </TextOverflow>
  );
};
