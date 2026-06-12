import { SystemSupport } from "../lib/api";

export default function Unsupported({
  info,
  onContinue,
}: {
  info: SystemSupport;
  onContinue: () => void;
}) {
  const machine =
    [info.vendor, info.product].filter(Boolean).join(" ") || "desconhecido";

  return (
    <div className="unsupported">
      <div className="unsupported-card">
        <div className="unsupported-badge">acer</div>
        <h1>Hardware não suportado</h1>
        <p className="unsupported-lead">
          O <b>Nitro Sense Linux</b> é focado em notebooks <b>Acer Nitro</b> e{" "}
          <b>Predator</b>. Ele controla as ventoinhas, o plano de energia e
          monitora os sensores pela interface <code>acer_wmi</code> — que só
          existe nesses notebooks gamer da Acer.
        </p>

        <div className="unsupported-detected">
          <span className="k">Detectado</span>
          <span className="v">{machine}</span>
          <span className="k">Tipo</span>
          <span className="v">
            {info.is_laptop ? "Notebook" : "Desktop / outro"}
          </span>
          <span className="k">Interface acer_wmi</span>
          <span className="v">
            {info.has_acer_hwmon ? "presente" : "ausente"}
          </span>
        </div>

        <p className="how" style={{ marginTop: 16 }}>
          {info.is_acer
            ? 'Este equipamento Acer não expõe a interface de notebook gamer (hwmon "acer"); os controles de fan e perfil não se aplicam.'
            : "Este equipamento não é um notebook Acer Nitro/Predator. Continuar mesmo assim só mostraria leituras vazias e pode travar a interface."}
        </p>

        <button className="unsupported-continue" onClick={onContinue}>
          Continuar mesmo assim (avançado)
        </button>
      </div>
    </div>
  );
}
