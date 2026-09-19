import { SourceCache } from "../lib/sourceCache.js";
import type { ToolDefinition } from "../types/tools.js";
import type { ADTClient } from "@lingc-sun/abap-adt-api";
import { McpError, ErrorCode } from "../lib/errors.js";
import { performance } from "perf_hooks";
import { createLogger } from "../lib/logger.js";

enum CustomErrorCode {
  TooManyRequests = 429,
  InvalidParameters = 400,
}

export abstract class BaseHandler {
  protected get adtclient(): ADTClient {
    if (!this.client)
      throw new McpError(
        ErrorCode.InvalidParams,
        "Configure SAP_URL, SAP_USER and SAP_PASSWORD or SAP_BEARER_TOKEN",
      );
    return this.client;
  }
  private readonly client?: ADTClient;
  protected readonly logger = createLogger(this.constructor.name);
  private readonly rateLimiter = new Map<string, number>();
  private readonly metrics = {
    requestCount: 0,
    errorCount: 0,
    successCount: 0,
    totalTime: 0,
  };

  constructor(
    adtclient: ADTClient | undefined,
    protected readonly sourceCache = new SourceCache(),
  ) {
    this.client = adtclient;
  }

  protected trackRequest(startTime: number, success: boolean): void {
    const duration = performance.now() - startTime;
    this.metrics.requestCount++;
    this.metrics.totalTime += duration;

    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }

    this.logger.info("Request completed", {
      duration,
      success,
      metrics: this.getMetrics(),
    });
  }

  protected checkRateLimit(ip: string): void {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(ip) || 0;

    if (now - lastRequest < 1000) {
      // 1 second rate limit
      this.logger.warn("Rate limit exceeded", { ip });
      throw new McpError(
        CustomErrorCode.TooManyRequests,
        "Rate limit exceeded. Please wait before making another request.",
      );
    }

    this.rateLimiter.set(ip, now);
  }

  protected getMetrics() {
    return {
      ...this.metrics,
      averageTime:
        this.metrics.requestCount > 0
          ? this.metrics.totalTime / this.metrics.requestCount
          : 0,
    };
  }

  abstract getTools(): ToolDefinition[];
}
