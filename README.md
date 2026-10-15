# mcp-abap-adt

An MCP server that exposes SAP ABAP development via the ADT (ABAP Development Tools) REST APIs to LLM clients. It wraps [`@lingc-sun/abap-adt-api`](https://github.com/lingcSun/abap-adt-api) and offers **129 tools** (plus `healthcheck` and `readResultPage`) covering the full ABAP development workflow: object CRUD, source read/write, syntax check, activation, locking, transports, DDIC inspection, Open SQL queries, ATC, debugging, traces, unit tests, refactoring and Git integration — all through one SAP session owned by a trusted local stdio client. SAP authorizations determine what that session can read or change.

Published on npm as [`@lingc-sun/mcp-abap-adt`](https://www.npmjs.com/package/@lingc-sun/mcp-abap-adt). Forked from [mario-andreschak/mcp-abap-abap-adt-api](https://github.com/mario-andreschak/mcp-abap-abap-adt-api), which in turn builds on [marcellourbani/abap-adt-api](https://github.com/marcellourbani/abap-adt-api).

## Requirements

- Node.js `^22.22.2` or `^24.15.0`
- An SAP system with ADT (`/sap/bc/adt`) active in SICF and a user with the corresponding ADT authorizations

## Installation

### Via npx (recommended)

Point your MCP client at the published package:

```json
{
  "mcpServers": {
    "abap-adt": {
      "command": "npx",
      "args": ["-y", "@lingc-sun/mcp-abap-adt"],
      "env": {
        "SAP_URL": "https://sap.example.invalid:44300",
        "SAP_USER": "YOUR_USER",
        "SAP_PASSWORD": "YOUR_PASSWORD",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN",
        "SAP_ALLOW_HTTP": "1"
      }
    }
  }
}
```

On Windows, use `"command": "npx.cmd"` if your client cannot resolve `npx` (see [Troubleshooting](#troubleshooting)).

### Global install

```sh
npm install -g @lingc-sun/mcp-abap-adt
```

This provides the `mcp-abap-adt` binary, so the client config can use `"command": "mcp-abap-adt"` with no args. Prefer npx to stay on the current version automatically.

### From source

```sh
git clone https://github.com/lingcSun/mcp-abap-adt.git
cd mcp-abap-adt
npm ci
npm run build
```

Then configure your MCP client to launch `node` with the absolute path to `dist/index.js`:

```json
{
  "mcpServers": {
    "abap-adt": {
      "command": "node",
      "args": ["/absolute/path/to/this/repo/dist/index.js"],
      "env": {
        "SAP_URL": "https://sap.example.invalid:44300",
        "SAP_USER": "YOUR_USER",
        "SAP_PASSWORD": "YOUR_PASSWORD",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN",
        "SAP_ALLOW_HTTP": "1"
      }
    }
  }
}
```

### Docker

```sh
docker build -t mcp-abap-adt .
```

The image runs as a non-root `node` user and starts `node dist/index.js` over stdio.

## Configuration

Environment comes from the MCP client. A dotenv file is loaded only when `SAP_ENV_FILE` explicitly names it.

| Variable | Required | Description |
| --- | --- | --- |
| `SAP_URL` | yes* | SAP origin, e.g. `https://host:44300`. Must be HTTPS, without path, query or embedded credentials. |
| `SAP_USER` | yes* | SAP user name. |
| `SAP_PASSWORD` | yes* | SAP password. Alternatively `SAP_BEARER_TOKEN`. |
| `SAP_CLIENT` | no | SAP client (three digits, e.g. `100`). |
| `SAP_LANGUAGE` | no | Logon language (e.g. `EN`). |
| `SAP_REQUEST_TIMEOUT_MS` | no | Timeout for login and every underlying HTTP request. Default `60000`, range `100..120000`. |
| `SAP_BEARER_TOKEN` | no | Static bearer token from an authorized broker, replacing the password. Rotate by restarting the process. No XSUAA/OAuth grant flow. |
| `SAP_ALLOW_HTTP` | no | Set to `1` to permit a trusted private HTTP origin. Loopback (`127.0.0.1`, `localhost`, `::1`) is always allowed for fixtures. HTTP exposes credentials to that network. |
| `SAP_ENV_FILE` | no | Explicit path to a dotenv file. |
| `SAP_LOG_LEVEL` | no | Set to `debug` to emit JSON log lines on stderr. |
| `NODE_EXTRA_CA_CERTS` | no | Absolute path to a private CA certificate, configured before Node starts. |

\* Credentials are only required to talk to SAP. Without them the server still starts and answers MCP discovery, and `healthcheck` reports `sapConfigured: false`.

Security notes:

- TLS verification cannot be disabled — `NODE_TLS_REJECT_UNAUTHORIZED=0` is rejected at startup. Use `NODE_EXTRA_CA_CERTS` for private CAs.
- This server exposes stdio only; it is not an HTTP listener or an MCP OAuth provider. It is a trusted operator tool, not an OS sandbox or multi-user service.
- `healthcheck` reports local configuration and session-recovery state, not a verified SAP connection.
- Git tools can ask SAP to contact a remote Git service with supplied credentials; those operations depend on SAP and remote permissions.

## Protocol

Built on the MCP 2.0.0 TypeScript SDK over stdio, supporting both the modern (2026-07-28) discovery flow and legacy (2025-11-25) initialization, with validated tool arguments, cancellation and structured errors. Unknown top-level arguments are rejected.

Tool schemas are derived from pinned `@lingc-sun/abap-adt-api` declarations via `scripts/generate-input-contracts.mjs` (`npm run contracts`; the report lives next to it). `src/lib/input-contracts.json` is generated — never edit it by hand; rerun and review on dependency updates.

## Large payloads

Large inputs and outputs never need to pass through the LLM context:

- **Input via local files:** `setObjectSource` and `syntaxCheckCode` accept a `filePath` (mutually exclusive with the inline `source`/`code` argument) and read the source from disk. `downloadObjectSource` writes an object's source to a local file instead of returning it.
- **Output paging:** results above 64 KiB are replaced by an opaque `resultId`, a JSON page and a `nextOffset`. Call `readResultPage` with the `resultId` and successive offsets, concatenate the pages and JSON-parse to recover the original tool result. Paging never repeats SAP requests and never writes. At most four 4 MiB results live for five minutes; mutations and session resets clear them, and expired results require intentionally repeating the original read.
- **Source cache:** `syntaxCheckCode` can omit `code` entirely and reuse the source last read or written for that URL via `getObjectSource`/`setObjectSource` (per-runtime cache, ≤ 8 MiB, 64 entries, five minutes; cleared by mutating/session operations). Snapshots are the last observed text, not a guarantee against external edits.
- **Bounds:** query/search/ATC defaults are 100 rows with caps of 1000 where available; an API may return an extra sentinel row.

## Session and limits

- **One operation at a time.** Overlapping calls receive a busy error (HTTP 429 semantics). Debugger listeners also occupy the session until completed or cancelled.
- **Cancellation and timeouts** close real sockets. `SAP_REQUEST_TIMEOUT_MS` covers login and every underlying HTTP request.
- **Interrupted writes.** The client does not follow redirects, inherit environment proxies, retry mutations or automatically reauthenticate a stateful call. An interrupted write may already have changed SAP: after a cancelled or timed-out operation the server only accepts `login`, `logout` and `dropSession` until you have inspected writes and locks and recovered explicitly.
- **HTTP scope.** All traffic stays on the configured origin under `/sap/`, with 2 MiB requests, 4 MiB responses and verified TLS. XML entity declarations are rejected; input JSON is bounded by bytes, nesting, arrays and field contracts.

## Validation

```sh
npm run build
npm test
npm run verify:stdio
npm run verify:package
npm audit
docker build -t mcp-abap-adt .
node scripts/verify-stdio.mjs --offline docker run --rm -i --network none mcp-abap-adt
```

Tests use local HTTP/XML fixtures and installed modern/legacy protocol exchanges; no SAP production credentials or writes are involved. Linux/Windows Node 22/24 and non-root Docker run in CI.

For an authorized read-only deployment canary against a real system, set `SAP_LIVE_TEST=1` (plus optional `SAP_LIVE_SOURCE_URL`) and run `npm run verify:live`. It checks login, discovery and an optional source read — not writes, debugging, Git or transports; validate those on a development system first.

## Tool catalog

129 domain tools plus the two built-ins `healthcheck` and `readResultPage`:

- **Objects:** `searchObject`, `findObjectPath`, `createObject`, `validateNewObject`, `deleteObject`, `objectStructure`, `objectTypes`, `nodeContents`, `revisions`, `inactiveObjects`, `classComponents`, `classIncludes`, `codeCompletion`…
- **Source:** `getObjectSource`, `setObjectSource`, `downloadObjectSource`, `syntaxCheckCode`, `prettyPrinter`, `fixProposals`, `fixEdits`
- **Lock/activate:** `lock`, `unLock`, `activateObjects`, `activateByName`
- **Transports:** `transportInfo`, `createTransport`, `transportRelease`, `transportAddUser`, `userTransports`, `transportConfigurations`…
- **DDIC/queries:** `ddicElement`, `ddicRepositoryAccess`, `tableContents`, `runQuery`, `loadTypes`, `fragmentMappings`
- **Quality:** ATC worklists and runs, `unitTestRun`, traces (hit list, statements, DB access), `dumps` (ST22)
- **Debugging:** `debuggerListen`, breakpoints, stepping, variables, stack
- **Refactoring:** `extractMethod*`, `rename*`, usage references
- **Git:** `gitCreateRepo`, `gitPullRepo`, `stageRepo`, `pushRepo`, `checkRepo`…
- **Session:** `login`, `logout`, `dropSession`, `reentranceTicket`, `healthcheck`

## Custom instruction

Use this custom instruction to explain the tool to your model:

````markdown
## mcp-abap-adt Server

This server provides tools for interacting with an SAP system via ADT (ABAP Development Tools) APIs. It allows you to retrieve information about ABAP objects, modify source code, and manage transports.

**Key Tools and Usage:**

*   **`searchObject`:** Finds ABAP objects based on a query string (e.g., class name).
    *   `query`: (string, required) The search term.
    *   Returns the object's URI. Example: `/sap/bc/adt/oo/classes/zcl_invoice_xml_gen_model`

*   **`transportInfo`:** Retrieves transport information for a given object.
    *   `objSourceUrl`: (string, required) The object's URI (obtained from `searchObject`).
    *   Returns transport details, including the transport request number (`TRKORR` or `transportInfo.LOCKS.HEADER.TRKORR` in the JSON response).

*   **`lock`:** Locks an ABAP object for editing.
    *   `objectUrl`: (string, required) The object's URI.
    *   Returns a `lockHandle`, which is required for subsequent modifications.

*   **`unLock`:** Unlocks a previously locked ABAP object.
    *   `objectUrl`: (string, required) The object's URI.
    *   `lockHandle`: (string, required) The lock handle obtained from the `lock` operation.

*   **`setObjectSource`:** Modifies the source code of an ABAP object.
    *   `objectSourceUrl`: (string, required) The object's URI *with the suffix `/source/main`*. Example: `/sap/bc/adt/oo/classes/zcl_invoice_xml_gen_model/source/main`
    *   `lockHandle`: (string, required) The lock handle obtained from the `lock` operation.
    *   `source`: (string, required) The complete, modified ABAP source code. Alternatively pass `filePath` to read the source from a local file (for large files, bypassing the context); `source` and `filePath` are mutually exclusive.
    *   `transport`: (string, optional) The transport request number.

*   **`syntaxCheckCode`:** Performs a syntax check on ABAP source code.
    *   `code`: (string, optional) The ABAP source code to check. May be omitted to reuse the source last read/written for `url` via `getObjectSource`/`setObjectSource` this session, or replaced by `filePath` for a local file.
    *   `url`, `mainUrl`, `mainProgram`, `version`: (string, optional) Context for the check.
    *   Returns syntax check results, including any errors.

*   **`activateObjects` / `activateByName`:** Activates ABAP objects.

*   **`getObjectSource`:** Retrieves the source code of an ABAP object.
    *   `objectSourceUrl`: (string, required) The object's URI *with the suffix `/source/main`*. Use `downloadObjectSource` with a `filePath` to write the source to a local file instead of returning it.

**Workflow for Modifying ABAP Code:**

1.  **Find the object URI:** Use `searchObject`.
2.  **Read the original source code:** Use `getObjectSource` (with the `/source/main` suffix).
3.  **Clone and modify the source code locally** (e.g., `write_to_file`, `read_file`, `replace_in_file`).
4.  **Get transport information:** Use `transportInfo`.
5.  **Lock the object:** Use `lock`.
6.  **Set the modified source code:** Use `setObjectSource` (with the `/source/main` suffix).
7.  **Perform a syntax check:** Use `syntaxCheckCode` (omit `code` to reuse the source just written).
8.  **Activate the object:** Use `activateObjects` or `activateByName`.
9.  **Unlock:** Use `unLock`.

**Important Notes:**

*   **File handling:** SAP is completely de-coupled from the local file system. Reading source code only returns the code as a tool result; files are not synchronized with SAP but merely a local copy for reference. It is not strictly necessary to create local copies of source codes, but it helps track changes.
*   **Local filenames** contain no paths, only a filename. Prefer a pattern like `[ObjectName].[ObjectType].abap` (e.g., `SAPMV45A.prog.abap` for a program, `CL_IXML.clas.abap` for a class).
*   **URL suffix:** Remember to add `/source/main` to the object URI when using `setObjectSource` and `getObjectSource`.
*   **Transport request:** Obtain the transport request number (e.g., from `transportInfo` or from the user) and include it in relevant operations.
*   **Lock handle:** The `lockHandle` from `lock` is crucial for `setObjectSource` and `unLock`. Locks can expire or be released by other users; if a lock fails, re-acquire it.
*   **Activation/unlock order:** `activateObjects` can be used while the lock is still held; unlock afterwards.
*   **Error handling:** Tools return JSON responses. Check for error messages within these responses.

## Efficient Database Access

SAP systems contain vast amounts of data. Write ABAP code that accesses the database efficiently to minimize performance impact and network traffic. Avoid selecting entire tables or using broad `WHERE` clauses when you only need specific data.

*   **Use `WHERE` clauses:** Always filter to the specific rows you need.
*   **`UP TO 1 ROWS`:** If you only need a single record and can supply all key fields, use `SELECT SINGLE`. Otherwise use `SELECT ... UP TO 1 ROWS`, which stops the search after the first match:

    ```abap
    SELECT vgbel FROM vbrp WHERE vbeln = @me->lv_vbeln INTO @DATA(lv_vgbel) UP TO 1 ROWS.
      EXIT. " Exit any loop after this.
    ENDSELECT.
    ```

## Checking Table and Structure Definitions

When you encounter errors related to unknown field names or incorrect table usage, use these tools to inspect DDIC (Data Dictionary) objects:

*   **`objectStructure`:** Retrieves the structure/metadata of an ABAP object (including DDIC tables and structures) from its object URI. Use `searchObject` first to resolve the object name to a URI.
*   **`ddicElement`:** Retrieves details of a DDIC element (e.g., a data element or domain).
*   **`ddicRepositoryAccess`:** Reads DDIC repository information for a given path.
*   **`tableContents`:** Retrieves the *contents* (rows) of a table, not its definition. Use `runQuery` for ad-hoc `SELECT`s.
````

## Troubleshooting

- **`npx` can't find the package / client won't start it:** ensure Node.js is installed and on your PATH (`node -v`, `npm -v`). On Windows try `"command": "npx.cmd"`, install globally with `npm i -g @lingc-sun/mcp-abap-adt` and set `"command": "mcp-abap-adt"`, or use a source build with an absolute path to `node dist/index.js`.
- **SAP connection errors:** verify your credentials (`SAP_URL`, `SAP_USER`, `SAP_PASSWORD`, `SAP_CLIENT`), confirm the system is reachable, that your user has ADT authorizations, and that `/sap/bc/adt` is active in SICF.
- **TLS / self-signed certificate errors:** configure `NODE_EXTRA_CA_CERTS` with the absolute path to a trusted CA certificate before Node starts. Verification stays enabled.
- **"SAP session is busy" errors:** one operation runs at a time; cancel or finish the active request first.
- **"Previous operation was interrupted":** an operation was cancelled or timed out and may have left writes or locks behind. Inspect them, then call `login`, `dropSession` or `logout` to recover.

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the Repository**
2. **Create a New Branch**

   ```cmd
   git checkout -b feature/your-feature-name
   ```

3. **Commit Your Changes**

   ```cmd
   git commit -m "Add some feature"
   ```

4. **Push to the Branch**

   ```cmd
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

## License

This project is licensed under the [MIT License](LICENSE).
