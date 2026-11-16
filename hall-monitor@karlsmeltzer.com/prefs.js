// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const NO_LINK_ACTIONS = [
    {value: 'block', label: 'Block anyway'},
    {value: 'notify', label: 'Notify'},
    {value: 'ignore', label: 'Ignore'},
];

export default class HallMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        const timing = new Adw.PreferencesGroup({title: 'Timing'});
        page.add(timing);

        const lead = new Adw.SpinRow({
            title: 'Trigger before start',
            subtitle: 'minutes',
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 15,
                step_increment: 1, page_increment: 5,
            }),
        });
        lead.set_value(settings.get_int('lead-minutes'));
        lead.connect('notify::value', () =>
            settings.set_int('lead-minutes', Math.round(lead.get_value())));
        timing.add(lead);

        const nolink = new Adw.ComboRow({
            title: 'Events without a meeting link',
            model: new Gtk.StringList({strings: NO_LINK_ACTIONS.map(a => a.label)}),
        });
        nolink.set_selected(Math.max(0,
            NO_LINK_ACTIONS.findIndex(a => a.value === settings.get_string('no-link-action'))));
        nolink.connect('notify::selected', () =>
            settings.set_string('no-link-action', NO_LINK_ACTIONS[nolink.get_selected()].value));
        timing.add(nolink);
    }
}
