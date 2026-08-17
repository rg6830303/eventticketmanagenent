'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost px-5 py-2.5 text-[12px]">
      Print
    </button>
  );
}
