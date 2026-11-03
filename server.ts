import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize Google Gen AI
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI();
  } catch (err) {
    console.warn('GoogleGenAI initialization warning:', err);
  }
}

/**
 * Intelligent procedural sound generator fallback
 * Used when GEMINI_API_KEY is not configured or in case of transient API error.
 */
function generateProceduralFallbackPreset(prompt: string) {
  const p = prompt.toLowerCase();

  let wave: 'sine' | 'tri' | 'saw' | 'square' = 'saw';
  let cutoff = 2400;
  let resonance = 4.5;
  let attack = 0.05;
  let decay = 0.4;
  let sustain = 0.6;
  let release = 0.8;
  let delayTime = 0.32;
  let feedback = 0.45;
  let drive = 0.35;
  let fmDepth = 0.0;
  let fmRatio = 2.0;
  let ringModMix = 0.0;
  let plasmaColor = '#ffb545';
  let thermalGlow = 0.85;
  let subLevel = 0.4;
  let noiseLevel = 0.03;
  let octave = 0;
  const tags: string[] = ['Neuronal'];

  if (p.includes('808') || p.includes('bass') || p.includes('bajo') || p.includes('sub') || p.includes('traicion')) {
    wave = 'tri';
    octave = -1;
    subLevel = 0.9;
    cutoff = 550;
    resonance = 6.0;
    attack = 0.01;
    decay = 0.6;
    sustain = 0.2;
    release = 0.4;
    drive = 0.65;
    delayTime = 0.15;
    feedback = 0.2;
    plasmaColor = '#ff4d26';
    thermalGlow = 0.95;
    tags.push('Bajos');
  } else if (p.includes('catedral') || p.includes('pad') || p.includes('ambiente') || p.includes('colchon') || p.includes('espacio') || p.includes('sumergida')) {
    wave = 'saw';
    octave = 0;
    subLevel = 0.3;
    cutoff = 1800;
    resonance = 3.2;
    attack = 0.8;
    decay = 1.6;
    sustain = 0.85;
    release = 2.4;
    delayTime = 0.52;
    feedback = 0.72;
    drive = 0.15;
    fmDepth = 0.12;
    fmRatio = 1.5;
    plasmaColor = '#59cbd0';
    thermalGlow = 0.75;
    tags.push('Atmósferas');
  } else if (p.includes('metal') || p.includes('campana') || p.includes('cuantica') || p.includes('titanio') || p.includes('anillo')) {
    wave = 'square';
    octave = 1;
    subLevel = 0.2;
    cutoff = 4200;
    resonance = 9.5;
    attack = 0.008;
    decay = 0.7;
    sustain = 0.15;
    release = 1.2;
    fmDepth = 0.55;
    fmRatio = 3.14;
    ringModMix = 0.6;
    delayTime = 0.25;
    feedback = 0.5;
    plasmaColor = '#e0f7fa';
    thermalGlow = 0.95;
    tags.push('Metálico');
  } else if (p.includes('acido') || p.includes('acid') || p.includes('vortice') || p.includes('distorsion')) {
    wave = 'saw';
    octave = 0;
    subLevel = 0.5;
    cutoff = 3100;
    resonance = 11.0;
    attack = 0.02;
    decay = 0.35;
    sustain = 0.3;
    release = 0.25;
    drive = 0.8;
    fmDepth = 0.3;
    fmRatio = 4.0;
    delayTime = 0.22;
    feedback = 0.45;
    plasmaColor = '#ff9800';
    thermalGlow = 0.9;
    tags.push('Acídico');
  } else {
    // Evocative fantasy sound based on character sum
    const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const waves: Array<'sine' | 'tri' | 'saw' | 'square'> = ['sine', 'tri', 'saw', 'square'];
    wave = waves[hash % waves.length];
    cutoff = 600 + (hash % 5000);
    resonance = 2.0 + ((hash % 100) / 10);
    fmDepth = ((hash % 70) / 100);
    fmRatio = 1.0 + ((hash % 60) / 10);
    ringModMix = ((hash % 50) / 100);
    drive = ((hash % 60) / 100);
    const colors = ['#59cbd0', '#ffb545', '#ff4d26', '#b388ff', '#00e676', '#ffd700'];
    plasmaColor = colors[hash % colors.length];
    thermalGlow = 0.7 + ((hash % 30) / 100);
    tags.push('Experimental');
  }

  // Capitalize name
  const cleanName = prompt.trim().split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .slice(0, 4)
    .join(' ') || 'Resonancia Cuántica';

  return {
    name: cleanName,
    author: 'TOMAS.WAV // AI Neural Bridge',
    date: new Date().toISOString(),
    isUserPreset: true,
    tags,
    osc: {
      wave,
      detune: Math.round((Math.random() * 20) - 10),
      octave,
      subLevel,
      noiseLevel,
      lfoRate: 1.5 + Math.random() * 4,
      lfoDepth: 0.2 + Math.random() * 0.3,
      fmDepth,
      fmRatio,
      ringModMix,
    },
    filter: {
      cutoffHz: Math.round(cutoff),
      resonance: parseFloat(resonance.toFixed(1)),
      envMod: 0.5,
      adsr: {
        attack: parseFloat(attack.toFixed(3)),
        decay: parseFloat(decay.toFixed(2)),
        sustain: parseFloat(sustain.toFixed(2)),
        release: parseFloat(release.toFixed(2)),
      },
    },
    output: {
      time: parseFloat(delayTime.toFixed(2)),
      feedback: parseFloat(feedback.toFixed(2)),
      drive: parseFloat(drive.toFixed(2)),
      volume: 0.75,
    },
    coreVisual: {
      plasmaColor,
      thermalGlow: typeof thermalGlow === 'number' ? thermalGlow : 0.85,
    },
    visuals: {
      plasmaColor,
      thermalGlow: typeof thermalGlow === 'number' ? thermalGlow : 0.85,
    },
  };
}

