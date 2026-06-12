import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const NICE: Record<string, { name: string; sub?: string }> = {
  "low-power": { name: "Eco", sub: "Power Saver" },
  quiet: { name: "Silencioso", sub: "Quiet" },
  balanced: { name: "Equilibrado", sub: "Balance" },
  "balanced-performance": { name: "Equilibrado+", sub: "Balance [Acer Optimized]" },
  performance: { name: "Performance", sub: "High-Performance" },
};

type Source = "ac" | "battery";

const prefKey = (s: Source) => `profile_${s}`;
const getPref = (s: Source) => localStorage.getItem(prefKey(s)) || "";
const setPref = (s: Source, v: string) => localStorage.setItem(prefKey(s), v);

export default function PowerPlan() {
  const [current, setCurrent] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [onAc, setOnAc] = useState(true);
  const [tab, setTab] = useState<Source>("ac");
  const [error, setError] = useState("");
  const prevAc = useRef<boolean | null>(null);
  // bump to re-render after localStorage pref writes
  const [, force] = useState(0);

  const apply = async (p: string) => {
    try {
      await api.setPlatformProfile(p);
      setCurrent(await api.getPlatformProfile());
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  // initial load: profile, choices, source; seed prefs from the live profile
  useEffect(() => {
    (async () => {
      try {
        const [c, list, ac] = await Promise.all([
          api.getPlatformProfile(),
          api.listPlatformProfiles(),
          api.getPowerSource(),
        ]);
        setCurrent(c);
        setChoices(list);
        setOnAc(ac);
        setTab(ac ? "ac" : "battery");
        prevAc.current = ac;
        if (!getPref("ac")) setPref("ac", c);
        if (!getPref("battery")) setPref("battery", c);
        force((n) => n + 1);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // poll power source; auto-apply the stored profile when it flips
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const ac = await api.getPowerSource();
        setOnAc(ac);
        if (prevAc.current !== null && ac !== prevAc.current) {
          const want = getPref(ac ? "ac" : "battery");
          setTab(ac ? "ac" : "battery");
          if (want) await apply(want);
        }
        prevAc.current = ac;
      } catch {
        /* transient read failure — ignore */
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // choose a profile for the tab currently being edited
  const choose = async (p: string) => {
    setPref(tab, p);
    force((n) => n + 1);
    const liveSource: Source = onAc ? "ac" : "battery";
    if (tab === liveSource) await apply(p);
  };

  const liveSource: Source = onAc ? "ac" : "battery";
  const highlighted = tab === liveSource ? current : getPref(tab);

  return (
    <section className="panel">
      <div className="panel-headbar">
        <span className="panel-head">Power Plan</span>
      </div>
      <div className="panel-body">
        <div className="mode-label">Mode</div>
        <div className="seg">
          <button
            className={tab === "ac" ? "active" : ""}
            onClick={() => setTab("ac")}
          >
            AC {onAc && <i className="src-dot" title="fonte em uso" />}
          </button>
          <button
            className={tab === "battery" ? "active" : ""}
            onClick={() => setTab("battery")}
          >
            Battery {!onAc && <i className="src-dot" title="fonte em uso" />}
          </button>
        </div>

        <div className="plan-list">
          {choices.map((p) => {
            const nice = NICE[p];
            return (
              <button
                key={p}
                className={`plan-item ${p === highlighted ? "active" : ""}`}
                onClick={() => choose(p)}
              >
                {nice?.name ?? p}
                {nice?.sub && <small>{nice.sub}</small>}
              </button>
            );
          })}
        </div>

        <div className="how" style={{ marginTop: 10 }}>
          Perfil aplicado automaticamente ao ligar/desligar a tomada.{" "}
          {tab !== liveSource && "Editando o perfil da outra fonte — vale quando ela ativar."}
        </div>

        {error && <div className="err">{error}</div>}
      </div>
    </section>
  );
}
