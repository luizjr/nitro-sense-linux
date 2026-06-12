#!/bin/bash
# Installs the NitroSense TrueHarmony virtual EQ sink into PipeWire.
# Runs as your normal user (NOT root) — it touches ~/.config and --user services.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/nitro-trueharmony.conf"
DEST_DIR="$HOME/.config/pipewire/pipewire.conf.d"
DEST="$DEST_DIR/nitro-trueharmony.conf"

if [[ $EUID -eq 0 ]]; then
  echo "do NOT run as root — run as your normal user (uses systemctl --user)" >&2
  exit 1
fi

# Detect the internal speaker sink so the EQ output can be pinned to it
# (prevents a routing loop when the virtual sink becomes default).
echo "==> detecting output sink to pin the EQ to"
SPK="$(pw-dump 2>/dev/null | python3 -c '
import sys, json
data = json.load(sys.stdin)
sinks = []
for o in data:
    p = o.get("info", {}).get("props", {})
    if p.get("media.class") == "Audio/Sink":
        n = p.get("node.name", "")
        if n and n != "trueharmony_sink":
            sinks.append(n)
spk = next((s for s in sinks if "Speaker" in s), sinks[0] if sinks else "")
print(spk)
')"

if [[ -z "$SPK" ]]; then
  echo "could not detect an output sink. Is anything playing audio? Aborting." >&2
  exit 2
fi
echo "    pinning EQ output to: $SPK"

echo "==> installing $DEST"
mkdir -p "$DEST_DIR"
sed "s|@SPEAKER_SINK@|$SPK|" "$SRC" > "$DEST"
chmod 644 "$DEST"

echo "==> restarting PipeWire user services"
systemctl --user restart pipewire.service 2>/dev/null || true
systemctl --user restart pipewire-pulse.service 2>/dev/null || true
systemctl --user restart wireplumber.service 2>/dev/null || true

# give WirePlumber a moment to instantiate the sink
sleep 2

echo "==> checking for the TrueHarmony sink"
if pw-cli ls Node 2>/dev/null | grep -q trueharmony_sink; then
  echo "OK: sink 'trueharmony_sink' is present (EQ -> $SPK)."
  echo "    Pick a Content Mode in the app's TrueHarmony popover."
else
  echo "WARN: sink not found yet. Check 'journalctl --user -u pipewire' for module errors." >&2
  exit 3
fi
