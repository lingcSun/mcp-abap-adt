import { createHash } from "node:crypto";
export class SourceCache {
  private entries = new Map<
    string,
    { source: string; expires: number; bytes: number }
  >();
  private bytes = 0;
  constructor(
    private readonly maxBytes = 8 * 1024 * 1024,
    private readonly ttlMs = 300000,
    private readonly maxEntries = 64,
  ) {}
  set(url: string, source: string) {
    this.delete(url);
    const bytes = Buffer.byteLength(source);
    if (bytes > this.maxBytes) return;
    this.entries.set(url, { source, bytes, expires: Date.now() + this.ttlMs });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes)
      this.delete(this.entries.keys().next().value!);
  }
  get(url: string) {
    const e = this.entries.get(url);
    if (!e) return;
    if (e.expires <= Date.now()) {
      this.delete(url);
      return;
    }
    return e.source;
  }
  has(url: string) {
    return this.get(url) !== undefined;
  }
  delete(url: string) {
    const e = this.entries.get(url);
    if (e) this.bytes -= e.bytes;
    this.entries.delete(url);
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
  static hash(source: string) {
    return createHash("sha256").update(source).digest("hex");
  }
}
