import { AuthHandlers } from "./AuthHandlers.js";
import { TransportHandlers } from "./TransportHandlers.js";
import { ObjectHandlers } from "./ObjectHandlers.js";
import { ClassHandlers } from "./ClassHandlers.js";
import { CodeAnalysisHandlers } from "./CodeAnalysisHandlers.js";
import { ObjectLockHandlers } from "./ObjectLockHandlers.js";
import { ObjectSourceHandlers } from "./ObjectSourceHandlers.js";
import { ObjectDeletionHandlers } from "./ObjectDeletionHandlers.js";
import { ObjectManagementHandlers } from "./ObjectManagementHandlers.js";
import { ObjectRegistrationHandlers } from "./ObjectRegistrationHandlers.js";
import { NodeHandlers } from "./NodeHandlers.js";
import { DiscoveryHandlers } from "./DiscoveryHandlers.js";
import { UnitTestHandlers } from "./UnitTestHandlers.js";
import { PrettyPrinterHandlers } from "./PrettyPrinterHandlers.js";
import { GitHandlers } from "./GitHandlers.js";
import { DdicHandlers } from "./DdicHandlers.js";
import { ServiceBindingHandlers } from "./ServiceBindingHandlers.js";
import { QueryHandlers } from "./QueryHandlers.js";
import { FeedHandlers } from "./FeedHandlers.js";
import { DebugHandlers } from "./DebugHandlers.js";
import { RenameHandlers } from "./RenameHandlers.js";
import { AtcHandlers } from "./AtcHandlers.js";
import { TraceHandlers } from "./TraceHandlers.js";
import { RefactorHandlers } from "./RefactorHandlers.js";
import { RevisionHandlers } from "./RevisionHandlers.js";
import type { ADTClient } from "@lingc-sun/abap-adt-api";
import { SourceCache } from "../lib/sourceCache.js";
export function createHandlers(
  client: ADTClient | undefined,
  cache: SourceCache,
) {
  return [
    new AuthHandlers(client, cache),
    new TransportHandlers(client, cache),
    new ObjectHandlers(client, cache),
    new ClassHandlers(client, cache),
    new CodeAnalysisHandlers(client, cache),
    new ObjectLockHandlers(client, cache),
    new ObjectSourceHandlers(client, cache),
    new ObjectDeletionHandlers(client, cache),
    new ObjectManagementHandlers(client, cache),
    new ObjectRegistrationHandlers(client, cache),
    new NodeHandlers(client, cache),
    new DiscoveryHandlers(client, cache),
    new UnitTestHandlers(client, cache),
    new PrettyPrinterHandlers(client, cache),
    new GitHandlers(client, cache),
    new DdicHandlers(client, cache),
    new ServiceBindingHandlers(client, cache),
    new QueryHandlers(client, cache),
    new FeedHandlers(client, cache),
    new DebugHandlers(client, cache),
    new RenameHandlers(client, cache),
    new AtcHandlers(client, cache),
    new TraceHandlers(client, cache),
    new RefactorHandlers(client, cache),
    new RevisionHandlers(client, cache),
  ];
}
