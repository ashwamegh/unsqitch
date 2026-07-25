const KEYWORDS =
  /\b(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER|DROP|TABLE|SCHEMA|INDEX|VIEW|TYPE|FUNCTION|TRIGGER|SEQUENCE|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES|INTO|SET|AS|ON|AND|OR|NOT|NULL|DEFAULT|PRIMARY|FOREIGN|KEY|REFERENCES|UNIQUE|CONSTRAINT|CASCADE|IF|EXISTS|ENUM|RETURNS|LANGUAGE|GRANT|REVOKE|WITH|ORDER|BY|GROUP|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER|CASE|WHEN|THEN|ELSE|END)\b/gi;

type Token = { text: string; kind: "comment" | "string" | "keyword" | "plain" };

/** Tokenize SQL well enough for readable highlighting (comments, strings, keywords). */
export function tokenizeSql(line: string): Token[] {
  const commentAt = line.indexOf("--");
  if (commentAt === 0) return [{ text: line, kind: "comment" }];

  const code = commentAt > 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt > 0 ? line.slice(commentAt) : "";
  const tokens: Token[] = [];

  // Split out single-quoted strings first so keywords inside them are untouched.
  const parts = code.split(/('(?:[^']|'')*')/g);
  for (const part of parts) {
    if (part === "") continue;
    if (part.startsWith("'")) {
      tokens.push({ text: part, kind: "string" });
      continue;
    }
    let last = 0;
    for (const m of part.matchAll(KEYWORDS)) {
      const start = m.index ?? 0;
      if (start > last) tokens.push({ text: part.slice(last, start), kind: "plain" });
      tokens.push({ text: m[0], kind: "keyword" });
      last = start + m[0].length;
    }
    if (last < part.length) tokens.push({ text: part.slice(last), kind: "plain" });
  }

  if (comment) tokens.push({ text: comment, kind: "comment" });
  return tokens;
}

const CLASS: Record<Token["kind"], string> = {
  comment: "text-muted-foreground/70 italic",
  string: "text-emerald-400",
  keyword: "text-primary font-semibold",
  plain: "text-foreground/85",
};

/** Read-only SQL display with syntax highlighting and line numbers. */
export function SqlBlock({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\n$/, "").split("\n");

  return (
    <pre
      className={`overflow-auto p-3 text-[11px] font-mono leading-relaxed bg-background/60 ${className ?? ""}`}
    >
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="select-none text-muted-foreground/40 text-right w-7 shrink-0">
              {i + 1}
            </span>
            <span className="whitespace-pre-wrap break-all">
              {tokenizeSql(line).map((t, j) => (
                <span key={j} className={CLASS[t.kind]}>
                  {t.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}
