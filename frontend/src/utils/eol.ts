/**
 * Normalize line endings (\r\n → \n, \r → \n) so splitting by \n works
 * correctly on files from any OS (Windows, Unix, legacy Mac).
 */
export function normalizeEOL(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