/**
 * POST /api/generate-sound-preset
 * Translates natural language sound descriptions into strict Resonator presets using Gemini 3.8 Flash
 */
app.post('/api/generate-sound-preset', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Debes proporcionar un texto o concepto sonoro.' });
      return;
    }

    const trimmedPrompt = prompt.trim();

    // If Gemini client is available, use gemini-3.8-flash with structured schema
    if (aiClient) {
      try {
        const systemInstruction = `Eres el Sound Designer Senior y Bibliotecario de Patches de "Resonator" (Model 01 // Opulence), un sintetizador modular de alta gama con estética "Obsidian Futurism". Tu única función es interpretar descripciones de texto en lenguaje natural (estados de ánimo, conceptos abstractos, metáforas visuales, géneros musicales o texturas) y traducirlas instantáneamente en un objeto JSON de configuración de síntesis válido.

REGLAS DE TRADUCCIÓN SONORA:
- Oscilador (osc.wave): Usa 'sine' o 'triangle' para sonidos suaves, cálidos o puristas; 'saw' para texturas densas, colchones y leads agresivos; 'square' para bajos con cuerpo y tonos analógicos pesados.
- Modulación acústica única: Configura fmDepth (0..1), fmRatio (0.5..8) y ringModMix (0..1) para añadir armónicos metálicos, timbres de campana, rugidos alienígenas o matices robóticos cuando el prompt lo amerite.
- Filtro (filter.cutoffHz & resonance): Descripciones oscuras/frías requieren cutoffs bajos (200Hz - 1200Hz). Descripciones brillantes o abiertas requieren cutoffs altos (3000Hz - 10000Hz). La resonancia (Q) alta da carácter ácido o metálico.
- Envolvente (adsr): Pads ambientales o colchones llevan Attack y Release largos (attack: 0.5-2.0, release: 1.0-4.0). Plucks o bajos percusivos llevan Attack rápido y Release corto (attack: 0.008-0.03, release: 0.1-0.4).
- Efectos (output): Time y Feedback altos generan colas de eco/reverb espaciales. Drive elevado añade saturación industrial de válvulas.
- Visuales del Núcleo (coreVisual): Asigna colores hexadecimales de plasma coherentes con la emoción (cian/azul frío para paisajes gélidos o solitarios; ámbar/oro/rojo para calidez, fuego, atardeceres o distorsión pesada) y thermalGlow (0.2 a 1.0).`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Crea un preset único para el siguiente concepto sonoro: "${trimmedPrompt}"`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Nombre evocativo y elegante del preset' },
                author: { type: Type.STRING, description: 'TOMAS.WAV // AI Neural Bridge' },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Etiquetas de género o estilo, ej: Bajos, Atmósferas, Metálico, Sci-Fi',
                },
                osc: {
                  type: Type.OBJECT,
                  properties: {
                    wave: { type: Type.STRING, enum: ['sine', 'tri', 'saw', 'square'] },
                    detune: { type: Type.NUMBER, description: 'Cents de desafinación (-30 a 30)' },
                    octave: { type: Type.NUMBER, description: 'Octava (-2 a 2)' },
                    subLevel: { type: Type.NUMBER, description: 'Nivel del sub-oscilador (0 a 1)' },
                    noiseLevel: { type: Type.NUMBER, description: 'Nivel de ruido cálido (0 a 0.5)' },
                    lfoRate: { type: Type.NUMBER, description: 'Frecuencia LFO (0.1 a 15 Hz)' },
                    lfoDepth: { type: Type.NUMBER, description: 'Profundidad LFO (0 a 1)' },
                    fmDepth: { type: Type.NUMBER, description: 'Profundidad modulación cruzada FM (0 a 1)' },
                    fmRatio: { type: Type.NUMBER, description: 'Ratio armónico del modulador FM (0.5 a 8)' },
                    ringModMix: { type: Type.NUMBER, description: 'Mezcla de modulador en anillo (0 a 1)' },
                  },
                  required: ['wave', 'detune', 'octave', 'subLevel', 'noiseLevel', 'lfoRate', 'lfoDepth'],
                },
                filter: {
                  type: Type.OBJECT,
                  properties: {
                    cutoffHz: { type: Type.NUMBER, description: 'Corte en Hz (50 a 16000)' },
                    resonance: { type: Type.NUMBER, description: 'Resonancia Q (0.5 a 15)' },
                    envMod: { type: Type.NUMBER, description: 'Modulación de envolvente (-1 a 1)' },
                    adsr: {
                      type: Type.OBJECT,
                      properties: {
                        attack: { type: Type.NUMBER, description: 'Ataque en segundos' },
                        decay: { type: Type.NUMBER, description: 'Decay en segundos' },
                        sustain: { type: Type.NUMBER, description: 'Nivel sustain (0 a 1)' },
                        release: { type: Type.NUMBER, description: 'Release en segundos' },
                      },
                      required: ['attack', 'decay', 'sustain', 'release'],
                    },
                  },
                  required: ['cutoffHz', 'resonance', 'envMod', 'adsr'],
                },
                output: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.NUMBER, description: 'Tiempo de delay en segundos (0.05 a 1.0)' },
                    feedback: { type: Type.NUMBER, description: 'Feedback (0 a 0.85)' },
                    drive: { type: Type.NUMBER, description: 'Saturación analógica (0 a 1)' },
                    volume: { type: Type.NUMBER, description: 'Volumen maestro (0 a 1)' },
                  },
                  required: ['time', 'feedback', 'drive', 'volume'],
                },
                coreVisual: {
                  type: Type.OBJECT,
                  properties: {
                    plasmaColor: { type: Type.STRING, description: 'Color hexadecimal de plasma e.g. #59CBD0' },
                    thermalGlow: { type: Type.NUMBER, description: 'Intensidad de brillo 0.1 a 1.0' },
                  },
                  required: ['plasmaColor', 'thermalGlow'],
                },
              },
              required: ['name', 'author', 'osc', 'filter', 'output', 'coreVisual'],
            },
          },
        });

        const rawText = response.text?.trim() || '{}';
        const parsedJson = JSON.parse(rawText);

        // Sanitize and ensure defaults
        if (!parsedJson.visuals) {
          parsedJson.visuals = parsedJson.coreVisual;
        }
        parsedJson.date = new Date().toISOString();
        parsedJson.isUserPreset = true;

        res.json({
          success: true,
          source: 'gemini-3.8-flash',
          preset: parsedJson,
        });
        return;
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, activating procedural synthesis engine:', geminiError?.message || geminiError);
      }
    }

    // Procedural Fallback Engine
    const fallbackPreset = generateProceduralFallbackPreset(trimmedPrompt);
    res.json({
      success: true,
      source: 'procedural-synthesizer',
      preset: fallbackPreset,
    });
  } catch (err: any) {
    console.error('Error generating sound preset:', err);
    res.status(500).json({ error: 'Error procesando síntesis sonora: ' + (err.message || 'Error desconocido') });
  }
});

// Setup Vite in Dev or Static files in Prod
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Resonator Synthesizer server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
