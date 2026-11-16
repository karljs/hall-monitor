// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import * as Eds from '../hall-monitor@karlsmeltzer.com/eds.js';

const fmt = s => GLib.DateTime.new_from_unix_local(s).format('%Y-%m-%d %H:%M');

const registry = Eds.openRegistry();
const now = Math.floor(Date.now() / 1000);

for (const source of Eds.calendarSources(registry)) {
    print(`== ${source.get_display_name()} (${source.get_uid()})`);
    let client;
    try {
        client = Eds.connectClient(source);
    } catch (e) {
        print(`   connect failed: ${e.message}`);
        continue;
    }
    const events = Eds.queryEvents(client, now - 3600, now + 86400);
    for (const ev of events)
        print(`   ${fmt(ev.startSecs)} - ${fmt(ev.endSecs)} "${ev.summary}" joinable=${ev.joinable} url=${ev.joinUrl}`);
    print(`   (${events.length} event(s))`);
}
