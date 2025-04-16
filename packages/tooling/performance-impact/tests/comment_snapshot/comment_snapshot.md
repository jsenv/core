# metric +2%

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 3 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (+2%)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>Duration for setTimeout(100)</td>
        <td nowrap>0.1 second</td>
        <td nowrap>0.1 second</td>
        <td nowrap>+0.002 second / +2%</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>Memory usage for setTimeout(100)</td>
        <td nowrap>50 B</td>
        <td nowrap>51 B</td>
        <td nowrap>+1 B / +2%</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>Number of filesystem read</td>
        <td nowrap>0</td>
        <td nowrap>0</td>
        <td nowrap></td>
        <td>:ghost:</td>
      </tr>
    </tbody>
  </table>
</details>

# metric + 100%

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (+100%)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap>0.1 second</td>
        <td nowrap>0.2 second</td>
        <td nowrap>+0.1 second / +100%</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
  </table>
</details>

# metric -0.2%

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (-0.2%)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap>0.1 second</td>
        <td nowrap>0.1 second</td>
        <td nowrap>-0 second / -0.2%</td>
        <td>:arrow_lower_right:</td>
      </tr>
    </tbody>
  </table>
</details>

# metric -100%

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (-100%)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap>0.1 second</td>
        <td nowrap>0 second</td>
        <td nowrap>-0.1 second / -100%</td>
        <td>:arrow_lower_right:</td>
      </tr>
    </tbody>
  </table>
</details>

# metric duration +0%

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (no impact)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap>0.1 second</td>
        <td nowrap>0.1 second</td>
        <td nowrap></td>
        <td>:ghost:</td>
      </tr>
    </tbody>
  </table>
</details>

# add a group

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (new)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap></td>
        <td nowrap>0.1 second</td>
        <td nowrap></td>
        <td>:baby:</td>
      </tr>
    </tbody>
  </table>
</details>

# remove a group

<h4 id="perf-impact">Performance impact</h4>

<p>No impact to compute when merging <em>head</em> into <em>base</em>: there is no performance metric.</p>

# add a metric

<h4 id="perf-impact">Performance impact</h4>

<p>Impact on 1 metrics when merging <em>head</em> into <em>base</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

<details>
  <summary>timeout (no impact)</summary>
  <table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      <tr>
        <td nowrap>100ms</td>
        <td nowrap></td>
        <td nowrap>0.1 second</td>
        <td nowrap></td>
        <td>:baby:</td>
      </tr>
    </tbody>
  </table>
</details>

# remove a metric

<h4 id="perf-impact">Performance impact</h4>

<p>No impact to compute when merging <em>head</em> into <em>base</em>: there is no performance metric.</p>
