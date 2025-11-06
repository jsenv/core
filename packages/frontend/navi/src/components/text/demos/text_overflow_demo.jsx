import { Box, Count, Icon, Layout, Text } from "@jsenv/navi";
import { useState } from "preact/hooks";

export const App = () => {
  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "900px",
        lineHeight: "1.5",
      }}
    >
      <h1>Text Overflow Demo</h1>

      <section>
        <h2>Basic</h2>
        <Box width="220" border="1px solid #ccc" padding="sm">
          <Text overflowEllipsis>
            This is a very long text that should be truncated with ellipsis when
            it overflows this small container.
          </Text>
        </Box>
      </section>

      <section>
        <h2>Pinned Content</h2>
        <Layout row contentSpacing="16px">
          <Box width="260" border="1px solid #ccc" padding="sm">
            <Text overflowEllipsis>
              This text has extra info that stays visible
              <Text overflowPinned textColor="#666">
                (modified)
              </Text>
            </Text>
          </Box>
          <Box width="260" border="1px solid #ccc" padding="sm">
            <Text overflowEllipsis>
              Text with a dynamic count that is long and will overflow
              <Text overflowPinned textColor="#4caf50">
                <Count>10</Count>
              </Text>
            </Text>
          </Box>
        </Layout>
      </section>

      {/* New section showing icons & styled text with auto spacing */}
      <section>
        <h2>Icons & Styled Text</h2>
        <p style={{ color: "#555", fontSize: "14px" }}>
          Inline icons and styled fragments inside an overflow ellipsis will
          auto-space correctly while the pinned part stays visible.
        </p>
        <Layout row contentSpacing="16px">
          <Box width="300" border="1px solid #ccc" padding="sm">
            <Text overflowEllipsis>
              <Icon>
                <StarSvg />
              </Icon>
              <Text textBold>Important</Text> notification about a process
              currently running with status
              <Icon>
                <StarSvg />
              </Icon>
              <Text textItalic>active</Text>
              <Text overflowPinned textColor="#666">
                (live)
              </Text>
            </Text>
          </Box>
          <Box width="180" border="1px solid #ccc" padding="sm">
            <Text overflowEllipsis>
              <Icon>
                <StarSvg />
              </Icon>
              <Text textUnderline>Truncated</Text> sequence showcasing icon
              spacing with styled parts
              <Text overflowPinned textColor="#666">
                (ok)
              </Text>
            </Text>
          </Box>
        </Layout>
      </section>

      <section>
        <h2>Container Widths</h2>
        <Layout row contentSpacing="12px">
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
              <Text overflowEllipsis>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor
              </Text>
            </div>
          ))}
        </Layout>
      </section>

      <section>
        <h2>HTML Elements</h2>
        <Layout row contentSpacing="12px">
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;div&quot; (default)
            </div>
            <Text overflowEllipsis>
              This is rendered as a div element with overflow handling
            </Text>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;p&quot;
            </div>
            <Text as="p" overflowEllipsis>
              This is rendered as a paragraph element with overflow
            </Text>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;span&quot;
            </div>
            <Text as="span" overflowEllipsis>
              This is rendered as a span element with overflow
            </Text>
          </div>
        </Layout>
      </section>

      {/* Removed 'With Layout Props' section for clarity */}

      <section>
        <h2>Complex Pinned Content</h2>
        <Layout row contentSpacing="12px">
          <div
            style={{ width: "280px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With icon after
            </div>
            <Text overflowEllipsis>
              Important message that might be too long to display fully
              <Text overflowPinned textColor="#f44336" textSize="sm">
                ⚠️
              </Text>
            </Text>
          </div>

          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With multiple elements after
            </div>
            <Text overflowEllipsis>
              Document title with attachment count and icon that demonstrates
              overflow
              <Text overflowPinned>
                <div
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                >
                  <span style={{ fontSize: "12px", color: "#666" }}>(3)</span>
                  <span style={{ fontSize: "14px" }}>📎</span>
                </div>
              </Text>
            </Text>
          </div>
        </Layout>
      </section>

      <section>
        <h2>Interactive Width</h2>
        <InteractiveWidthDemo />
      </section>

      <section>
        <h2>Multiline Behavior</h2>
        <Layout row contentSpacing="16px">
          {/* Test 1: Text with line breaks */}
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Text with line breaks (\\n not respected by default)
            </div>
            <Text overflowEllipsis>
              First line of text{"\n"}
              Second line of text{"\n"}
              Third line that should overflow
            </Text>
          </div>

          {/* Test 2: Vertical alignment test */}
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Vertical alignment comparison
            </div>
            <Box layoutRow textLineHeight="100px">
              <Text overflowEllipsis>
                Just a long line of text that would get overflowed.
              </Text>
              <Text overflowEllipsis>
                Just a long line of text that would get overflowed.
              </Text>
            </Box>
          </div>
        </Layout>
      </section>
    </div>
  );
};

const InteractiveWidthDemo = () => {
  const [width, setWidth] = useState(200);

  return (
    <Layout row contentSpacing="12px">
      <Layout column contentSpacing="12px" contentAlignY="center">
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
      </Layout>

      <Layout width={width} border="2px solid #2196f3" padding="sm">
        <Text overflowEllipsis textBold>
          Resize me to see how the text overflow behavior adapts to different
          container widths
          <Text overflowPinned textColor="#666">
            ✓
          </Text>
        </Text>
      </Layout>
    </Layout>
  );
};

// Simple star icon reused in examples
const StarSvg = () => (
  <svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill="currentColor"
    />
  </svg>
);
