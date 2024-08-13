# basic example

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+13%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/foo.js</td>
        <td nowrap>115 B (+15 B / +15%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/bar.js</td>
        <td nowrap>110 B (+10 B / +10%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>225 B (+25 B / +13%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# basic example + gzip + brotli

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+13%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th nowrap>new brotli size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/foo.js</td>
        <td nowrap>115 B (+15 B / +15%)</td>
        <td nowrap>24 B (+4 B / +20%)</td>
        <td nowrap>21 B (+3 B / +17%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/bar.js</td>
        <td nowrap>110 B (+10 B / +10%)</td>
        <td nowrap>22 B (+2 B / +10%)</td>
        <td nowrap>19 B (+1 B / +6%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>225 B (+25 B / +13%)</td>
        <td nowrap>46 B (+6 B / +15%)</td>
        <td nowrap>40 B (+4 B / +11%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# no changes

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (no impact)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap><i>Unmodified (1)</i></td>
        <td nowrap>110 B (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (1)</strong></td>
        <td nowrap>110 B (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tfoot>
  </table>
</details>

# no files

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (no impact)</summary>
  <p>No file in dist group (see config below).</p>

```json
{
  "*/**": false
}
```

</details>

# changes cancels each other

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (no impact)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/file-a.js</td>
        <td nowrap>15 B (+5 B / +50%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/file-b.js</td>
        <td nowrap>10 B (-5 B / -33%)</td>
        <td>:arrow_lower_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>25 B (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tfoot>
  </table>
</details>

# realist (two groups + gzip + partial)

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>critical files (+6%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/foo.js</td>
        <td nowrap>85.5 kB (+7 kB / +9%)</td>
        <td nowrap>36.6 kB (+4 kB / +12%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap><i>Unmodified (1)</i></td>
        <td nowrap>45.5 kB (0 B / +0%)</td>
        <td nowrap>23.5 kB (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>131 kB (+7 kB / +6%)</td>
        <td nowrap>60.1 kB (+4 kB / +7%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

<details>
  <summary>remaining files (-8%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/feature.js</td>
        <td nowrap>1.6 kB (-5.9 kB / -79%)</td>
        <td nowrap>472 B (-60 B / -11%)</td>
        <td>:arrow_lower_right:</td>
      </tr>
      <tr>
        <td nowrap><i>Unmodified (4)</i></td>
        <td nowrap>69.8 kB (0 B / +0%)</td>
        <td nowrap>38.1 kB (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (5)</strong></td>
        <td nowrap>71.4 kB (-5.9 kB / -8%)</td>
        <td nowrap>38.6 kB (-60 B / -0.2%)</td>
        <td>:arrow_lower_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# two groups + gzip + brotli

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist/commonjs (+12%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th nowrap>new brotli size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/commonjs/hello.js</td>
        <td nowrap>187 kB (+20 kB / +12%)</td>
        <td nowrap>1.8 kB (+200 B / +13%)</td>
        <td nowrap>1.7 kB (+200 B / +13%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/commonjs/foo.js</td>
        <td nowrap>120 B</td>
        <td nowrap>12 B</td>
        <td nowrap>11 B</td>
        <td>:baby:</td>
      </tr>
      <tr>
        <td nowrap><del>dist/commonjs/bar.js</del></td>
        <td nowrap>deleted (-100 B)</td>
        <td nowrap>deleted (-10 B)</td>
        <td nowrap>deleted (-9 B)</td>
        <td></td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (3)</strong></td>
        <td nowrap>187 kB (+20 kB / +12%)</td>
        <td nowrap>1.8 kB (+202 B / +13%)</td>
        <td nowrap>1.7 kB (+202 B / +13%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

<details>
  <summary>dist/systemjs (+12%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th nowrap>new brotli size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/systemjs/hello.js</td>
        <td nowrap>187 kB (+20 kB / +12%)</td>
        <td nowrap>1.8 kB (+200 B / +13%)</td>
        <td nowrap>1.7 kB (+200 B / +13%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/systemjs/foo.js</td>
        <td nowrap>120 B</td>
        <td nowrap>12 B</td>
        <td nowrap>11 B</td>
        <td>:baby:</td>
      </tr>
      <tr>
        <td nowrap><del>dist/systemjs/bar.js</del></td>
        <td nowrap>deleted (-100 B)</td>
        <td nowrap>deleted (-10 B)</td>
        <td nowrap>deleted (-9 B)</td>
        <td></td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (3)</strong></td>
        <td nowrap>187 kB (+20 kB / +12%)</td>
        <td nowrap>1.8 kB (+202 B / +13%)</td>
        <td nowrap>1.7 kB (+202 B / +13%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# zero size impact

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+0.5%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/bar.js</td>
        <td nowrap>315 B (+15 B / +5%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/foo.js</td>
        <td nowrap>2.5 kB (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>2.8 kB (+15 B / +0.5%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# size impact 0/1

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+1%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/bar.js</td>
        <td nowrap>101 B (+1 B / +1%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (1)</strong></td>
        <td nowrap>101 B (+1 B / +1%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# size impact 1/2

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+7%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>dist/foo.js</td>
        <td nowrap>115 B (+14 B / +14%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>dist/bar.js</td>
        <td nowrap>101 B (+1 B / +1%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (2)</strong></td>
        <td nowrap>216 B (+15 B / +7%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# formating file relative url

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+14%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>foo.js</td>
        <td nowrap>115 B (+14 B / +14%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (1)</strong></td>
        <td nowrap>115 B (+14 B / +14%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>

# empty warning

---

**Warning:** Nothing is tracked. It happens when tracking config is an empty object.

---

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>

# lot of files

<h4 id="file-size-impact">File size impact</h4>

<p>Impact on file sizes when merging <em>head</em> into <em>base</em>.</p>
<details>
  <summary>dist (+0.3%)</summary>
  <table>
    <thead>
      <tr>
        <th nowrap>Files</th>
        <th nowrap>new size</th>
        <th nowrap>new gzip size</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td nowrap>1.js</td>
        <td nowrap>2 kB (+1.9 kB / +1900%)</td>
        <td nowrap>200 B (+180 B / +900%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
      <tr>
        <td nowrap>2.js</td>
        <td nowrap>20 B (-180 B / -90%)</td>
        <td nowrap>10 B (-30 B / -75%)</td>
        <td>:arrow_lower_right:</td>
      </tr>
      <tr>
        <td nowrap>0.js</td>
        <td nowrap>0 B (0 B / +0%)</td>
        <td nowrap>0 B (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
      <tr>
        <td nowrap><i>Unmodified (97)</i></td>
        <td nowrap>495 kB (0 B / +0%)</td>
        <td nowrap>98.9 kB (0 B / +0%)</td>
        <td>:ghost:</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td nowrap><strong>Total (100)</strong></td>
        <td nowrap>497 kB (+1.7 kB / +0.3%)</td>
        <td nowrap>99.2 kB (+150 B / +0.2%)</td>
        <td>:arrow_upper_right:</td>
      </tr>
    </tfoot>
  </table>
</details>
