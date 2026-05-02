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
    <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-zinc-800 bg-[#0c0c0e] px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
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
                  className="border-b border-zinc-900 px-4 py-3 align-top text-zinc-300 last:border-0"
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
