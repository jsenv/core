const SIZES = {
  xxl: 100,
  xl: 50,
  l: 20,
  md: 10,
  s: 5,
  xs: 2,
  xxs: 1,
};

export const Spacing = ({ size = "md", children, ...props }) => {
  const spacingLeftSize = SIZES[size] || parseInt(size);
  const spacingRightSize = SIZES[size] || parseInt(size);
  const spacingTopSize = SIZES[size] || parseInt(size);
  const spacingBottomSize = SIZES[size] || parseInt(size);

  return (
    <div
      {...props}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        paddingLeft: `${spacingLeftSize}px`,
        paddingRight: `${spacingRightSize}px`,
        paddingTop: `${spacingTopSize}px`,
        paddingBottom: `${spacingBottomSize}px`,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
};
