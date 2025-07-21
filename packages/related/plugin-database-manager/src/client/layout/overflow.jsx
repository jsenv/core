export const Overflow = ({ children, afterContent }) => {
  return (
    <div style="display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;">
      <div style="display: flex; flex-grow: 1; width: 0; gap: 0.3em">
        <div style="overflow: hidden; max-width: 100%; text-overflow: ellipsis;">
          {children}
        </div>
        {afterContent}
      </div>
    </div>
  );
};
