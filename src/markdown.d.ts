/** Markdown files are bundled as text; `angular.json` sets the loader for the build and the tests. */
declare module '*.md' {
  const text: string;
  export default text;
}
