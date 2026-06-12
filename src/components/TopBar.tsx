import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "../lib/api";
import { useSettings } from "../lib/settings";

const AUDIO_MODES = [
  "Shooter",
  "RPG",
  "Strategy",
  "Movies",
  "Music",
  "Voice",
  "Automatic",
  "Custom Audio",
];

function AudioPopover({ onClose }: { onClose: () => void }) {
  const [available, setAvailable] = useState(true);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState("Automatic");
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const s = await api.audioStatus();
      setAvailable(s.available);
      setActive(s.active);
      setMode(s.mode);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const pick = async (m: string) => {
    setMode(m);
    try {
      await api.audioSetMode(m);
      await refresh();
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const disable = async () => {
    try {
      await api.audioDisable();
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="popover dark" onMouseLeave={onClose}>
      <h4>Acer TrueHarmony™</h4>

      {!available ? (
        <div className="note" style={{ marginTop: 0 }}>
          Sink de EQ não instalado. Rode uma vez:
          <br />
          <code>~/nitro-sense-linux/packaging/install-trueharmony.sh</code>
        </div>
      ) : (
        <>
          <div
            style={{
              color: "var(--muted)",
              fontSize: 13,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Content Mode</span>
            {active && (
              <span style={{ color: "var(--good)", fontSize: 12 }}>● ativo</span>
            )}
          </div>
          <div className="audio-list">
            {AUDIO_MODES.map((m) => (
              <button
                key={m}
                className={`audio-item ${mode === m && active ? "active" : ""}`}
                onClick={() => pick(m)}
              >
                <span className="dot" />
                {m}
              </button>
            ))}
          </div>
          {active && (
            <button className="audio-off" onClick={disable}>
              Desativar (áudio direto)
            </button>
          )}
          <div className="note">
            EQ nativo via PipeWire. Ao escolher um modo, o áudio é roteado pelo
            sink TrueHarmony e a equalização é aplicada ao vivo.
            {mode === "Custom Audio" && " (Custom: mantém o EQ atual)"}
          </div>
        </>
      )}

      {error && <div className="err">{error}</div>}
    </div>
  );
}

function SettingsPopover({ onClose }: { onClose: () => void }) {
  const { unit, setUnit } = useSettings();
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    api.getAutostart().then(setAutostart).catch(() => {});
  }, []);

  const toggleAutostart = async () => {
    const next = !autostart;
    setAutostart(next);
    try {
      await api.setAutostart(next);
    } catch {
      setAutostart(!next); // revert on failure
    }
  };

  return (
    <div className="popover" onMouseLeave={onClose}>
      <h4>Advanced Settings</h4>
      <div className="pop-row">
        <span>Unidade de temperatura</span>
        <div className="unitseg">
          <button
            className={unit === "C" ? "active" : ""}
            onClick={() => setUnit("C")}
          >
            <span className="dot" /> °C
          </button>
          <button
            className={unit === "F" ? "active" : ""}
            onClick={() => setUnit("F")}
          >
            <span className="dot" /> °F
          </button>
        </div>
      </div>
      <div className="pop-row">
        <span>Iniciar com o sistema</span>
        <div
          className={`switch ${autostart ? "on" : ""}`}
          onClick={toggleAutostart}
          role="switch"
          aria-checked={autostart}
        />
      </div>
      <div className="note">
        Itens exclusivos do Windows (Sticky keys, tecla Windows, backlight do
        teclado) não se aplicam a este EC no Linux e foram omitidos.
      </div>
    </div>
  );
}

export default function TopBar() {
  const [open, setOpen] = useState<"audio" | "settings" | null>(null);
  const win = getCurrentWindow();

  // close popovers on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const toggle = (p: "audio" | "settings") =>
    setOpen((cur) => (cur === p ? null : p));

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand-acer" data-tauri-drag-region>
        acer
      </div>
      <div className="wordmark" data-tauri-drag-region>
        <b>NITRO</b>
        <span>SENSE</span>
      </div>
      <div className="topbar-icons">
        <button
          className={`iconbtn ${open === "audio" ? "active" : ""}`}
          title="Acer TrueHarmony"
          onClick={() => toggle("audio")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {[4, 8, 12, 16, 20].map((x, i) => (
              <line key={x} x1={x} y1={i % 2 ? 6 : 9} x2={x} y2={i % 2 ? 18 : 15} />
            ))}
          </svg>
        </button>
        <button
          className={`iconbtn ${open === "settings" ? "active" : ""}`}
          title="Configurações"
          onClick={() => toggle("settings")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
          </svg>
        </button>
        <button className="iconbtn" title="Minimizar" onClick={() => win.minimize()}>
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          className="iconbtn"
          title="Maximizar"
          onClick={() => win.toggleMaximize()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
        <button className="iconbtn close" title="Fechar" onClick={() => win.close()}>
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {open === "audio" && <AudioPopover onClose={() => setOpen(null)} />}
      {open === "settings" && <SettingsPopover onClose={() => setOpen(null)} />}
    </header>
  );
}
