import type { ReactNode } from "react";

// MDX-only table primitive: Turbopack rejects remark-gfm plugin fns.
export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className="mt-6 overflow-x-auto border border-[#1f1f1f]"
      style={{ borderTop: "1px solid #f5f5f5" }}
    >
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="bg-[#0e0e0e] px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]"
                style={{ borderBottom: "1px solid #1f1f1f" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-3 align-top text-[#f5f5f5]"
                  style={{
                    borderBottom:
                      i < rows.length - 1 ? "1px solid #1f1f1f" : undefined,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
