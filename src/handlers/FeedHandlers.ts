import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { ADTClient } from "@lingc-sun/abap-adt-api";

export class FeedHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "feeds",
        description: "Retrieves a list of feeds.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "dumps",
        description:
          "Retrieves ABAP runtime dumps (ST22 feed). Each dump returns title, author, updated, categories and the key troubleshooting sections extracted from the dump HTML (header key/values, where terminated, error analysis, source extract with the crash line, call stack) instead of the full escaped HTML body.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                'Optional URL query string passed through to ADT, e.g. "maxNumber=5" (entry limit) or "from=20260901120000" (dumps since timestamp, YYYYMMDDhhmmss)',
              optional: true,
            },
          },
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "feeds":
        return this.handleFeeds(args);
      case "dumps":
        return this.handleDumps(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown feed tool: ${toolName}`,
        );
    }
  }

  async handleFeeds(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const feeds = await this.adtclient.feeds();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              feeds,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  /** Strip HTML tags, decode entities and collapse whitespace to plain text. */
  private static textOf(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/[\s\u00A0]+/g, " ")
      .trim();
  }

  /**
   * Split the dump body into its sections by <h4 id="XXX"> markers
   * (OVERVIEW/HEADERX/ERROR/TERMINATION/SOURCE/STACK/...).
   */
  private static splitSections(html: string): Map<string, string> {
    const sections = new Map<string, string>();
    const re = /<h4[^>]*\bid="([A-Z_]+)"[^>]*>[\s\S]*?<\/h4>/gi;
    const marks: { id: string; contentStart: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)))
      marks.push({ id: m[1], contentStart: m.index + m[0].length });
    for (let k = 0; k < marks.length; k++) {
      const end =
        k + 1 < marks.length ? marks[k + 1].contentStart : html.length;
      sections.set(marks[k].id, html.slice(marks[k].contentStart, end));
    }
    return sections;
  }

  /**
   * Extract the troubleshooting-relevant parts of a dump: header key/value
   * pairs, where terminated, error analysis, source extract (with the >>
   * crash line) and the call stack. Navigation/template sections are
   * dropped; falls back to condensed plain text when the section layout is
   * unexpected.
   */
  private static condenseDump(html: string): Record<string, any> {
    if (!html) return {};
    const sections = FeedHandlers.splitSections(html);
    if (sections.size === 0)
      return { text: FeedHandlers.textOf(html).slice(0, 4000) };

    const tds = (s: string) =>
      (s.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map((td) =>
        FeedHandlers.textOf(td),
      );

    // Header key/value pairs: Short Text / Runtime Error / Program / Date /
    // Time / User / ...
    const header: Record<string, string> = {};
    const htds = tds(sections.get("HEADERX") || "");
    for (let k = 0; k + 1 < htds.length; k += 2)
      header[htds[k].replace(/[\s\u00A0]+$/, "")] = htds[k + 1];

    // Source extract: first td column holds line numbers / >> crash marker,
    // the following tds hold the code text.
    let source: Record<string, any> | undefined;
    const srcHtml = (sections.get("SOURCE") || "").replace(
      /<style[\s\S]*?<\/style>/gi,
      "",
    );
    const stds = tds(srcHtml);
    if (stds.length) {
      const tokens: string[] = stds[0].match(/\d{1,4}|>>/g) || [];
      const at = tokens.indexOf(">>");
      const next =
        at >= 0 && tokens[at + 1] ? Number(tokens[at + 1]) : undefined;
      const prev = at > 0 ? Number(tokens[at - 1]) : undefined;
      const crashLine =
        next ?? (prev !== undefined && !isNaN(prev) ? prev + 1 : undefined);
      const code = stds
        .slice(1)
        .join(" ")
        .replace(/[\s\u00A0]{2,}/g, " ")
        .trim()
        .slice(0, 1500);
      source = { crashLine, code };
    }

    // Call stack: each row has 5 tds (index / event / program / include /
    // line).
    const callStack = ((sections.get("STACK") || "").match(
      /<tr[^>]*>[\s\S]*?<\/tr>/gi,
    ) || [])
      .map((tr) => tds(tr))
      .filter((cells) => cells.length >= 5)
      .slice(0, 15)
      .map((c) => `${c[0]} ${c[1]} ${c[2]} ${c[3]}:${c[4]}`);

    const cap = (s: string | undefined, n: number) =>
      s ? FeedHandlers.textOf(s).slice(0, n) : undefined;

    return {
      header,
      whereTerminated: cap(sections.get("TERMINATION"), 800),
      errorAnalysis: cap(sections.get("ERROR"), 1000),
      source,
      callStack,
    };
  }

  async handleDumps(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const feed = await this.adtclient.dumps(args.query);
      this.trackRequest(startTime, true);
      const dumps = feed.dumps.map((d) => ({
        title: d.title,
        author: d.author,
        updated: d.updated,
        categories: d.categories,
        ...FeedHandlers.condenseDump(d.text),
      }));
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              count: dumps.length,
              dumps,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }
}
