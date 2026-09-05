const BOM = String.fromCharCode(0xfeff);

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T>(
  columns: { key: keyof T; label: string }[],
  rows: T[],
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key];
        return escapeCsvField(value == null ? "" : String(value));
      })
      .join(","),
  );
  // Leading BOM so Excel opens the UTF-8 file with accented characters intact.
  return [BOM + header, ...lines].join("\r\n");
}
