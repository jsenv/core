# basic

<!-- before_merge_gist_id=base -->
<!-- after_merge_gist_id=head -->
<h4>Lighthouse impact</h4>

<details>
  <summary>perf score: 90 (+10)</summary>
  
  
  <table>
    <thead>
      <tr>
        <th nowrap>perf audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>whatever</td>
        <td nowrap>+20</td>
        <td nowrap>50</td>
        <td nowrap>70</td>
      </tr>
      <tr>
        <td nowrap>foo</td>
        <td nowrap>---</td>
        <td nowrap>☓</td>
        <td nowrap>✔</td>
      </tr>
    </tbody>
  </table>
</details>

<sub>
  Impact analyzed comparing <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=base">base report</a> and <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=head">report after merge</a>
</sub><br />

# version mismatch

---

**Warning:** Impact analysis skipped because lighthouse version are different on `base` (1.0.0) and `head` (1.0.1).

---

<!-- before_merge_gist_id=base -->
<!-- after_merge_gist_id=head -->
<h4>Lighthouse impact</h4>
<sub>
  Impact analyzed comparing <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=base">base report</a> and <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=head">report after merge</a>
</sub><br />

# real

<!-- before_merge_gist_id=base -->
<!-- after_merge_gist_id=head -->
<h4>Lighthouse impact</h4>

<details>
  <summary>performance score: 99 (no impact)</summary>
  <br /><blockquote>Keep in mind performance score variation may be caused by external factors. <a href="https://github.com/GoogleChrome/lighthouse/blob/91b4461c214c0e05d318ec96f6585dcca52a51cc/docs/variability.md#score-variability">Learn more</a>.</blockquote>
  
  <table>
    <thead>
      <tr>
        <th nowrap>performance audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>first-contentful-paint</td>
        <td nowrap>none</td>
        <td nowrap>96</td>
        <td nowrap>96</td>
      </tr>
      <tr>
        <td nowrap>first-meaningful-paint</td>
        <td nowrap>none</td>
        <td nowrap>96</td>
        <td nowrap>96</td>
      </tr>
      <tr>
        <td nowrap>speed-index</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>interactive</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>first-cpu-idle</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>max-potential-fid</td>
        <td nowrap>none</td>
        <td nowrap>99</td>
        <td nowrap>99</td>
      </tr>
      <tr>
        <td nowrap>estimated-input-latency</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>total-blocking-time</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>render-blocking-resources</td>
        <td nowrap>none</td>
        <td nowrap>87</td>
        <td nowrap>87</td>
      </tr>
      <tr>
        <td nowrap>uses-responsive-images</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>offscreen-images</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>unminified-css</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>unminified-javascript</td>
        <td nowrap>none</td>
        <td nowrap>75</td>
        <td nowrap>75</td>
      </tr>
      <tr>
        <td nowrap>unused-css-rules</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>uses-optimized-images</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>uses-webp-images</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>uses-text-compression</td>
        <td nowrap>none</td>
        <td nowrap>58</td>
        <td nowrap>58</td>
      </tr>
      <tr>
        <td nowrap>uses-rel-preconnect</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>time-to-first-byte</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>redirects</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>uses-rel-preload</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>efficient-animated-content</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>total-byte-weight</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>uses-long-cache-ttl</td>
        <td nowrap>none</td>
        <td nowrap>37</td>
        <td nowrap>37</td>
      </tr>
      <tr>
        <td nowrap>dom-size</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>critical-request-chains</td>
        <td nowrap>none</td>
        <td nowrap>2 chains found</td>
        <td nowrap>2 chains found</td>
      </tr>
      <tr>
        <td nowrap>bootup-time</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>mainthread-work-breakdown</td>
        <td nowrap>none</td>
        <td nowrap>100</td>
        <td nowrap>100</td>
      </tr>
      <tr>
        <td nowrap>font-display</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>resource-summary</td>
        <td nowrap>none</td>
        <td nowrap>3 requests • 190 KB</td>
        <td nowrap>3 requests • 190 KB</td>
      </tr>
      <tr>
        <td nowrap>network-requests</td>
        <td nowrap>none</td>
        <td nowrap>3</td>
        <td nowrap>3</td>
      </tr>
      <tr>
        <td nowrap>network-rtt</td>
        <td nowrap>none</td>
        <td nowrap>0 ms</td>
        <td nowrap>0 ms</td>
      </tr>
      <tr>
        <td nowrap>network-server-latency</td>
        <td nowrap>none</td>
        <td nowrap>0 ms</td>
        <td nowrap>0 ms</td>
      </tr>
      <tr>
        <td nowrap>main-thread-tasks</td>
        <td nowrap>none</td>
        <td nowrap>3</td>
        <td nowrap>3</td>
      </tr>
      <tr>
        <td nowrap>metrics</td>
        <td nowrap>none</td>
        <td nowrap>1946.9975</td>
        <td nowrap>1946.9975</td>
      </tr>
    </tbody>
  </table>
</details>

<details>
  <summary>accessibility score: 84 (no impact)</summary>
  
  
  <table>
    <thead>
      <tr>
        <th nowrap>accessibility audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>button-name</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>color-contrast</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>document-title</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>html-has-lang</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
    </tbody>
  </table>
</details>

<details>
  <summary>best-practices score: 86 (no impact)</summary>
  
  
  <table>
    <thead>
      <tr>
        <th nowrap>best-practices audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>appcache-manifest</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>is-on-https</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>uses-http2</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>uses-passive-event-listeners</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>no-document-write</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>external-anchors-use-rel-noopener</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>geolocation-on-start</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>doctype</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>no-vulnerable-libraries</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>js-libraries</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>notification-on-start</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>deprecations</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>password-inputs-can-be-pasted-into</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>errors-in-console</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>image-aspect-ratio</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
    </tbody>
  </table>
</details>

<details>
  <summary>seo score: 60 (no impact)</summary>
  
  
  <table>
    <thead>
      <tr>
        <th nowrap>seo audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>viewport</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>document-title</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>meta-description</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>http-status-code</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>link-text</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>is-crawlable</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>hreflang</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>font-size</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>plugins</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>tap-targets</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
    </tbody>
  </table>
</details>

<details>
  <summary>pwa score: 33 (no impact)</summary>
  
  
  <table>
    <thead>
      <tr>
        <th nowrap>pwa audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>load-fast-enough-for-pwa</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>works-offline</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>offline-start-url</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>is-on-https</td>
        <td nowrap>none</td>
        <td nowrap>✔</td>
        <td nowrap>✔</td>
      </tr>
      <tr>
        <td nowrap>service-worker</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>installable-manifest</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>redirects-http</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>splash-screen</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>themed-omnibox</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>content-width</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>viewport</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>without-javascript</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
      <tr>
        <td nowrap>apple-touch-icon</td>
        <td nowrap>none</td>
        <td nowrap>☓</td>
        <td nowrap>☓</td>
      </tr>
    </tbody>
  </table>
</details>

<sub>
  Impact analyzed comparing <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=base">base report</a> and <a href="https://googlechrome.github.io/lighthouse/viewer/?gist=head">report after merge</a>
</sub><br />
