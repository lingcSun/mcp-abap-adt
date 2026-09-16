import {
  ADTClient,
  isClassMetaData,
  type AbapObjectStructure,
  type ClassInclude,
  type Link,
  type ObjectVersion,
} from "abap-adt-api";
import { XMLParser } from "fast-xml-parser";
import { McpError, ErrorCode } from "./errors.js";
const array = (v: any): any[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const attrs = (v: any): Record<string, any> =>
  Object.fromEntries(
    Object.entries(v ?? {})
      .filter(([k]) => k.startsWith("@_"))
      .map(([k, v]) => [k.slice(2), v]),
  );
/** abap-adt-api8.4.3 assumes include.atom:link is an array. A valid single link
 * is parsed as an object. Use the public raw request API and retain its documented
 * objectStructure shape, normalizing zero/one/many links without a private patch. */
export class CompatibleAdtClient extends ADTClient {
  override async objectStructure(
    objectUrl: string,
    version?: ObjectVersion,
  ): Promise<AbapObjectStructure> {
    const response = await this.httpClient.request(objectUrl, {
      qs: version ? { version } : {},
    });
    if (/<!DOCTYPE|<!ENTITY/i.test(response.body))
      throw new McpError(
        ErrorCode.InternalError,
        "SAP XML entity declarations rejected",
      );
    const xml = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: false,
      processEntities: true,
    }).parse(response.body);
    const roots = Object.entries(xml).filter(([key]) => !key.startsWith("?"));
    if (roots.length !== 1 || !roots[0][1] || typeof roots[0][1] !== "object")
      throw new McpError(
        ErrorCode.InternalError,
        "Invalid SAP object structure XML",
      );
    const root: any = roots[0][1],
      metaData = attrs(root);
    metaData["adtcore:changedAt"] =
      Date.parse(metaData["adtcore:changedAt"]) || 0;
    metaData["adtcore:createdAt"] =
      Date.parse(metaData["adtcore:createdAt"]) || 0;
    const links = (node: any): Link[] =>
      array(node?.["atom:link"]).map((link) => attrs(link) as Link);
    // The raw ADT XML attribute names are the public library's metadata contract.
    const base = {
      objectUrl,
      metaData: metaData as AbapObjectStructure["metaData"],
      links: links(root),
    };
    if (isClassMetaData(base.metaData))
      return {
        ...base,
        metaData: base.metaData,
        includes: array(root["class:include"]).map(
          (include) =>
            ({ ...attrs(include), links: links(include) }) as ClassInclude,
        ),
      };
    return base;
  }
}
