# Resonator // Consola Neural Bridge & Modulación Acústica Única

Plan de implementación integral para la generación de diseño sonoro con Inteligencia Artificial (Gemini 3.8 Flash), integración del módulo de síntesis acústica diferenciada (Cross-FM y Ring Modulation), y biblioteca ilimitada de presets con búsqueda, categorización y persistencia.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas a través del proceso interactivo con el usuario:
> - **Módulo sonoro único agregado:** Modulación cruzada FM (Cross-Modulation) y Modulador en Anillo (Ring Modulator) con controles dedicados de `fmDepth`, `fmRatio` y `ringModMix`. Permite generar timbres metálicos, campanas cuánticas, texturas ácidas y subarmónicos imposibles en sintetizadores substractivos comunes.
> - **Ubicación de la interfaz IA:** Consola **Neural Bridge** integrada directamente sobre el chasis físico del sintetizador, enmarcada con biseles de bronce y placa de grafito, accesible de forma natural en el flujo de trabajo de interpretación.
> - **Gestión de biblioteca:** Banco ilimitado de presets en almacenamiento persistente con barra de búsqueda rápida, etiquetas estilísticas (*Sci-Fi, Colchones, Bajos, Agresivo, Metálico*), previsualización de parámetros y exportación/importación universal.

---

## 1. Overview & Core Concept

- **Qué hace:** Permite al intérprete o diseñador de sonido escribir cualquier concepto abstracto, estado de ánimo, textura o metáfora sonora (ej. *"Lluvia ácida sobre neón en Tokio"*, *"Catedral sumergida a 3000 metros"*, *"808 de traición hiper-comprimido"*, *"Arpa cuántica en gravedad cero"*). El modelo **Gemini 3.8 Flash** analiza las implicaciones acústicas, psicoacústicas y visuales del prompt y genera una estructura JSON completa y estricta con todas las perillas de osciladores, filtro, envolvente ADSR, modulación FM/Ring, saturación de válvulas, espacio delay y coloración térmica del núcleo de plasma.
- **Público objetivo:** Músicos electrónicos, productores de música de vanguardia, diseñadores de sonido y creadores multimedia que buscan crear sonoridades complejas y personalizadas sin perder el control manual táctil.
- **Valor diferencial:** A diferencia de sintetizadores convencionales con presets estáticos, Resonator traduce ideas verbales en estados físicos de síntesis paramétrica en milisegundos, moviendo las perillas reales de la interfaz, recalculando la topología de la señal y coloreando el núcleo físico de plasma con retroalimentación lumínica.

---

## 2. User Experience & Visual Design

### Flujo de Usuario Clave
1. **Activación del Neural Bridge:** El usuario observa el módulo *Neural Bridge* integrado con bisel de bronce en la parte superior del chasis.
2. **Entrada de Concepto Sonoro:** El usuario introduce una frase o selecciona chips de sugerencias evocativas (*Ecos Cósmicos, Vórtice Ácido, Titanio Líquido, Sub-Bajo Tectónico*).
3. **Generación Neuronal:** Al pulsar `[TRANSDUCIR SONIDO]`, el indicador de estado pasa a procesamiento cuántico y Gemini 3.8 Flash sintetiza el preset.
4. **Resonancia Inmediata:** Los parámetros se aplican suavemente al motor de audio (evitando clics mediante interpolación en `setTargetAtTime`), las perillas y faders giran a sus nuevas posiciones, y el núcleo de plasma adapta su tono y brillo térmico.
5. **Ajuste & Guardado:** El usuario puede tocar las notas en el teclado táctil, ajustar cualquier perilla para afinar el timbre y guardar el preset con nombre y etiquetas en la biblioteca ilimitada.

### Lenguaje Visual & Estética (Obsidian Futurism)
- **Materialidad:** Placas de grafito cepillado (`#181a1d`, `#121316`) con bordes biselados metálicos en bronce envejecido (`#d49058`, `#8c5a32`).
- **Consola Neural Bridge:** Ranura empotrada en el chasis con display OLED monocromático ámbar/cian para el prompt y visualización de la respuesta espectral estimada.
- **Tipografía:** Pares refinados de `Cinzel` (marcado tipográfico y títulos de producto de lujo) y `JetBrains Mono` / `Space Mono` (valores técnicos, frecuencias y parámetros).
- **Controles Nuevos FM & Ring Mod:** Perillas moleteadas táctiles dedicadas para `FM PROFUNDIDAD`, `FM RATIO` y `RING MOD MIX` en el panel de oscilación.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Integración de Gemini 3.8 Flash vía Proxy Backend Express:**
  - *Enfoque:* Implementar el endpoint `/api/generate-sound-preset` en el servidor Express con el SDK `@google/genai` utilizando `gemini-3.8-flash` y `responseSchema` estricto en JSON.
  - *Razón:* Protege las credenciales de API sin exponer secretos al navegador del cliente y garantiza respuestas estructuradas al 100% que el sintetizador pueda parsear sin errores tipográficos.
  - *Mecanismo de Respaldo:* En caso de que no exista conexión de red o clave activa en desarrollo, el sistema incluye un generador heurístico modal autónomo que responde en tiempo real con variaciones aleatorias coherentes.

