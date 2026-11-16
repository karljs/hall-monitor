// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Eds from './eds.js';
import * as Util from './util.js';

const POLL_SECONDS = 15;

const TEST_DBUS_XML = '<node><interface name="org.gnome.HallMonitorTest">' +
    '<method name="ShowOverlay"/></interface></node>';

// Survives instance replacement while this module stays cached: lets a fresh
// instance unexport a hook registered by a previous instance whose disable()
// the shell skipped (transitions out of ERROR never call disable).
let exportedHook = null;

export default class HallMonitor extends Extension {
    enable() {
        this._shown = new Set();
        this._clients = new Map();
        this._overlay = null;
        this._grab = null;
        this._snoozeId = 0;
        this._settings = this.getSettings();
        this._registry = Eds.openRegistry();
        exportedHook?.unexport();
        this._dbus = Gio.DBusExportedObject.wrapJSObject(TEST_DBUS_XML, {
            ShowOverlay: () => this._testOverlay(),
        });
        try {
            this._dbus.export(Gio.bus_get_sync(Gio.BusType.SESSION, null), '/org/gnome/HallMonitor');
        } catch (e) {
            // stale registration from an instance we cannot reach anymore:
            // stay functional, the hook recovers on the next log in
            logError(e);
            this._dbus = null;
        }
        exportedHook = this._dbus;
        this._poll();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
            this._poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._pollId)
            GLib.source_remove(this._pollId);
        if (this._snoozeId)
            GLib.source_remove(this._snoozeId);
        this._pollId = this._snoozeId = 0;
        this._dbus?.unexport();
        if (exportedHook === this._dbus)
            exportedHook = null;
        this._dbus = null;
        this._closeOverlay();
        this._clients.clear();
        this._shown.clear();
        this._registry = null;
    }

    _poll() {
        if (this._overlay)
            return;
        try {
            const now = Util.nowSecs();
            const lead = this._settings.get_int('lead-minutes') * 60;
            let events = this._collect(now).filter(ev => !this._shown.has(ev.key));
            if (this._settings.get_string('no-link-action') === 'ignore')
                events = events.filter(ev => ev.joinable);
            const ev = Util.pickEvent(events, now, lead);
            if (ev)
                this._maybeBlock(ev);
        } catch (e) {
            logError(e);
        }
    }

    _collect(now) {
        const events = [];
        const start = now - Util.STALE_AFTER;
        const end = now + Util.LOOKAHEAD;
        const live = new Set();
        for (const source of Eds.calendarSources(this._registry)) {
            const uid = source.get_uid();
            live.add(uid);
            let client = this._clients.get(uid);
            if (!client) {
                try {
                    client = Eds.connectClient(source);
                } catch (e) {
                    logError(e);
                    client = null;
                }
                if (client)
                    this._clients.set(uid, client);
            }
            if (client)
                events.push(...Eds.queryEvents(client, start, end));
        }
        for (const uid of [...this._clients.keys()])
            if (!live.has(uid))
                this._clients.delete(uid);
        return events;
    }

    _maybeBlock(ev) {
        const title = global.display.focus_window?.get_title?.() ?? '';
        if (title && Util.matchSummary(title, ev.summary)) {
            this._shown.add(ev.key);
            Main.notify(`Hall Monitor: skipping "${ev.summary}", you look busy in it already`);
            return;
        }
        if (!ev.joinable && this._settings.get_string('no-link-action') === 'notify') {
            this._shown.add(ev.key);
            Main.notify(`Hall Monitor: "${ev.summary}" starts at ${this._fmtTime(ev.startSecs)}`);
            return;
        }
        this._showOverlay(ev);
    }

    _testOverlay() {
        const now = Util.nowSecs();
        this._maybeBlock({
            key: `test@${now}`,
            summary: 'Hall Monitor test',
            startSecs: now + 60,
            endSecs: now + 1800,
            joinUrl: 'https://example.com/',
            joinable: true,
        });
    }

    _fmtTime(secs) {
        return GLib.DateTime.new_from_unix_local(secs).format('%H:%M');
    }

    _showOverlay(ev) {
        if (this._overlay)
            return;
        this._shown.add(ev.key);
        const now = Util.nowSecs();
        const monitor = Main.layoutManager.primaryMonitor;
        const url = ev.joinUrl;

        const overlay = new St.Bin({
            style_class: 'hallmonitor-overlay',
            reactive: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        overlay.set_position(monitor.x, monitor.y);
        overlay.set_size(monitor.width, monitor.height);

        const card = new St.BoxLayout({vertical: true, style_class: 'modal-dialog hallmonitor-card'});
        overlay.set_child(card);

        const contentBox = new St.BoxLayout({
            vertical: true,
            style_class: 'modal-dialog-content-box',
            y_expand: true,
        });
        card.add_child(contentBox);

        const content = new St.BoxLayout({vertical: true, style_class: 'message-dialog-content'});
        contentBox.add_child(content);

        const time = this._fmtTime(ev.startSecs);
        const title = new St.Label({
            text: ev.summary,
            style_class: 'message-dialog-title hallmonitor-title',
        });
        title.clutter_text.line_wrap = true;
        content.add_child(title);

        const sub = new St.Label({
            text: now > ev.startSecs
                ? `Started at ${time} (${Math.max(1, Math.round((now - ev.startSecs) / 60))} min late)`
                : `Starts at ${time}`,
            style_class: 'message-dialog-description hallmonitor-sub',
        });
        sub.clutter_text.line_wrap = true;
        content.add_child(sub);

        const row = new St.Widget({
            style_class: 'modal-dialog-button-box',
            layout_manager: new Clutter.BoxLayout({spacing: 12, homogeneous: true}),
        });
        card.add_child(row);

        const onKey = (o, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this._closeOverlay();
                return true;
            }
            return false;
        };

        const buttonProps = {
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true,
        };

        const dismiss = new St.Button({...buttonProps, label: 'Dismiss', style_class: 'modal-dialog-button'});
        dismiss.connect('clicked', () => this._closeOverlay());
        row.add_child(dismiss);

        const snooze = new St.Button({...buttonProps, label: 'Snooze 1 min', style_class: 'modal-dialog-button'});
        snooze.connect('clicked', () => {
            this._closeOverlay();
            this._snoozeId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
                this._snoozeId = 0;
                if (Util.nowSecs() < ev.endSecs)
                    this._maybeBlock(ev);
                return GLib.SOURCE_REMOVE;
            });
        });
        row.add_child(snooze);

        let focusBtn = dismiss;
        if (url) {
            const join = new St.Button({
                ...buttonProps,
                label: 'Join',
                style_class: 'modal-dialog-button hallmonitor-btn-primary',
            });
            join.connect('clicked', () => {
                // MetaLaunchContext carries the Wayland activation token so the
                // browser is allowed to foreground itself
                const context = global.create_app_launch_context(0, -1);
                Gio.AppInfo.launch_default_for_uri_async(url, context, null, (source, res) => {
                    // static interface method: source is always null, finish
                    // must be called on Gio.AppInfo itself
                    try {
                        Gio.AppInfo.launch_default_for_uri_finish(res);
                    } catch (e) {
                        logError(e);
                        Main.notify('Hall Monitor: could not open the meeting link');
                    }
                });
                this._closeOverlay();
            });
            row.add_child(join);
            focusBtn = join;
        }

        overlay.connect('key-press-event', onKey);
        focusBtn.connect('key-press-event', onKey);

        this._overlay = overlay;
        Main.layoutManager.addTopChrome(overlay);
        try {
            this._grab = Main.pushModal(overlay);
        } catch (e) {
            logError(e);
        }
        focusBtn.grab_key_focus();
    }

    _closeOverlay() {
        if (!this._overlay)
            return;
        if (this._grab) {
            try {
                Main.popModal(this._grab);
            } catch (e) {
                logError(e);
            }
            this._grab = null;
        }
        Main.layoutManager.removeChrome(this._overlay);
        this._overlay.destroy();
        this._overlay = null;
    }
}
