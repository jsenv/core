let displayDrawPoints = false;

export const drawPoint = (context, [x, y]) => {
  context.arc(x, y, 2, 0, Math.PI * 2);
};

export const drawLine = (context, start, end) => {
  context.moveTo(start[0], start[1]);
  context.lineTo(end[0], end[1]);
  if (displayDrawPoints) {
    drawPoint(context, start, { color: "aqua" });
    drawPoint(context, end, { color: "chocolate" });
  }
};

export const drawArc = (context, center, radius, fromDegrees, toDegrees) => {
  const [centerX, centerY] = center;
  context.arc(
    centerX,
    centerY,
    radius,
    radianFromDegree(fromDegrees),
    radianFromDegree(toDegrees),
  );
  if (displayDrawPoints) {
    drawPoint(context, center, { color: "chartreuse" });
  }
};
export const radianFromDegree = (degrees) => {
  return degrees * (Math.PI / 180);
};

export const drawArcTo = (context, start, controlPoint, end, radius) => {
  if (radius < 0) {
    return;
  }
  context.moveTo(start[0], start[1]);
  context.arcTo(controlPoint[0], controlPoint[1], end[0], end[1], radius);
  if (displayDrawPoints) {
    drawPoint(context, start, { color: "chartreuse" });
    drawPoint(context, controlPoint, { color: "violet" });
    drawPoint(context, end, { color: "chartreuse" });
  }
};

export const drawQuadraticCurveTo = (
  context,
  start,
  controlPoint,
  endPoint,
) => {
  let [startX, startY] = start;
  let [controlX, controlY] = controlPoint;
  let [endX, endY] = endPoint;
  context.moveTo(startX, startY);
  context.quadraticCurveTo(controlX, controlY, endX, endY);
  if (displayDrawPoints) {
    drawPoint(context, start, { color: "chartreuse" });
    drawPoint(context, controlPoint, { color: "violet" });
    drawPoint(context, endPoint, { color: "chartreuse" });
  }
};
