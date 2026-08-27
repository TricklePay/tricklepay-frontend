export const SUPPORTED_DESKTOP_BROWSERS = [
  "Google Chrome",
  "Brave Browser",
  "Mozilla Firefox",
  "Microsoft Edge",
] as const;

export function isSupportedBrowser(userAgent: string): boolean {
  const lower = userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(lower);
  if (isMobile) return false;

  // Major desktop browsers supporting extensions
  return (
    lower.includes("chrome") ||
    lower.includes("brave") ||
    lower.includes("firefox") ||
    lower.includes("edg")
  );
}
