export function sanitizeUrl(url: string): string {
    return url
        .replace(/\/$/, "") // Remove trailing slash
        .trim(); // Trim whitespace
}
