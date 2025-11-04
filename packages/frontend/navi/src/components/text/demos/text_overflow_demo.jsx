import { TextOverflow } from "@jsenv/navi";
import { useState } from "preact/hooks";

export const App = () => {
  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <h1>TextOverflow Component Demo</h1>

      {/* Basic Usage */}
      <section>
        <h2>Basic Text Overflow</h2>
        <div
          style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
        >
          <TextOverflow>
            This is a very long text that should be truncated with ellipsis when
            it overflows
          </TextOverflow>
        </div>
      </section>

      {/* With After Content */}
      <section>
        <h2>With After Content</h2>
        <div
          style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
        >
          <TextOverflow
            afterContent={<span style={{ color: "#666" }}>(modified)</span>}
          >
            This text has additional content after it that stays visible
          </TextOverflow>
        </div>
      </section>

      {/* Different Container Sizes */}
      <section>
        <h2>Different Container Widths</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[150, 200, 300, 400].map((width) => (
            <div
              key={width}
              style={{
                width: `${width}px`,
                border: "1px solid #ccc",
                padding: "8px",
              }}
            >
              <div
                style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
              >
                Width: {width}px
              </div>
              <TextOverflow>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor
              </TextOverflow>
            </div>
          ))}
        </div>
      </section>

      {/* Different HTML Tags */}
      <section>
        <h2>Different HTML Elements</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;div&quot; (default)
            </div>
            <TextOverflow>
              This is rendered as a div element with overflow handling
            </TextOverflow>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;p&quot;
            </div>
            <TextOverflow as="p">
              This is rendered as a paragraph element with overflow
            </TextOverflow>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;span&quot;
            </div>
            <TextOverflow as="span">
              This is rendered as a span element with overflow
            </TextOverflow>
          </div>
        </div>
      </section>

      {/* With Typography Props */}
      <section>
        <h2>With Typography Styling</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Bold text
            </div>
            <TextOverflow textBold textColor="blue">
              This is bold blue text that will overflow with ellipsis
            </TextOverflow>
          </div>

          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Large italic text
            </div>
            <TextOverflow textSize="lg" textItalic textColor="green">
              This is large italic green text with overflow handling
            </TextOverflow>
          </div>

          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Small text
            </div>
            <TextOverflow textSize="sm" textColor="#666">
              This is small gray text that demonstrates overflow behavior
            </TextOverflow>
          </div>
        </div>
      </section>

      {/* With Layout Props */}
      <section>
        <h2>With Layout Props</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With padding and margin
            </div>
            <TextOverflow
              padding="sm"
              margin="xs"
              style={{ backgroundColor: "#f0f0f0" }}
            >
              Text with padding and margin that will overflow properly
            </TextOverflow>
          </div>

          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With border and background
            </div>
            <TextOverflow
              padding="sm"
              style={{
                backgroundColor: "#e3f2fd",
                border: "1px solid #2196f3",
                borderRadius: "4px",
              }}
            >
              Styled text container with overflow handling and visual styling
            </TextOverflow>
          </div>
        </div>
      </section>

      {/* Complex After Content */}
      <section>
        <h2>Complex After Content</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "280px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With icon after
            </div>
            <TextOverflow
              afterContent={
                <span style={{ color: "#f44336", fontSize: "14px" }}>⚠️</span>
              }
            >
              Important message that might be too long to display fully
            </TextOverflow>
          </div>

          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With multiple elements after
            </div>
            <TextOverflow
              afterContent={
                <div
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                >
                  <span style={{ fontSize: "12px", color: "#666" }}>(3)</span>
                  <span style={{ fontSize: "14px" }}>📎</span>
                </div>
              }
            >
              Document title with attachment count and icon that demonstrates
              overflow
            </TextOverflow>
          </div>
        </div>
      </section>

      {/* Interactive Examples */}
      <section>
        <h2>Interactive Width Control</h2>
        <InteractiveWidthDemo />
      </section>
    </div>
  );
};

const InteractiveWidthDemo = () => {
  const [width, setWidth] = useState(200);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label htmlFor="width-slider">Container Width: {width}px</label>
        <input
          id="width-slider"
          type="range"
          min="100"
          max="500"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>

      <div
        style={{
          width: `${width}px`,
          border: "2px solid #2196f3",
          padding: "12px",
        }}
      >
        <TextOverflow
          afterContent={<span style={{ color: "#666" }}>✓</span>}
          textBold
        >
          Resize me to see how the text overflow behavior adapts to different
          container widths
        </TextOverflow>
      </div>
    </div>
  );
};
