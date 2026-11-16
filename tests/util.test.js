// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import * as Util from '../hall-monitor@karlsmeltzer.com/util.js';

let passed = 0;

function eq(actual, expected, name) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        print(`FAIL ${name}\n  got  ${a}\n  want ${b}`);
        throw new Error(name);
    }
    passed += 1;
    print(`ok ${passed} ${name}`);
}

const now = 1000000;
const mk = over => Object.assign({
    key: 'u@1',
    summary: 'Standup',
    startSecs: now + 60,
    endSecs: now + 3600,
    joinUrl: null,
    joinable: true,
}, over);

eq(Util.pickEvent([mk({})], now, 60)?.summary, 'Standup', 'event inside lead triggers');
eq(Util.pickEvent([mk({startSecs: now + 61})], now, 60), null, 'event beyond lead ignored');
eq(Util.pickEvent([mk({startSecs: now + 120})], now, 180)?.summary, 'Standup', 'lead parameter widens window');
eq(Util.pickEvent([mk({startSecs: now - 301})], now, 60), null, 'event past stale window ignored');
eq(Util.pickEvent([mk({startSecs: now - 60, endSecs: now - 1})], now, 60), null, 'ended event ignored');
eq(Util.pickEvent([mk({startSecs: now - 240})], now, 60)?.summary, 'Standup', 'late running event triggers');
eq(Util.pickEvent([mk({key: 'a', startSecs: now + 30}), mk({key: 'b', startSecs: now + 10})], now, 60)?.key, 'b', 'earliest event wins');

eq(Util.matchSummary('Standup - Zoom Meeting', 'Standup'), true, 'zoom title match');
eq(Util.matchSummary('  Weekly  SYNC ', 'weekly sync'), true, 'normalized match');
eq(Util.matchSummary('Team Sync', 'Standup'), false, 'mismatch');
eq(Util.matchSummary('x', ''), false, 'empty summary never matches');
eq(Util.matchSummary('', 'Standup'), false, 'empty title never matches');

eq(Util.isKnownMeetingUrl('https://meet.google.com/abc-defg-hij'), true, 'meet url known');
eq(Util.isKnownMeetingUrl('https://zoom.us/j/123456'), true, 'zoom url known');
eq(Util.isKnownMeetingUrl('https://teams.microsoft.com/l/meet/x'), true, 'teams url known');
eq(Util.isKnownMeetingUrl('https://corp.example.com/call/9'), false, 'generic url not known');
eq(Util.isKnownMeetingUrl(null), false, 'null url not known');

eq(Util.findMeetingUrl('DESCRIPTION:join https://meet.google.com/abc-defg-hij now'), 'https://meet.google.com/abc-defg-hij', 'meet url found');
eq(Util.findMeetingUrl('LOCATION:https://zoom.us/j/123456?pwd=abc.'), 'https://zoom.us/j/123456?pwd=abc', 'zoom url strips trailing dot');
eq(Util.findMeetingUrl('DESCRIPTION:wrap https://zoom.us/j/12\n 3456 end'), 'https://zoom.us/j/123456', 'rfc5545 unfolding');
eq(Util.findMeetingUrl('URL:https://calendar.google.com/event/x\nLOCATION:Room 4'), null, 'calendar event link skipped');
eq(Util.findMeetingUrl('X-GOOGLE-CONFERENCE:https://meet.google.com/rst-uvw-xyz'), 'https://meet.google.com/rst-uvw-xyz', 'google conference property');
eq(Util.findMeetingUrl('LOCATION:Room 4'), null, 'no link yields null');
eq(Util.findMeetingUrl('LOCATION:https://corp.example.com/call/9'), 'https://corp.example.com/call/9', 'generic url fallback');

print(`\nPASS (${passed})`);