- **Decisión 2: Ampliación de Síntesis con Modulación Cruzada FM y Modulador en Anillo:**
  - *Enfoque:* Agregar un oscilador modulador dedicado acoplado a la frecuencia del oscilador portador y un multiplicador de ganancia (`GainNode`) para síntesis en anillo (`carrier * modulator`).
  - *Razón:* La síntesis substractiva estándar suena rápidamente genérica; el acoplamiento FM y Ring Mod permite al modelo de IA invocar sonidos de campana, percusiones industriales, frecuencias metálicas y subgraves complejos pedidos por el usuario.

- **Decisión 3: Biblioteca de Presets con Filtros, Búsqueda y Almacenamiento Ilimitado:**
  - *Enfoque:* Almacenar la colección en `localStorage` con estructura indexada por tags y fecha, con opción de búsqueda en tiempo real y selector con orden cronológico o alfabético.
  - *Razón:* Proporciona acceso instantáneo sin latencia, soporte offline completo y retención permanente de creaciones personalizadas.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RESONATOR CHASSIS                               │
├────────────────────────────────────────────────────────────────────────┤
│  PRESET BAR & BIBLIOTECA ILIMITADA (Búsqueda, Tags, Guardar, Exportar) │
├────────────────────────────────────────────────────────────────────────┤
│  NEURAL BRIDGE (Gemini 3.8 Flash // Prompt Input & Análisis Acústico)  │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│  OSC + FM + RING │   FILTER (VCF)   │  PLASMA CORE    │ OUTPUT & FX    │
│  - Carrier Wave  │   - Cutoff Hz    │  - Plasma Color │ - Delay Time   │
│  - Sub / Noise   │   - Resonance Q  │  - Thermal Glow │ - Feedback     │
│  - FM Ratio/Depth│   - ADSR Envelope│  - Ion Vortex   │ - Analog Drive │
│  - Ring Mod Mix  │   - Env Mod      │  - Vacuum Glass │ - Master Vol   │
├──────────────────┴──────────────────┴─────────────────┴────────────────┤
│  ARPEGGIATOR CLOCK (BPM, División, Modo UP/DOWN/RANDOM)                │
├────────────────────────────────────────────────────────────────────────┤
│  TECLADO TÁCTIL MULTITOUCH & SOPORTE WEB MIDI (VCA Gate Estricto)      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                  POST /api/generate-sound-preset
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS SERVER BACKEND                           │
│  - Google GenAI SDK (@google/genai)                                    │
│  - Model: gemini-3.8-flash                                             │
│  - Strict JSON Response Schema (OSC, Filter, ADSR, FM, FX, Visuals)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Esquema de Datos Extendido
```typescript
interface ResonatorPresetJson {
  name: string;
  author: string;
  date: string;
  tags?: string[];
  osc: {
    wave: 'sine' | 'tri' | 'saw' | 'square';
    detune: number;
    octave: number;
    subLevel: number;
    noiseLevel: number;
    lfoRate: number;
    lfoDepth: number;
    // Nuevas capacidades diferenciadas:
    fmDepth: number;    // 0.0 a 1.0 (profundidad de modulación de frecuencia)
    fmRatio: number;    // 0.5 a 8.0 (multiplicador armónico del modulador)
    ringModMix: number; // 0.0 a 1.0 (mezcla en anillo para timbres metálicos)
  };
  filter: {
    cutoffHz: number;
    resonance: number;
    envMod: number;
    adsr: {
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    };
  };
  output: {
    time: number;
    feedback: number;
    drive: number;
    volume: number;
  };
  coreVisual: {
    plasmaColor: string;
    thermalGlow: string | number;
  };
  cables?: Array<{ fromId: string; toId: string }>;
}
```

### Mapeo de Componentes e Interacciones
1. **`server.ts`**: Servidor Express con middleware Vite en dev, implementando endpoint seguro `/api/generate-sound-preset` que ejecuta Gemini 3.8 Flash con el prompt del sistema del diseñador de sonido.
2. **`NeuralBridge.tsx`**: Componente de hardware interactivo montado en el chasis con campo de entrada, selector de etiquetas sugeridas, indicador de progreso cuántico, y botón de aplicación inmediata.
3. **`PresetLibraryModal.tsx`**: Drawer / modal de biblioteca con búsqueda por texto, chips de filtros, lista de presets con opciones de borrado, carga y descarga.
4. **`AudioEngine.ts`**: Actualización de la voz de sintetizador (`SynthVoice`) para incluir el oscilador modulador FM y el nodo de Ring Modulation en la cadena de audio antes del filtro VCF y la compuerta VCA.
5. **`PlasmaCore.tsx`**: Interpolación cromática fluida según los colores térmicos generados por la IA.
