export const Lifebar = ({
  value,
  max,
  fullColor = "yellow",
  emptyColor = "red",
}) => {
  if (max <= 40) {
    const bars = createBars(value, 40);
    return (
      <LifebarSvg
        bars={bars}
        barWidth={2}
        fullColor={fullColor}
        emptyColor={emptyColor}
      />
    );
  }
  const moduloResult = value % 40;
  let numbersOfSmallBarsFilled;
  let numberOfMediumBarsFilled;
  if (moduloResult === 0) {
    numbersOfSmallBarsFilled = value <= 40 ? value : 40;
    numberOfMediumBarsFilled = value <= 40 ? 0 : Math.floor((value - 40) / 40);
  } else {
    numbersOfSmallBarsFilled = moduloResult;
    numberOfMediumBarsFilled = Math.floor(value / 40);
  }
  const smallBars = createBars(numbersOfSmallBarsFilled, 40);
  const numbersOfMediumBars = Math.floor((max - 40) / 40);
  if (numbersOfMediumBars <= 20) {
    const mediumBars = createBars(
      numberOfMediumBarsFilled,
      numbersOfMediumBars,
    );
    return (
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%">
        <div style="height: 70%">
          <LifebarSvg
            bars={smallBars}
            barWidth={2}
            emptyColor={emptyColor}
            fullColor={fullColor}
          />
        </div>
        <div style="height: 30%; padding-top: 1px">
          <div style="height: 100%">
            <LifebarSvg
              bars={mediumBars}
              barWidth={5}
              emptyColor={emptyColor}
              fullColor={fullColor}
            />
          </div>
        </div>
      </div>
    );
  }
  const mediumBarsFirstRow = createBars(numberOfMediumBarsFilled, 20);
  const mediumBarsSecondRow = createBars(
    numberOfMediumBarsFilled - 20,
    numbersOfMediumBars - 20,
  );
  return (
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%">
      <div style="height: 30%">
        <LifebarSvg
          bars={smallBars}
          barWidth={2}
          emptyColor={emptyColor}
          fullColor={fullColor}
        />
      </div>
      <div style="height: 60%;">
        <div style="height: 50%; padding-top: 1px">
          <div style="height: 100%">
            <LifebarSvg
              bars={mediumBarsFirstRow}
              barWidth={5}
              emptyColor={emptyColor}
              fullColor={fullColor}
            />
          </div>
        </div>
        <div style="height: 50%; padding-top: 1px">
          <div style="height: 100%">
            <LifebarSvg
              bars={mediumBarsSecondRow}
              barWidth={5}
              emptyColor={emptyColor}
              fullColor={fullColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const createBars = (filledCount, totalCount) => {
  const bars = [];
  let i = 0;
  while (i < totalCount) {
    bars.push({
      from: i,
      to: i + 1,
      filled: i < filledCount,
    });
    i++;
  }
  return bars;
};

const LifebarSvg = ({
  barWidth,
  bars,
  barSpacing = 1,
  fullColor,
  emptyColor,
}) => {
  const barHeight = 20;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 120 ${barHeight}`}
      style={{ display: "flex" }}
      preserveAspectRatio="none"
    >
      <g>
        {bars.map((bar, index) => {
          const x = index * (barWidth + barSpacing);
          return (
            <rect
              key={index}
              name={`life_${bar.from}:${bar.to}`}
              x={x}
              y="0"
              width={barWidth}
              height={barHeight}
              fill={bar.filled ? fullColor : emptyColor}
            ></rect>
          );
        })}
      </g>
    </svg>
  );
};
