# Security

Please report vulnerabilities privately via [GitHub Security Advisories](https://github.com/schreibtischhelden/markdown-pages-editor/security/advisories/new), not as a public issue.

Scope: the editor itself (toolbar, commands, downloads, drafts, preview isolation). The editor does not convert Markdown: the HTML returned by your `render` function is inserted as is, so it must be sanitized (e.g. with DOMPurify) if the Markdown is not trusted - see the README.
