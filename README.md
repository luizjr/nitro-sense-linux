# Nitro Sense Linux

Substituto open-source do **NitroSense** da Acer, focado no **Nitro AN515-58**
rodando Ubuntu/Linux.

Funcionalidades cobertas (espelhando os `.ini` do NitroSense V3.01.3052):

| Recurso original | Implementação Linux |
|---|---|
| Modos Quiet / Default / Performance | `acpi_platform_profile` (via `acer_wmi`) |
| Velocidade do fan da CPU e da GPU | `hwmon` `pwm1` / `pwm2` |
| Monitor de RPM + temperatura | `hwmon` `fan*_input`, `temp*_input`, `coretemp` |
| OC da GPU (RTX 3050 Mobile, `DEV_25A2`) | `nvidia-smi` + perfis Quiet/Default/Performance (+0/+100 MHz core, +0/+200 MHz mem — valores extraídos do `NitroSense.ini`) |
| Teclado RGB 4 zonas | **fase 2** — requer WMI bruto (não suportado pelo `acer_wmi` stock) |

## Stack

- **Backend**: Rust + Tauri 2
- **Frontend**: React 18 + Vite + TypeScript
- **Privileged writes**: helper Bash + policy do polkit

## Build & dev

```bash
# 1. instalar dependências do sistema (uma vez)
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
                 libssl-dev libayatana-appindicator3-dev

# 2. instalar o helper privilegiado
sudo install -m 755 packaging/nitro-sense-helper /usr/local/bin/nitro-sense-helper
sudo install -m 644 packaging/com.nitrosenselinux.helper.policy \
    /usr/share/polkit-1/actions/com.nitrosenselinux.helper.policy

# 2b. (recomendado) regra udev p/ escrita direta sem prompt do pkexec.
#     Dá ao seu usuário acesso de escrita aos nós sysfs de fan e platform_profile,
#     então trocar perfil / auto-trocar AC<->Bateria não pede senha.
#     Edite o grupo "luizjr" em packaging/99-nitro-sense.rules se outro usuário rodar.
sudo ./packaging/install-udev.sh

# 2c. (opcional) TrueHarmony — sink de EQ no PipeWire (Content Modes de áudio).
#     Roda como usuário normal (NÃO root); reinicia o pipewire do usuário.
./packaging/install-trueharmony.sh

# 3. dependências do projeto
pnpm install
cargo install tauri-cli --version "^2"   # se ainda não tiver o `cargo tauri`

# 4. rodar em modo dev
pnpm tauri dev

# 5. gerar .deb / AppImage
pnpm tauri build
```

## Arquivos de hardware do AN515-58 (referência)

Extraídos do instalador oficial NitroSense V3.01.3052, `Plugs/Nitro AN515-58/`:

- `Feature.ini` — tipo de máquina, ano (2022)
- `HW_Support.ini` — fans suportados, lighting de 4 zonas, hotkeys
- `NitroSense.ini` — 11 GPUs NVIDIA reconhecidas e seus offsets OC

Sua GPU (`[10de:25a2]` SubSystem `[1025:159c]`) é a **GPUName2** —
RTX 3050 Mobile — perfil de Performance: core **+100 MHz**, mem **+200 MHz**.

> **OC de GPU — não viável neste laptop:** em Optimus + Wayland o offset de clock
> (nvidia-settings/Coolbits) não tem alvo X, o power limit é travado pelo EC, e o
> lock de clock (`nvidia-smi -lgc`) não ajuda numa GPU limitada por TGP. A performance
> da GPU é governada pelo `platform_profile` (Power Plan). A seção GPU é só monitoramento.

> **RGB 4 zonas — não se aplica:** este SKU tem backlight **vermelho de zona única**
> (Fn+F9 no hardware). O único controle por software seria o timeout, mas depende de um
> serviço Acer do Windows ausente. Ver memória do projeto.

## Roadmap

- [x] Tray icon + auto-start no boot
- [x] Auto-troca de perfil AC/Bateria (sem prompt via regra udev)
- [x] TrueHarmony — EQ de áudio nativo via PipeWire
- [x] Gráfico histórico de temp/RPM + load de CPU

## Créditos

O módulo de teclado em `packaging/kbd-module/` (`nitro_kbd.c`) e o protocolo da
interface WMI gaming da Acer foram derivados do projeto
[**acer-predator-turbo-and-rgb-keyboard-linux-module**](https://github.com/JafarAkhondali/acer-predator-turbo-and-rgb-keyboard-linux-module)
de [Jafar Akhondali](https://github.com/JafarAkhondali) e contribuidores (licença **GPL-2.0**).
Esse trabalho foi essencial para entender o método WMI do teclado gaming e o mapeamento
das ventoinhas/perfil no `acer_wmi`. Muito obrigado à comunidade. 🙏

Como reaproveitamos código GPL-2.0, o arquivo `nitro_kbd.c` permanece sob **GPL-2.0**
(marcado via `SPDX-License-Identifier`); o restante do projeto é **GPL-3.0**.

## Licença

[GPL-3.0](LICENSE) — exceto `packaging/kbd-module/nitro_kbd.c`, sob GPL-2.0 (ver acima).
