import { useEffect, useState } from "react";
import { api, BatteryStatus } from "../lib/api";

function HealthHistory({ data }: { data: { t: number; percent: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="batt-hist">
        <div className="empty">sem histórico do upower ainda</div>
      </div>
    );
  }
  const t0 = data[0].t;
  const tN = data[data.length - 1].t;
  const span = tN - t0 || 1;
  const pts = data
    .map((p) => {
      const x = ((p.t - t0) / span) * 100;
      const y = 100 - (p.percent / 100) * 92 - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,100 ${pts} 100,100`;
  return (
    <div className="batt-hist">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={area} fill="rgba(226,35,26,0.12)" />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const STATUS_PT: Record<string, string> = {
  Charging: "Carregando",
  Discharging: "Descarregando",
  Full: "Cheia",
  "Not charging": "Não carregando",
  Unknown: "—",
};

export default function BatteryPanel() {
  const [bat, setBat] = useState<BatteryStatus | null>(null);
  const [error, setError] = useState("");

  const tick = async () => {
    try {
      setBat(await api.readBattery());
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  const health = bat?.health_percent;
  const charging = bat?.status === "Charging" || bat?.status === "Full";

  return (
    <section className="panel">
      <div className="panel-headbar">
        <span className="panel-head">Bateria</span>
      </div>
      <div className="panel-body">
        {!bat?.present ? (
          <div className="how">{error || "Nenhuma bateria detectada."}</div>
        ) : (
          <>
            <div className="batt-top">
              <div>
                <div className="batt-health">
                  {bat.capacity}%
                  <small>carga</small>
                </div>
                <div className="batt-status">
                  Saúde {health != null ? `${health.toFixed(0)}%` : "—"} ·{" "}
                  <span className={charging ? "chg" : "dis"}>
                    {STATUS_PT[bat.status] ?? bat.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="healthbar">
              <i style={{ width: `${Math.min(100, Math.max(0, bat.capacity))}%` }} />
            </div>

            <div className="batt-grid">
              <span className="k">Capacidade atual</span>
              <span className="v">
                {bat.full != null ? `${bat.full} ${bat.unit}` : "—"}
              </span>
              <span className="k">Capacidade de fábrica</span>
              <span className="v">
                {bat.full_design != null ? `${bat.full_design} ${bat.unit}` : "—"}
              </span>
              <span className="k">Ciclos</span>
              <span className="v">{bat.cycle_count ?? "não reportado"}</span>
              <span className="k">Consumo</span>
              <span className="v">
                {bat.power_w != null ? `${Math.abs(bat.power_w).toFixed(1)} W` : "—"}
              </span>
              <span className="k">Tensão</span>
              <span className="v">
                {bat.voltage_v != null ? `${bat.voltage_v.toFixed(2)} V` : "—"}
              </span>
              <span className="k">Modelo</span>
              <span className="v">{bat.model ?? "—"}</span>
            </div>

            <HealthHistory data={bat.history} />
            <div className="how" style={{ marginTop: 6 }}>
              Histórico de carga das últimas sessões (fonte: upower).
            </div>
          </>
        )}
      </div>
    </section>
  );
}
