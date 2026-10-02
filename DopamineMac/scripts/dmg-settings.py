# dmgbuild settings for the drag-to-Applications installer window.
# Invoked by scripts/dmg.sh as: dmgbuild -s dmg-settings.py -D app=<path> -D background=<png> ...
# Icon positions must match the landing pads drawn in Resources/dmg/background.html.
import os.path

app = defines["app"]  # noqa: F821 - provided by dmgbuild
app_name = os.path.basename(app)

format = "UDZO"
filesystem = "HFS+"
files = [app]
symlinks = {"Applications": "/Applications"}
icon = os.path.join(app, "Contents", "Resources", "AppIcon.icns")

background = defines["background"]  # noqa: F821 - background@2x.png is picked up automatically
# Height adds the 28 pt title bar so the whole 660×400 background shows.
window_rect = ((200, 160), (660, 428))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False

icon_size = 128
text_size = 13
icon_locations = {
    app_name: (170, 210),
    "Applications": (490, 210),
}
hide_extensions = [app_name]
