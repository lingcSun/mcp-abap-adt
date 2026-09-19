# Changelog

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
