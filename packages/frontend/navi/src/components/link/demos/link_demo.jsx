import { Link } from "@jsenv/navi";

export const App = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Link Component Demo</h1>

      <section style={{ marginBottom: "30px" }}>
        <h2>Basic Link Variants by href Type</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Internal relative link:</strong>
            <br />
            <Link href="/about">Internal Page Link</Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Relative path, opens in same tab)
            </small>
          </div>

          <div>
            <strong>Internal absolute link:</strong>
            <br />
            <Link href="https://example.com/internal">
              Internal Absolute Link
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Same domain, opens in same tab)
            </small>
          </div>

          <div>
            <strong>External link:</strong>
            <br />
            <Link href="https://google.com">External Link</Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Different domain, opens in new tab with icon)
            </small>
          </div>

          <div>
            <strong>Anchor link:</strong>
            <br />
            <Link href="#section1">Jump to Section 1</Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Hash anchor, shows anchor icon)
            </small>
          </div>

          <div>
            <strong>Email link:</strong>
            <br />
            <Link href="mailto:hello@example.com">Send Email</Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Email protocol)
            </small>
          </div>

          <div>
            <strong>Telephone link:</strong>
            <br />
            <Link href="tel:+1234567890">Call +1234567890</Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Tel protocol)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Target Control</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Internal link forced to open in new tab:</strong>
            <br />
            <Link href="/page" target="_blank">
              Internal Link (New Tab)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (target=&quot;_blank&quot; overrides default behavior, shows blank
              target icon)
            </small>
          </div>

          <div>
            <strong>External link forced to open in same tab:</strong>
            <br />
            <Link href="https://google.com" target="_self">
              External Link (Same Tab)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (target=&quot;_self&quot; overrides default behavior, no blank
              target icon)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Blank Target Icon Control</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>
              Internal link with target=&quot;_blank&quot; - show icon:
            </strong>
            <br />
            <Link href="/page" target="_blank" blankTargetIcon={true}>
              Internal Link (Show Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (blankTargetIcon=true forces icon display)
            </small>
          </div>

          <div>
            <strong>
              Internal link with target=&quot;_blank&quot; - hide icon:
            </strong>
            <br />
            <Link href="/page" target="_blank" blankTargetIcon={false}>
              Internal Link (Hide Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (blankTargetIcon=false hides the icon)
            </small>
          </div>

          <div>
            <strong>External link - hide blank target icon:</strong>
            <br />
            <Link href="https://google.com" blankTargetIcon={false}>
              External Link (No Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (blankTargetIcon=false hides icon even for external links)
            </small>
          </div>

          <div>
            <strong>Custom blank target icon:</strong>
            <br />
            <Link
              href="https://google.com"
              blankTargetIcon={<span style={{ color: "red" }}>↗️</span>}
            >
              External Link (Custom Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Custom element as blankTargetIcon)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Anchor Icon Control</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Anchor link - show icon:</strong>
            <br />
            <Link href="#section1" anchorIcon={true}>
              Jump to Section (Show Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (anchorIcon=true shows the anchor icon)
            </small>
          </div>

          <div>
            <strong>Anchor link - hide icon:</strong>
            <br />
            <Link href="#section1" anchorIcon={false}>
              Jump to Section (Hide Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (anchorIcon=false hides the anchor icon)
            </small>
          </div>

          <div>
            <strong>Non-anchor link with forced anchor icon:</strong>
            <br />
            <Link href="/page" anchorIcon={true}>
              Regular Link (Forced Anchor Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (anchorIcon=true forces anchor icon display)
            </small>
          </div>

          <div>
            <strong>Custom anchor icon:</strong>
            <br />
            <Link
              href="#section1"
              anchorIcon={<span style={{ color: "blue" }}>🔗</span>}
            >
              Jump to Section (Custom Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (Custom element as anchorIcon)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Custom Icon Override</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>External link with custom icon:</strong>
            <br />
            <Link
              href="https://google.com"
              icon={<span style={{ color: "green" }}>🌐</span>}
            >
              External Link (Custom Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (icon prop overrides all automatic icon logic)
            </small>
          </div>

          <div>
            <strong>Anchor link with custom icon:</strong>
            <br />
            <Link
              href="#section1"
              icon={<span style={{ color: "purple" }}>⚓</span>}
            >
              Anchor Link (Custom Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (icon prop overrides automatic anchor icon)
            </small>
          </div>

          <div>
            <strong>Link with no icon:</strong>
            <br />
            <Link href="https://google.com" icon={null}>
              External Link (No Icon)
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (icon=null removes all icons)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>State Variations</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Disabled link:</strong>
            <br />
            <Link href="/page" disabled>
              Disabled Link
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (disabled prop makes link non-interactive)
            </small>
          </div>

          <div>
            <strong>Read-only link:</strong>
            <br />
            <Link href="/page" readOnly>
              Read-only Link
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (readOnly prop prevents navigation but keeps appearance)
            </small>
          </div>

          <div>
            <strong>Loading link:</strong>
            <br />
            <Link href="/page" loading>
              Loading Link
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (loading prop shows loading state)
            </small>
          </div>

          <div>
            <strong>Visited link:</strong>
            <br />
            <Link href="/page" visited>
              Visited Link
            </Link>
            <small style={{ color: "#666", marginLeft: "10px" }}>
              (visited prop shows visited state styling)
            </small>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Combined Examples</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <strong>Internal link, new tab, custom icon, with spacing:</strong>
            <br />
            <Link
              href="/dashboard"
              target="_blank"
              icon={<span style={{ color: "orange" }}>📊</span>}
              padding="sm"
              margin="xs"
            >
              Dashboard (Complex Example)
            </Link>
          </div>

          <div>
            <strong>External link, same tab, no icon, styled:</strong>
            <br />
            <Link
              href="https://github.com"
              target="_self"
              blankTargetIcon={false}
              style={{
                backgroundColor: "#f0f0f0",
                padding: "8px 12px",
                borderRadius: "4px",
                textDecoration: "none",
              }}
            >
              GitHub (Same Tab, No Icon)
            </Link>
          </div>
        </div>
      </section>

      {/* Anchor targets for testing */}
      <div
        id="section1"
        style={{
          marginTop: "50px",
          padding: "20px",
          backgroundColor: "#f5f5f5",
        }}
      >
        <h3>Section 1</h3>
        <p>This is the target section for anchor links.</p>
      </div>
    </div>
  );
};
