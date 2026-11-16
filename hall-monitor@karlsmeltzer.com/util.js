// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

export const LOOKAHEAD = 3600;
export const STALE_AFTER = 300;

export function nowSecs() {
    return Math.floor(Date.now() / 1000);
}

export function pickEvent(events, now, lead) {
    let best = null;
    for (const ev of events) {
        if (ev.startSecs > now + lead)
            continue;
        if (ev.startSecs < now - STALE_AFTER)
            continue;
        if (ev.endSecs <= now)
            continue;
        if (!best || ev.startSecs < best.startSecs)
            best = ev;
    }
    return best;
}

const URL_RE = [
    /https?:\/\/[\w.-]*zoom\.us\/(?:j|my|w)\/[\w?=&./-]+/i,
    /https?:\/\/[\w.-]*meet\.google\.com\/[\w-]+/i,
    /https?:\/\/teams\.(?:microsoft|live)\.com\/[^\s"'<>\\]+/i,
    /https?:\/\/[\w.-]*(?:jitsi\.\w+|jit\.si)\/[^\s"'<>\\]+/i,
];

export function isKnownMeetingUrl(url) {
    return !!url && URL_RE.some(re => re.test(url));
}

export function findMeetingUrl(text) {
    if (!text)
        return null;
    const s = text.replace(/\r?\n[ \t]/g, '');
    for (const re of URL_RE) {
        const m = s.match(re);
        if (m)
            return m[0].replace(/[)\].,]+$/, '');
    }
    for (const m of s.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
        const u = m[0].replace(/[)\].,]+$/, '');
        if (/^https?:\/\/(?:calendar|mail)\.google\.com\//.test(u))
            continue;
        return u;
    }
    return null;
}

export function matchSummary(title, summary) {
    if (!title || !summary)
        return false;
    const t = title.toLowerCase().replace(/\s+/g, ' ').trim();
    const s = summary.toLowerCase().replace(/\s+/g, ' ').trim();
    return s.length >= 3 && t.includes(s);
}
