import { Runtime } from "../dist/server.js";
import { safeError } from "../dist/lib/errors.js";
if (process.env.SAP_LIVE_TEST !== "1") {
  console.log(
    "NOT RUN: set SAP_LIVE_TEST=1 with authorized SAP credentials for a read-only canary",
  );
  process.exit(0);
}
const runtime = new Runtime();
try {
  if (!runtime.client) throw new Error("Live credentials required");
  await runtime.invoke("login", {});
  await runtime.invoke("adtCompatibiliyGraph", {});
  if (process.env.SAP_LIVE_SOURCE_URL)
    await runtime.invoke("getObjectSource", {
      objectSourceUrl: process.env.SAP_LIVE_SOURCE_URL,
      maxLines: 1,
    });
  console.log(
    "Live login/discovery" +
      (process.env.SAP_LIVE_SOURCE_URL ? "/one-line source read" : "") +
      " passed; no SAP write tools invoked",
  );
} catch (error) {
  process.stderr.write(safeError(error, runtime.secrets) + "\n");
  process.exitCode = 1;
} finally {
  await runtime.close();
}
