import ts from "typescript-api";
import fs from "node:fs";
const files = fs
  .readdirSync("src/handlers")
  .filter((f) => f.endsWith("Handlers.ts"))
  .map((f) => "src/handlers/" + f);
const program = ts.createProgram(files, {
  strict: true,
  skipLibCheck: true,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2023,
});
const checker = program.getTypeChecker();
function schema(type, depth = 0, seen = new Set()) {
  if (!type || depth > 7 || seen.has(type)) return {};
  const flags = type.flags;
  if (flags & ts.TypeFlags.StringLiteral)
    return { type: "string", const: type.value };
  if (flags & ts.TypeFlags.NumberLiteral)
    return { type: "number", const: type.value };
  if (flags & ts.TypeFlags.BooleanLiteral)
    return { type: "boolean", const: type.intrinsicName === "true" };
  if (type.isUnion()) {
    const schemas = type.types
      .filter((t) => !(t.flags & ts.TypeFlags.Undefined))
      .map((t) => schema(t, depth + 1, seen));
    const unique = [
      ...new Map(schemas.map((s) => [JSON.stringify(s), s])).values(),
    ];
    return unique.length === 1 ? unique[0] : { anyOf: unique };
  }
  if (flags & ts.TypeFlags.String)
    return { type: "string", maxLength: 1048576 };
  if (flags & ts.TypeFlags.Number)
    return {
      type: "number",
      minimum: -Number.MAX_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
    };
  if (flags & ts.TypeFlags.Boolean) return { type: "boolean" };
  if (flags & ts.TypeFlags.Null) return { type: "null" };
  if (checker.isArrayType(type))
    return {
      type: "array",
      items: schema(checker.getTypeArguments(type)[0], depth + 1, seen),
      maxItems: 1000,
    };
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return {};
  if (flags & ts.TypeFlags.Object) {
    const next = new Set(seen);
    next.add(type);
    const properties = {},
      required = [];
    for (const symbol of checker.getPropertiesOfType(type)) {
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (!declaration) continue;
      const t = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      if (t.getCallSignatures().length) continue;
      properties[symbol.name] = schema(t, depth + 1, next);
      if (
        !(symbol.flags & ts.SymbolFlags.Optional) &&
        !(t.flags & ts.TypeFlags.Undefined) &&
        !(t.isUnion() && t.types.some((u) => u.flags & ts.TypeFlags.Undefined))
      )
        required.push(symbol.name);
    }
    const index = checker.getIndexTypeOfType(type, ts.IndexKind.String);
    return {
      type: "object",
      properties,
      required,
      additionalProperties: index ? schema(index, depth + 1, next) : true,
    };
  }
  return {};
}
const output = {};
const report = [];
for (const filename of files) {
  const source = program.getSourceFile(filename);
  const routes = new Map();
  function route(node) {
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) {
      const text = node.getText(source);
      const m = text.match(/this\.(handle\w+)\(/);
      if (m) routes.set(m[1], node.expression.text);
    }
    ts.forEachChild(node, route);
  }
  route(source);
  function visit(node) {
    if (ts.isMethodDeclaration(node) && routes.has(node.name.getText(source))) {
      const tool = routes.get(node.name.getText(source));
      const fields = {};
      function call(n) {
        if (
          ts.isCallExpression(n) &&
          n.expression.getText(source).startsWith("this.adtclient.")
        ) {
          const method = n.expression
            .getText(source)
            .slice("this.adtclient.".length);
          const signature = checker.getResolvedSignature(n);
          if (signature)
            n.arguments.forEach((arg, i) => {
              let direct = arg
                .getText(source)
                .match(/^args\??\.([A-Za-z_][\w]*)$/);
              if (!direct && ts.isIdentifier(arg)) {
                const match = node
                  .getText(source)
                  .match(
                    new RegExp(
                      "(?:const|let)\\s+" +
                        arg.text +
                        "[^;]*?args\\.([A-Za-z_][\\w]*)",
                    ),
                  );
                if (match) direct = [match[0], match[1]];
              }
              if (!direct) return;
              const param =
                signature.parameters[
                  Math.min(i, signature.parameters.length - 1)
                ];
              if (!param) return;
              const declaration =
                param.valueDeclaration ?? param.declarations?.[0];
              const type = checker.getTypeOfSymbolAtLocation(
                param,
                declaration,
              );
              const overloads = checker
                .getTypeAtLocation(n.expression)
                .getCallSignatures()
                .map((sig) => sig.parameters[i])
                .filter((q) => q && q.name === param.name)
                .map((q) =>
                  schema(
                    checker.getTypeOfSymbolAtLocation(
                      q,
                      q.valueDeclaration ?? q.declarations?.[0],
                    ),
                  ),
                );
              const unique = [
                ...new Map(
                  overloads.map((o) => [JSON.stringify(o), o]),
                ).values(),
              ];
              const shape =
                unique.length > 1 ? { anyOf: unique } : schema(type);
              fields[direct[1]] = shape;
              report.push({
                tool,
                field: direct[1],
                method,
                parameter: param.name,
                type: checker.typeToString(type),
              });
            });
        }
        ts.forEachChild(n, call);
      }
      call(node);
      output[tool] = fields;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
fs.writeFileSync(
  "src/lib/input-contracts.json",
  JSON.stringify(output, null, 2) + "\n",
);
fs.writeFileSync(
  "scripts/input-contracts-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      tools: Object.keys(output).length,
      fields: report.length,
      nonPrimitive: report.filter(
        (r) =>
          ![
            "string",
            "number",
            "boolean",
            "string | undefined",
            "number | undefined",
            "boolean | undefined",
          ].includes(r.type),
      ),
    },
    null,
    2,
  ),
);
