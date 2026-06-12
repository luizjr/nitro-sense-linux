import { useEffect, useState } from "react";
import { api, GpuStatus } from "../lib/api";
import { formatTemp, useSettings } from "../lib/settings";

export default function GpuPanel() {
  const [gpu, setGpu] = useState<GpuStatus | null>(null);
  const [error, setError] = useState("");
  const { unit } = useSettings();

  useEffect(() => {
    const tick = async () => {
      try {
        setGpu(await api.readGpuStatus());
        setError("");
      } catch (e) {
        setError(String(e));
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel">
      <div className="panel-headbar">
        <span className="panel-head">GPU</span>
      </div>
      <div className="panel-body">
        {error ? (
          <div className="how">{error}</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "#d7dade", marginBottom: 12 }}>
              {gpu?.name ?? "—"}
            </div>
            <div className="batt-grid">
              <span className="k">Temperatura</span>
              <span className="v">{formatTemp(gpu?.temp_c, unit)}</span>
              <span className="k">Uso</span>
              <span className="v">{gpu ? `${gpu.utilization}%` : "—"}</span>
              <span className="k">Clock núcleo</span>
              <span className="v">{gpu ? `${gpu.graphics_mhz} MHz` : "—"}</span>
              <span className="k">Clock memória</span>
              <span className="v">{gpu ? `${gpu.memory_mhz} MHz` : "—"}</span>
              <span className="k">Potência</span>
              <span className="v">{gpu ? `${gpu.power_w.toFixed(1)} W` : "—"}</span>
            </div>
            <div className="how" style={{ marginTop: 12 }}>
              A performance da GPU (TGP/boost) é governada pelo perfil do{" "}
              <b>Power Plan</b> via EC — não há overclock por software neste laptop
              (Optimus + Wayland).
            </div>
          </>
        )}
      </div>
    </section>
  );
}
