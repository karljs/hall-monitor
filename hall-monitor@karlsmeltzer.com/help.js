// Copyright (C) 2026 Karl Smeltzer
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const DISTRO_CMDS = {
    apt: 'sudo apt install gir1.2-ecal-2.0 gir1.2-edataserver-1.2 gir1.2-ical-3.0',
    dnf: 'sudo dnf install evolution-data-server',
    pacman: 'sudo pacman -S evolution-data-server libical',
    zypper: 'sudo zypper install typelib-1_0-ECal-2_0 typelib-1_0-EDataServer-1_2 typelib-1_0-ICal-3_0',
};

// GNOME extensions have no dependency mechanism; the best we can do is point
// the user at the right package manager via /etc/os-release
function installCommand() {
    const ids = [GLib.get_os_info('ID'), GLib.get_os_info('ID_LIKE')]
        .filter(Boolean).join(' ').toLowerCase().split(/\s+/);
    for (const id of ids) {
        if (id === 'debian' || id === 'ubuntu')
            return DISTRO_CMDS.apt;
        if (id === 'fedora' || id === 'rhel')
            return DISTRO_CMDS.dnf;
        if (id === 'arch')
            return DISTRO_CMDS.pacman;
        if (id === 'suse' || id === 'opensuse')
            return DISTRO_CMDS.zypper;
    }
    return null;
}

export class HelpDialog {
    show() {
        if (this._overlay)
            return;
        const monitor = Main.layoutManager.primaryMonitor;

        const overlay = new St.Bin({
            style_class: 'hallmonitor-overlay',
            reactive: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        overlay.set_position(monitor.x, monitor.y);
        overlay.set_size(monitor.width, monitor.height);

        const card = new St.BoxLayout({vertical: true, style_class: 'modal-dialog'});
        overlay.set_child(card);

        const contentBox = new St.BoxLayout({
            vertical: true,
            style_class: 'modal-dialog-content-box',
            y_expand: true,
        });
        card.add_child(contentBox);

        const content = new St.BoxLayout({vertical: true, style_class: 'message-dialog-content'});
        contentBox.add_child(content);

        content.add_child(new St.Label({
            text: 'Calendar libraries missing',
            style_class: 'message-dialog-title',
        }));
        const intro = new St.Label({
            text: 'Hall Monitor cannot read your calendars without the GNOME ' +
                'calendar bindings. Install them, then log out and back in:',
            style_class: 'message-dialog-description',
        });
        intro.clutter_text.line_wrap = true;
        content.add_child(intro);

        const cmd = installCommand();
        if (cmd) {
            const command = new St.Label({
                text: cmd,
                style_class: 'message-dialog-description',
                style: 'font-family: monospace;',
            });
            command.clutter_text.line_wrap = true;
            content.add_child(command);
        } else {
            const fallback = new St.Label({
                text: 'Install your distribution\'s evolution-data-server ' +
                    'and libical packages (see the README).',
                style_class: 'message-dialog-description',
            });
            fallback.clutter_text.line_wrap = true;
            content.add_child(fallback);
        }

        const row = new St.Widget({
            style_class: 'modal-dialog-button-box',
            layout_manager: new Clutter.BoxLayout({spacing: 12, homogeneous: true}),
        });
        card.add_child(row);

        const buttonProps = {
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true,
        };

        const close = new St.Button({...buttonProps, label: 'Close', style_class: 'modal-dialog-button'});
        close.connect('clicked', () => this.close());
        row.add_child(close);

        let focusBtn = close;
        if (cmd) {
            const copy = new St.Button({...buttonProps, label: 'Copy and close', style_class: 'modal-dialog-button'});
            copy.add_style_pseudo_class('default');
            copy.connect('clicked', () => {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, cmd);
                this.close();
            });
            row.add_child(copy);
            focusBtn = copy;
        }

        const onKey = (o, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this.close();
                return true;
            }
            return false;
        };
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

    close() {
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
