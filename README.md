# Resonator — Model 01 / Opulence

Prototipo web de sintetizador con Web Audio, React y servidor Express.

## Ejecutar en Windows

Requiere Node.js 22. Usa PowerShell desde esta carpeta.

```powershell
npm ci
npm run dev
```

Abrí http://localhost:3000 y pulsá ENCENDER. Se puede tocar con el teclado de computadora, las teclas en pantalla o un controlador MIDI compatible. PÁNICO detiene voces, arpegiador, demos pendientes y vacía el delay.

Gemini es opcional. Para habilitarlo, configurá GEMINI_API_KEY en un archivo .env siguiendo .env.example. Sin clave, el servidor ofrece un generador local basado en palabras de la frase. La clave pertenece al servidor.

## Verificaciones

```powershell
npm test
npm run lint
npm run build
```

Los tests del motor usan un contexto de audio de prueba que registra conexiones y tiempos. No renderizan muestras ni sustituyen la escucha en un navegador real.

## Matriz disponible

- LFO a PITCH, CUT y RES.
- NOISE a CUT. La cantidad sigue NOISE.
- SUB a PITCH y RES, independientemente por voz.
- ENV, GATE y RND están pendientes y aparecen deshabilitados.

Los presets anteriores conservan sus datos. Sus conexiones pendientes se ignoran y no se cuentan como rutas activas. SUB a RES actúa sobre el filtro de cada voz.

## Prueba de escucha de la alfa

1. Sostené una nota y subí NOISE desde cero. Comprobá la entrada continua del ruido.
2. Con un delay largo, soltá una nota y escuchá su cola. Luego usá PÁNICO durante una demo y volvé a tocar.
3. Tocá una misma nota desde MIDI y el teclado. Soltá una fuente y comprobá que la otra continúe.
4. Probá el pedal sustain y después su liberación. La nota debe completar su release.
5. Conectá SUB a PITCH y después a RES. Probá acordes y desconectá las rutas.
6. Activá ARP, cambiá el BPM y soltá las teclas. Comprobá que no aparezcan notas nuevas después de detenerlo.

Pendientes de revisión humana: timbre, balance de volumen de RING MIX, clics, sensación de latencia y MIDI con hardware real. La generación con Gemini requiere una clave y una prueba adicional.
