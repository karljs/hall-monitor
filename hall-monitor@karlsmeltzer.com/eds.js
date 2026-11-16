// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import ECal from 'gi://ECal?version=2.0';
import EDataServer from 'gi://EDataServer?version=1.2';
import ICalGLib from 'gi://ICalGLib?version=3.0';

import * as Util from './util.js';

const isodate = s => GLib.DateTime.new_from_unix_utc(s).format('%Y%m%dT%H%M%SZ');

export function openRegistry() {
    return EDataServer.SourceRegistry.new_sync(null);
}

export function calendarSources(registry) {
    return (registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR) ?? [])
        .filter(s => s.get_enabled());
}

export function connectClient(source) {
    return ECal.Client.connect_sync(source, ECal.ClientSourceType.EVENTS, 5, null);
}

export function queryEvents(client, startSecs, endSecs) {
    const sexp = `(occur-in-time-range? (make-time "${isodate(startSecs)}") (make-time "${isodate(endSecs)}"))`;
    let objs;
    try {
        objs = client.get_object_list_sync(sexp, null)[1] ?? [];
    } catch (e) {
        logError(e);
        return [];
    }
    const masters = new Set();
    for (const obj of objs) {
        const rid = obj.get_recurrenceid?.();
        if (!rid || rid.is_null_time())
            masters.add(obj.get_uid());
    }
    const events = [];
    for (const obj of objs) {
        const rid = obj.get_recurrenceid?.();
        if (rid && !rid.is_null_time() && masters.has(obj.get_uid()))
            continue;
        events.push(...expand(client, obj, startSecs, endSecs));
    }
    return events;
}

// generate_instances_for_object_sync swallows callback errors: a JS throw inside
// the callback aborts expansion silently and looks like "no instances".
// Boxed callback args (ic, s, e) must not be retained after the callback returns.
function expand(client, obj, startSecs, endSecs) {
    const events = [];
    let instances = 0;
    try {
        client.generate_instances_for_object_sync(obj, startSecs, endSecs, null, (ic, s, e) => {
            instances += 1;
            try {
                const ev = eventFrom(ic, s, e);
                if (ev)
                    events.push(ev);
            } catch (err) {
                logError(err);
            }
            return true;
        });
    } catch (e) {
        logError(e);
        return [];
    }
    if (instances > 0)
        return events;
    // No instances: non-recurring events are not expanded, read DTSTART directly.
    const s = obj.get_dtstart();
    if (!s || s.is_null_time())
        return [];
    const e = obj.get_dtend();
    const ev = eventFrom(obj, s, e && !e.is_null_time() ? e : null);
    return ev ? [ev] : [];
}

function eventFrom(ic, start, end) {
    const summary = ic.get_summary();
    if (!summary || !start || start.is_date())
        return null;
    let cancelled = false;
    try {
        const prop = ic.get_first_property(ICalGLib.PropertyKind.STATUS_PROPERTY);
        cancelled = !!prop &&
            (prop.get_value_as_string() ?? '').toUpperCase() === 'CANCELLED';
    } catch (e) {
        logError(e);
    }
    if (cancelled)
        return null;
    const zone = start.get_timezone() ?? ICalGLib.Timezone.get_utc_timezone();
    const startSecs = start.as_timet_with_zone(zone);
    let endSecs = startSecs + 1800;
    if (end && !end.is_date() && !end.is_null_time()) {
        const eSecs = end.as_timet_with_zone(end.get_timezone() ?? zone);
        if (eSecs > startSecs)
            endSecs = eSecs;
    }
    const ics = ic.as_ical_string();
    const joinUrl = Util.findMeetingUrl(ics);
    return {
        key: `${ic.get_uid()}@${startSecs}`,
        summary,
        startSecs,
        endSecs,
        joinUrl,
        joinable: Util.isKnownMeetingUrl(joinUrl),
    };
}
