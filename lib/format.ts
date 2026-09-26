/** Format tampilan angka & tanggal (aman dipakai server component maupun client component). */

export function formatIdr(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
