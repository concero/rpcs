"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUrl = sanitizeUrl;
function sanitizeUrl(url) {
    return url
        .replace(/\/$/, "") // Remove trailing slash
        .trim(); // Trim whitespace
}
