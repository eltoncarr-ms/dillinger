import { replaceExtension, sanitizeDownloadFilename } from "@/lib/document";

const PRINT_OVERRIDES_CSS = `
  html, body {
    max-width: none;
    margin: 0;
    padding: 0;
  }
  pre, pre code, pre .hljs, code, .hljs {
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    overflow-x: visible !important;
    max-width: 100% !important;
  }
  pre {
    box-sizing: border-box;
  }
  pre * {
    white-space: pre-wrap !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }
  table {
    table-layout: fixed;
    word-wrap: break-word;
    max-width: 100%;
  }
  th, td {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  img, pre, table, blockquote {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    break-after: avoid;
  }
`;

const STYLED_EXPORT_CSS = `
  @import url("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.9.0-alpha2/katex.min.css");

  body {
    font-family: Georgia, Cambria, serif;
    font-size: 14px;
    line-height: 1.7;
    color: #373D49;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  a { color: #35D7BB; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: "Ubuntu Mono", Monaco, monospace;
    background: #F5F7FA;
    padding: 0.2em 0.4em;
    border-radius: 3px;
  }
  pre {
    background: #F5F7FA;
    padding: 1em;
    border-radius: 3px;
    overflow-x: auto;
  }
  .hljs {
    display: block;
    overflow-x: auto;
    padding: 0;
    color: #333;
  }
  pre code { background: none; padding: 0; }
  ul { list-style: disc outside; padding-left: 2em; margin-bottom: 1em; }
  ol { list-style: decimal outside; padding-left: 2em; margin-bottom: 1em; }
  ul ul { list-style: circle outside; }
  ul ul ul { list-style: square outside; }
  li { margin-bottom: 0.25em; }
  li.task-list-item { list-style: none; margin-left: -1.5em; }
  blockquote {
    border-left: 4px solid #35D7BB;
    padding: 0.75em 1em;
    margin: 0 0 1em 0;
    font-style: italic;
    color: #2B2F36;
    background: #E4E9F2;
    border-radius: 0 4px 4px 0;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid #E8E8E8;
    padding: 0.5em;
    text-align: left;
  }
  th {
    background: #F5F7FA;
    font-weight: 600;
  }
  #preview .table {
    width: auto;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
  }
`;

export function getExportFilename(title: string | undefined, extension: string): string {
  const safeTitle = sanitizeDownloadFilename(title?.trim() || "document");
  return sanitizeDownloadFilename(replaceExtension(safeTitle, extension));
}

export function renderHtmlDocument({
  title,
  html,
  styled,
  forPrint,
}: {
  title?: string;
  html: string;
  styled?: boolean;
  forPrint?: boolean;
}): string {
  const styleParts: string[] = [];
  if (styled) styleParts.push(STYLED_EXPORT_CSS);
  if (forPrint) styleParts.push(PRINT_OVERRIDES_CSS);
  const styleTag = styleParts.length
    ? `<style>${styleParts.join("\n")}</style>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || "Document"}</title>
  ${styleTag}
</head>
<body id="preview">
${html}
</body>
</html>`;
}
