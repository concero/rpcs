export function sanitizeUrl(url) {
    return url.replace(/\/$/, "") // Remove trailing slash
    .trim(); // Trim whitespace
}
