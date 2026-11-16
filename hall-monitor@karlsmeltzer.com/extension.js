// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// GJS caches modules by full URI; the mtime query busts the cache so edits
// load on every enable without logging out. This shim is permanent: keep all
// extension code in impl.js and the help UI in help.js.
async function bustImport(file) {
    let bust = Date.now();
    try {
        const info = await file.query_info_async('time::modified',
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null);
        bust = info.get_modification_date_time().to_unix();
    } catch (e) {
        logError(e);
    }
    return import(`${file.get_uri()}?b=${bust}`);
}

export default class HallMonitor extends Extension {
    async enable() {
        const generation = (this._generation = (this._generation ?? 0) + 1);

        let mod;
        try {
            mod = await bustImport(this.dir.get_child('impl.js'));
        } catch (e) {
            logError(e);
            // Import failure means the EDS typelibs are missing. A failed
            // import stays cached until its URI changes, so the dialog tells
            // users to log out after installing the packages.
            const help = await bustImport(this.dir.get_child('help.js'));
            this._help = new help.HelpDialog();
            this._help.show();
            return;
        }
        if (generation !== this._generation)
            return; // superseded by a disable or a newer enable

        this._impl = new mod.default({...this.metadata, dir: this.dir, path: this.path});
        await this._impl.enable();
    }

    disable() {
        this._generation = (this._generation ?? 0) + 1;
        this._help?.close();
        this._help = null;
        this._impl?.disable();
        this._impl = null;
    }
}
