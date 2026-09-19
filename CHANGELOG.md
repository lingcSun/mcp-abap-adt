# Changelog

## [1.3.0] - 2026-09-19
- `syntaxCheckCode`: new `filePath` parameter reads the source from a local
  file (for large files, bypassing the client context); mutually exclusive
  with `code`; precedence is explicit `code` > `filePath` > the session
  source cache. Ported back after being lost in the upstream merge.
- `createObject`: new optional `language`, `masterLanguage`, `masterSystem`
  parameters via the options-object overload; without them object creation
  fails on non-English systems and leaves a stale lock record.
- `validateNewObject`: takes structured parameters instead of a JSON-encoded
  options string; the handler args double as the client's `ValidateOptions`.
- `dumps`: each dump now returns the key ST22 sections (header key/values,
  where terminated, error analysis, source extract with the `>>` crash line,
  call stack as include:line frames) instead of the full escaped HTML body.
- `setDomainProperties` / `setDataElementProperties`: fixed tool dispatch —
  invocations previously fell through to `packageSearchHelp` instead of the
  dedicated handlers.

## [1.2.1] - 2026-09-18
- `setObjectSource`: restored the `filePath` parameter (read source from a
  local file, bypassing the client context), lost in the upstream merge.
  `source` and `filePath` are mutually exclusive; exactly one is required.
- `login`: returns a stable `{status: "logged in", httpStatus}` contract
  instead of leaking the raw compatibility-graph HTTP response.
- Restored fork identity fields overwritten by the merge: `bin`
  (`mcp-abap-adt`), `mcpName`, author, repository links; removed the stray
  duplicate dependency on unscoped `abap-adt-api`.
- Fixed post-merge test/verify drift: tool count 126→129 (handlers) /
  128→131 (catalog), verify-package temp-dir isolation and bin lookup.

## [1.2.0] - 2026-09-18
- Merged upstream PR #23 (bounded workflows rewrite: ResultPages paging,
  SourceCache, BoundedHttpClient timeouts, HTTP origin gate with
  `SAP_ALLOW_HTTP=1`, MCP v2 support); ported fork tools
  `downloadObjectSource`, `setDataElementProperties`, `setDomainProperties`;
  dependency on `@lingc-sun/abap-adt-api` (session-expiry auto-relogin).

## [0.1.0] - Initial Commit
- Initial project setup.

## [0.1.1] - Better unified response structure
- Improved and unified the response structure.
