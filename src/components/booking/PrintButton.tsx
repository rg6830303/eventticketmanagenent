'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-outline btn-sm px-5 py-2.5 text-[12px]">
      Print
    </button>
  );
}
