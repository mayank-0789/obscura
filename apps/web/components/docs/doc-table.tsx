import type { ReactNode } from "react";

// Table primitive for MDX authoring. Plain markdown pipe-tables can't be
// used in our pipeline (Turbopack rejects remark-gfm plugin fns), so every
// table in the docs goes through this component.
//
// Usage:
//   <DocTable
//     headers={["Code", "Status", "Meaning"]}
//     rows={[
//       ["over_cap", "402", "Monthly cap exceeded."],
//       ["invalid_token", "401", "API key unknown."],
//     ]}
//   />
//
// Cell content can be plain strings or JSX (including `<code>`).
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
