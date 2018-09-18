export const createBrowserIndexHTML = ({ loaderSource }) => {
  return `<!doctype html>

<head>
  <title>Skeleton for chrome headless</title>
  <meta charset="utf-8" />
	<script type="text/javascript">
		${loaderSource}
	</script>
  <script type="text/javascript">
    window.System = window.createBrowserLoader.createBrowserLoader()
  </script>
</head>

<body>
  <main></main>
</body>

</html>`
}
