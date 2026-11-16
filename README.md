# Hall Monitor

Tired of getting a 10 minute warning for a meeting, then getting lost in
work and forgetting to join?

This Gnome extension will pop up an unmissable, full-screen modal reminder when
you have just a minute to go (time configurable). Tries to skip the warning when
your focused window title matches the event.

## Depends

Ubuntu/Debian:

    sudo apt install gir1.2-ecal-2.0 gir1.2-edataserver-1.2 gir1.2-ical-3.0

Fedora (untested):

    sudo dnf install evolution-data-server

Arch (untested):

    sudo pacman -S evolution-data-server libical

openSUSE (untested):

    sudo zypper install typelib-1_0-ECal-2_0 typelib-1_0-EDataServer-1_2 typelib-1_0-ICal-3_0

Then log out and back in. If the libraries are missing, the extension shows a
dialog with the right command for your distribution.

## Install

    make install

Log out and back in, then:

    gnome-extensions enable hall-monitor@karlsmeltzer.com

Uninstall: `make uninstall`

## License

GPL-2.0-or-later, see [LICENSE](LICENSE).

