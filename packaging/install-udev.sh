#!/bin/bash
# Installs the Nitro Sense udev rule so fan/profile writes skip the pkexec prompt.
# Run with sudo:  sudo ./packaging/install-udev.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
RULE="$HERE/99-nitro-sense.rules"
DEST="/etc/udev/rules.d/99-nitro-sense.rules"

if [[ $EUID -ne 0 ]]; then
  echo "run as root: sudo $0" >&2
  exit 1
fi

echo "==> installing $DEST"
install -m 644 "$RULE" "$DEST"

echo "==> reloading udev"
udevadm control --reload
udevadm trigger -s hwmon -s platform-profile

# small settle, then show the resulting permissions
sleep 1
echo "==> resulting permissions:"
for h in /sys/class/hwmon/hwmon*; do
  [[ "$(cat "$h/name" 2>/dev/null)" == "acer" ]] || continue
  ls -l "$h"/pwm1 "$h"/pwm2 "$h"/pwm1_enable "$h"/pwm2_enable 2>/dev/null
done
ls -l /sys/firmware/acpi/platform_profile

echo
echo "Done. If the files above show group 'luizjr' with a 'w' in the group bits"
echo "(e.g. -rw-rw-r--), the app now writes directly with no pkexec prompt."
