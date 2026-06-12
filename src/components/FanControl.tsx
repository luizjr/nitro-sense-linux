import { useEffect, useRef, useState } from "react";
import { api, FanReading } from "../lib/api";
import FanGauge from "./FanGauge";

type Mode = "auto" | "max" | "custom";

function FanIcon({ kind }: { kind: Mode }) {
  // Custom → sliders (matches the per-fan slider UI)
  if (kind === "custom") {
    return (
      <svg
        className="ico"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <line x1="4" y1="8.5" x2="20" y2="8.5" />
        <circle cx="9" cy="8.5" r="2.3" fill="var(--panel-2)" />
        <line x1="4" y1="15.5" x2="20" y2="15.5" />
        <circle cx="15" cy="15.5" r="2.3" fill="var(--panel-2)" />
      </svg>
    );
  }
  // Auto (outlined fan + "A") / Max (filled fan)
  const filled = kind === "max";
  const blades = [0, 120, 240].map((d) => (
    <path
      key={d}
      d="M12 12 C 9.7 7.2, 10.6 4, 12 2.4 C 13.4 4, 14.3 7.2, 12 12 Z"
      transform={`rotate(${d} 12 12)`}
    />
  ));
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      <g>{blades}</g>
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      {kind === "auto" && (
        <text
          x="18.5"
          y="8"
          fontSize="9"
          fontWeight="800"
          fill="currentColor"
          stroke="none"
          textAnchor="middle"
        >
          A
        </text>
      )}
    </svg>
  );
}

export default function FanControl() {
  const [fans, setFans] = useState<FanReading[]>([]);
  const [mode, setMode] = useState<Mode>("auto");
  const [error, setError] = useState("");
  const touched = useRef(false); // once the user picks a mode, stop auto-deriving it

  const tick = async () => {
    try {
      const f = await api.readFans();
      setFans(f);
      if (!touched.current) {
        const allAuto = f.every((x) => x.auto);
        const allMax = f.every((x) => x.pwm >= 250);
        setMode(allAuto ? "auto" : allMax ? "max" : "custom");
      }
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, []);

  const applyMode = async (m: Mode) => {
    touched.current = true;
    setMode(m);
    try {
      if (m === "auto") await Promise.all(fans.map((f) => api.setFanAuto(f.index)));
      else if (m === "max") await Promise.all(fans.map((f) => api.setFanPwm(f.index, 255)));
      // custom: leave hardware as-is, just reveal the sliders
      await tick();
    } catch (e) {
      setError(String(e));
    }
  };

  const onSlider = async (index: number, pwm: number) => {
    touched.current = true;
    setFans((prev) => prev.map((f) => (f.index === index ? { ...f, pwm, auto: false } : f)));
    try {
      await api.setFanPwm(index, pwm);
    } catch (e) {
      setError(String(e));
    }
  };

  const onFanAuto = async (index: number) => {
    try {
      await api.setFanAuto(index);
      await tick();
    } catch (e) {
      setError(String(e));
    }
  };

  const cpu = fans.find((f) => f.label === "CPU");
  const gpu = fans.find((f) => f.label === "GPU");
  const coolBoost = mode === "max";

  const renderControls = (fan: FanReading | undefined) =>
    fan && mode === "custom" ? (
      <div className="fan-slider-wrap">
        <input
          className="rng"
          type="range"
          min={40}
          max={255}
          value={fan.pwm}
          onChange={(e) => onSlider(fan.index, parseInt(e.target.value, 10))}
        />
        <button
          className={`fan-auto-btn ${fan.auto ? "on" : ""}`}
          onClick={() => onFanAuto(fan.index)}
        >
          Auto
        </button>
      </div>
    ) : null;

  return (
    <section className="panel span-2">
      <div className="panel-headbar">
        <span className="panel-head">Fan Control</span>
      </div>
      <div className="panel-body" style={{ position: "relative" }}>
        <div className="coolboost">
          <span className="info">i</span>
          <span>CoolBoost™</span>
          <div
            className={`switch ${coolBoost ? "on" : ""}`}
            onClick={() => applyMode(coolBoost ? "auto" : "max")}
            role="switch"
            aria-checked={coolBoost}
          />
        </div>

        <div className="fan-control-body">
          <div className="fan-modes">
            {(["auto", "max", "custom"] as Mode[]).map((m) => (
              <button
                key={m}
                className={`fan-mode ${mode === m ? "active" : ""}`}
                onClick={() => applyMode(m)}
              >
                <FanIcon kind={m} />
                <span style={{ textTransform: "capitalize" }}>{m}</span>
              </button>
            ))}
          </div>

          <div className="gauge-col cpu">
            {renderControls(cpu)}
            <span className="gauge-side">CPU</span>
            <FanGauge rpm={cpu?.rpm ?? 0} />
          </div>

          <div className="gauge-col gpu">
            <FanGauge rpm={gpu?.rpm ?? 0} />
            <span className="gauge-side">GPU</span>
            {renderControls(gpu)}
          </div>
        </div>

        {error && <div className="err">{error}</div>}
      </div>
    </section>
  );
}
