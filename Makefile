UUID := hall-monitor@karlsmeltzer.com
DEST := $(HOME)/.local/share/gnome-shell/extensions

.PHONY: install uninstall test probe reload

# disable and enable only write gsettings; the shell applies them in async
# handlers that race if fired back-to-back and can leave the extension stuck
# INACTIVE, so wait for the disable to settle before enabling again
reload: install
	-gnome-extensions disable $(UUID)
	@sleep 1
	gnome-extensions enable $(UUID)
	@gnome-extensions info $(UUID) | grep -E 'Enabled|State'

install: $(UUID)/schemas/gschemas.compiled
	mkdir -p $(DEST)
	rm -rf $(DEST)/$(UUID)
	cp -r $(UUID) $(DEST)/

$(UUID)/schemas/gschemas.compiled: $(UUID)/schemas/*.gschema.xml
	glib-compile-schemas $(UUID)/schemas

uninstall:
	rm -rf $(DEST)/$(UUID)

test:
	gjs -m tests/util.test.js

pack:
	gnome-extensions pack --force $(UUID) \
		--extra-source=impl.js \
		--extra-source=eds.js \
		--extra-source=util.js \
		--extra-source=help.js \
		--extra-source=icon.png

# EDS atexit teardown segfaults the standalone probe after all output is printed;
# the leading - keeps that cosmetic crash from failing the target.
probe:
	-@gjs -m tools/dump-calendar.js
