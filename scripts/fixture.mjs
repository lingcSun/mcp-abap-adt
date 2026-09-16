import { createServer } from "node:http";
import { once } from "node:events";
export const until = async (fn) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 10000) throw new Error("Fixture deadline");
    await new Promise((r) => setTimeout(r, 10));
  }
};
export async function fixture() {
  let slowStarted = false,
    cancelled = false,
    source = "REPORT ztest.\nWRITE 'wire café 🧪'.";
  const calls = [];
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const x of req) parts.push(x);
    const body = Buffer.concat(parts).toString();
    calls.push({ method: req.method, url: req.url, body });
    const path = new URL(req.url, "http://fixture").pathname;
    if (path === "/sap/bc/adt/compatibility/graph") {
      res.setHeader("x-csrf-token", "test-csrf");
      res.setHeader("set-cookie", "SAP_SESSIONID=test-session; Path=/");
      res.end("<graph/>");
    } else if (path === "/sap/public/bc/icf/logoff") res.end("bye");
    else if (path.endsWith("/slow")) {
      slowStarted = true;
      req.socket.once("close", () => (cancelled = true));
    } else if (path.endsWith("/source/main")) {
      if (req.method === "PUT") {
        source = body;
        res.statusCode = 204;
        res.end();
      } else res.end(source);
    } else if (path.startsWith("/sap/bc/adt/checkruns"))
      res.end(
        '<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun"/>',
      );
    else {
      res.statusCode = 400;
      res.end(
        '<exc:exception xmlns:exc="urn:exc"><type id="EXPECTED"/><message lang="en">Fixture error</message><namespace id="ADT"/></exc:exception>',
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    get slowStarted() {
      return slowStarted;
    },
    get cancelled() {
      return cancelled;
    },
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
  };
}
