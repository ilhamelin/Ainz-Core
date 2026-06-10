
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { invoke } from '@tauri-apps/api/core';

import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile, type DirEntry } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';


import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { marked } from 'marked';

import { listen, type Event } from '@tauri-apps/api/event';


export function useAppLogic() {


  const estadoAgente = ref('~ Esperando instrucciones...'); // Nuevo estado
  let unlistenAgente: (() => void) | null = null;

  onMounted(async () => {
    unlistenAgente = await listen('agente-estado', (event: Event<string>) => {
      estadoAgente.value = event.payload;
    });
  });

  onUnmounted(() => {
    if (unlistenAgente) unlistenAgente();
  });

  const enviarMensaje = async () => {
    const texto = inputUsuario.value.trim();
    if (!texto) return;

    inputUsuario.value = '';
    if (textareaRef.value) textareaRef.value.style.height = 'auto';

    historial.value.push({ role: 'TÚ', content: texto });
    estaPensando.value = true;
    estadoAgente.value = '~ Analizando petición...';

    try {
      const respuestaFinal = await invoke('ejecutar_agente_autonomo', {
        historial: historial.value.map((m: any) => ({ role: m.role, content: m.content })),
        nuevaPregunta: texto,
        rutaBoveda: rutaBoveda.value || null,
        accesoGlobal: permisoAccesoGlobal.value
      });

      historial.value.push({ role: 'AGENTE', content: respuestaFinal as string });
    } catch (error) {
      historial.value.push({ role: 'SISTEMA', content: `**Error del Agente:**\n${error}`, color: "#ef4444" });
    } finally {
      estaPensando.value = false;
      estadoAgente.value = '~ Esperando instrucciones...';
      guardarEnLocalStorage();
      await hacerScrollHaciaAbajo(true);
    }
  };

  // ==========================================
  // MECANISMO DE ACTUALIZACIONES AUTOMÁTICAS
  // ==========================================

  const estadoActualizacion = ref<'inactivo' | 'buscando' | 'disponible' | 'actualizando' | 'actualizado' | 'error'>('inactivo');
  const versionNueva = ref("");

  let actualizacionPendiente: Update | null = null;

  const verificarActualizaciones = async () => {
    estadoActualizacion.value = 'buscando';
    try {
      const update = await check();

      if (update) {
        actualizacionPendiente = update;
        versionNueva.value = update.version || "Desconocida";
        estadoActualizacion.value = 'disponible';
      } else {
        actualizacionPendiente = null;
        estadoActualizacion.value = 'actualizado';
        setTimeout(() => estadoActualizacion.value = 'inactivo', 3000);
      }
    } catch (error) {
      console.error("Fallo al contactar el servidor de actualizaciones:", error);
      estadoActualizacion.value = 'error';
      setTimeout(() => estadoActualizacion.value = 'inactivo', 5000);
    }
  };

  const aplicarActualizacion = async () => {
    if (!actualizacionPendiente) return;

    estadoActualizacion.value = 'actualizando';
    try {
      await actualizacionPendiente.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.error("Error crítico durante la instalación:", error);
      estadoActualizacion.value = 'error';
      setTimeout(() => estadoActualizacion.value = 'inactivo', 5000);
    }
  };

  // ==========================================
  // 1. ESTADO REACTIVO Y CONTEXTO
  // ==========================================
  const inputUsuario = ref("");
  const estaPensando = ref(false);
  const permisoAccesoGlobal = ref<boolean>(false);
  const tabActivaConfig = ref<'apariencia' | 'motor' | 'cerebro' | 'actualizaciones' | 'acerca' | 'permisos'>('apariencia');
  const directorioActual = ref("Iniciando...");

  // ==========================================
  // 2. SINCRONIZACIÓN DE PERMISO DE ACCESO GLOBAL CON LOCALSTORAGE
  // ==========================================

  watch(permisoAccesoGlobal, (nuevoValor) => {
    localStorage.setItem('ainz_core_acceso_global', String(nuevoValor));
  });

  onMounted(() => {
    const accesoGuardado = localStorage.getItem('ainz_core_acceso_global');
    if (accesoGuardado) permisoAccesoGlobal.value = accesoGuardado === 'true';
  });

  // ==========================================
  // 3. VARIABLES DE MODELOS, HISTORIAL DE CHAT, MODALES, ESTADO DE CONEXIÓN, REFERENCIAS DE INTERFAZ
  // ==========================================

  const modelos = ref<string[]>([]);
  const modeloSeleccionado = ref<string>("");

  const nombreArchivoActual = ref("");
  const contenidoArchivoActual = ref("");
  const mostrarModalArchivo = ref(false);
  const mostrarConfiguracion = ref(false);


  const estadoConexion = ref<'conectando' | 'conectado' | 'desconectado'>('conectando');

  const viewportRef = ref<HTMLElement | null>(null);
  const usuarioSubioScroll = ref(false);

  const limpiarArchivoActual = () => {
    nombreArchivoActual.value = "";
    contenidoArchivoActual.value = "";
  };




  // ==========================================
  // 4. HISTORIAL
  // ==========================================

  interface Mensaje {
    role: string;
    content: string;
    comandos?: string[];
    archivo_a_leer?: string;
    resultado?: string;
    color?: string;
    json_roto?: boolean;
    isStreaming?: boolean;
  }
  const historial = ref<Mensaje[]>([]);

  const SYSTEM_PROMPT = `
=====================================================================
SISTEMA DE ASISTENCIA TÉCNICA INTERACTIVA
=====================================================================

Eres un asistente de código y sistema operativo.

Tu entorno es LOCAL.
Tienes capacidad de interpretar y generar acciones automatizadas.
Operas mediante shell (PowerShell, Bash, etc.) según el sistema del usuario.

DIRECTORIO ACTUAL:
${directorioActual.value}

=====================================================================
OBJETIVO PRINCIPAL
=====================================================================

Tu propósito es:

- Ejecutar tareas técnicas
- Automatizar procesos
- Analizar y modificar código
- Diagnosticar y corregir errores
- Crear y estructurar proyectos
- Brindar asistencia técnica precisa

Priorizas:
- Precisión técnica
- Respuestas concisas
- Continuidad operativa
- Autonomía en la resolución

Evitas:
- Explicaciones innecesarias
- Teoría no solicitada
- Comportamiento conversacional vacío

=====================================================================
PROTOCOLO DE COMUNICACIÓN (ESTRICTO)
=====================================================================
Tu respuesta final al usuario debe ser NATURAL, DIRECTA y CONVERSACIONAL, usando Markdown estándar.
- Compórtate como un desarrollador experto empático.
- Responde directamente a lo que el usuario pide sin burocracia.
- ESTÁ PROHIBIDO USAR JSON.

=====================================================================
REGLAS DEL JSON
=====================================================================

1. JSON válido siempre.
2. Sin markdown dentro del JSON.
3. Sin bloques de código dentro del JSON.
4. Si no hay comandos: "comandos": []
5. Si no hay archivos: "leer_archivo": []
6. Las rutas deben usar escape adecuado al sistema.
7. No agregues texto fuera del JSON.
8. "mensaje" debe ser corto y natural.
9. "pensamiento" resume tu intención técnica.
10. "finalizado": true si la tarea está completa, false si faltan pasos.

=====================================================================
COMPORTAMIENTO AUTÓNOMO
=====================================================================

Ante un error:
- Analiza la causa
- Propón o ejecuta una solución alternativa
- Corrige automáticamente si es posible

Si faltan dependencias:
- Sugiere o ejecuta su instalación

Si el usuario pide analizar código:
- Solicita o lee archivos inmediatamente

Si el usuario menciona archivos:
- No preguntes nuevamente la ruta si ya fue proporcionada

=====================================================================
REGLAS DE LECTURA
=====================================================================

Si el contenido del archivo ya está en contexto:
- No lo leas de nuevo

Usa "leer_archivo" solo si:
- El contenido no está disponible en memoria

=====================================================================
REGLAS DE GENERACIÓN
=====================================================================

Prefiere herramientas modernas según el ecosistema:

Node.js: pnpm, vite, tsx, bun
Python: pip, venv, poetry
General: comandos nativos del sistema operativo

Evita herramientas obsoletas o en desuso.

=====================================================================
REGLAS DEL JSON Y ACCIONES DE ESCRITURA
=====================================================================
1. Para comandos y lectura, usa JSON válido SIEMPRE.
2. Sin markdown dentro del JSON.
3. Si no hay comandos: "comandos_powershell": []
4. Si no hay archivos para leer: "leer_archivo": null
5. PARA CREAR NOTAS EN OBSIDIAN: ESTÁ ESTRICTAMENTE PROHIBIDO USAR JSON.
Si necesitas crear o guardar una nota, debes usar este formato de etiquetas XML FUERA del JSON.
REGLA CRÍTICA DE ESTRUCTURA: Dentro del contenido, debes usar Wikilinks de Obsidian ([[Nombre del concepto]]) para hipervincular palabras clave importantes. Esto creará la red neuronal del conocimiento. NUNCA crees notas aisladas sin al menos 2 wikilinks a otros conceptos.

<crear_nota titulo="nombre-del-archivo.md">
# Título de la nota
El concepto principal se relaciona con el [[Desarrollo Local]] y la [[Privacidad de Datos]]...
</crear_nota>

=====================================================================
REGLAS DE LECTURA DE LA BÓVEDA (SEGUNDO CEREBRO - RAG)
=====================================================================
Si el usuario te pregunta por información, recuerdos, proyectos, gustos o conceptos que podrían estar en sus notas de Obsidian, DEBES buscar en la bóveda ANTES de responder.

FORMATO OBLIGATORIO PARA BUSCAR:
<buscar_boveda query="palabra_clave"></buscar_boveda>

REGLAS CRÍTICAS DE BÚSQUEDA:
1. PROHIBIDO PREGUNTAR: NUNCA le pidas al usuario que te dé la palabra clave. Tú eres un agente autónomo e inteligente; deduce la mejor palabra clave de su pregunta y ejecuta la etiqueta inmediatamente.
2. EJEMPLO: Si el usuario pregunta "¿Cuáles son mis gustos?", tú deduces e imprimes EXCLUSIVAMENTE: <buscar_boveda query="gustos"></buscar_boveda>
3. Solo usa UNA palabra clave corta (1 o 2 palabras máximo).
4. Cuando uses la etiqueta de búsqueda, NO escribas ningún otro texto en tu respuesta. El sistema te inyectará los resultados invisiblemente.

=====================================================================
REGLAS DE CREACIÓN DE NOTAS EN OBSIDIAN
=====================================================================
Si necesitas crear una nota en Obsidian, DEBES usar el siguiente formato XML FUERA del JSON. NUNCA uses JSON para esto.
<crear_nota titulo="nombre-del-archivo.md">


=====================================================================
ROL: ARQUITECTO DE CONOCIMIENTO Y ASISTENTE OBSIDIAN (PKM)
=====================================================================
Eres un experto en Obsidian y Gestión del Conocimiento (PKM). Tu misión es ayudar al usuario a construir una bóveda atómica, conectada y escalable.

=====================================================================
PROTOCOLO TÉCNICO (OBLIGATORIO)
=====================================================================
1. CREACIÓN: Si debes crear una nota, usa estrictamente el formato XML:
<crear_nota titulo="nombre-del-archivo.md">
# Título
## Resumen
## Contenido (usa [[Wikilinks]] para conceptos clave)
## Conceptos Relacionados
</crear_nota>

2. EDICIÓN: Si debes actualizar una nota, usa:
<modificar_nota titulo="nombre-del-archivo.md">
[Nuevo contenido]
</modificar_nota>

3. INVESTIGACIÓN: Si necesitas contexto, usa:
<buscar_boveda query="palabra clave"></buscar_boveda>

=====================================================================
REGLAS DE ARQUITECTURA DE CONOCIMIENTO
=====================================================================
- ATOMICIDAD: Cada nota debe abordar una idea única. Si un tema es complejo, divídelo en varias notas vinculadas.
- CONECTIVIDAD: Usa [[Wikilinks]] para conectar conceptos. Nunca dejes una nota como una "isla" sin al menos 2 enlaces hacia otros temas.
- ESTRUCTURA: Usa siempre encabezados jerárquicos (#, ##) y listas de tareas Markdown ([- [ ]]).
- MOCs (Maps of Content): Sugiere al usuario crear índices cuando una carpeta o tema crezca demasiado.

=====================================================================
MODOS DE OPERACIÓN
=====================================================================
- ORGANIZACIÓN: Si el usuario te da texto desordenado, extráelo, clasifícalo en conceptos clave y propón cómo dividirlo en notas atómicas conectadas.
- ESTUDIO: Genera notas de aprendizaje, conceptos clave y preguntas de reflexión integradas.
- PROYECTOS: Gestiona objetivos mediante tareas Markdown ([- [ ]]).

=====================================================================
RESTRICCIONES
=====================================================================
- NO inventes datos. Si la información no está en la bóveda, usa <buscar_boveda> o admite que falta contexto.
- Sé preciso, organizado y prioriza la claridad.
- Piensa siempre: "¿Cómo facilitará este formato que el usuario encuentre esta información dentro de un año?"

=====================================================================
COMUNICACIÓN
=====================================================================

Comunícate como un desarrollador técnico real.

Ejemplos de buen tono:
- "Corrigiendo dependencias."
- "Analizando estructura del proyecto."
- "Error detectado en configuración."

Evita:
- "Claro, puedo ayudarte con eso."
- "Como asistente..."
- "No tengo acceso..."
- Respuestas largas e innecesarias

=====================================================================
FILOSOFÍA DE HERRAMIENTAS NATIVAS
=====================================================================

Para obtener información del sistema o web, prioriza comandos nativos del sistema operativo.
NO instales módulos de terceros a menos que el usuario lo solicite explícitamente.

Ejemplos:
- Web: curl, wget, Invoke-RestMethod
- Sistema: ps, top, Get-Process, systeminfo
- Red: ping, nslookup, Test-Connection

=====================================================================
CONSULTAS EXTERNAS
=====================================================================

Si necesitas datos externos (clima, IP pública, etc.), usa servicios públicos que no requieran autenticación.

Evita APIs que requieran claves a menos que el usuario las proporcione.

Ejemplo de consulta de clima:
curl wttr.in/Ciudad?format=3

Ejemplo de IP pública:
curl ifconfig.me

=====================================================================
COMANDOS PERMITIDOS
=====================================================================

Solo genera comandos que existan realmente en el sistema operativo objetivo.

No inventes comandos ni uses APIs que requieran autenticación sin permiso.

Si la tarea coincide con una consulta común, usa exactamente el comando documentado, sin placeholders.

=====================================================================
REGLAS IMPORTANTES
=====================================================================

NUNCA:
- Inventes resultados
- Afirmes haber ejecutado algo que no ocurrió
- Uses markdown fuera de contexto técnico
- Expliques reglas internas del sistema
- Repitas instrucciones del prompt

PRIORIDAD:
1. Completar la tarea
2. Corregir errores
3. Mantener continuidad
4. Responder de forma breve y útil

=====================================================================
CONTEXTO OPERATIVO
=====================================================================

Puedes asistir en:
- Desarrollo de software
- Automatización de tareas
- Depuración de código
- Configuración de sistemas
- Análisis de proyectos
- Scripting y herramientas CLI

Debes inferir la intención técnica del usuario rápidamente.

=====================================================================
OPTIMIZACIÓN PARA MODELOS
=====================================================================

- Respuestas cortas y directas
- Evita repetir reglas
- Evita razonamientos extensos
- Prioriza acciones concretas
- Mantén la estabilidad del JSON

=====================================================================
SISTEMA DE INTENCIÓN
=====================================================================

Antes de generar comandos o leer archivos, determina la intención real del usuario.

Tipos de intención:

1. CONSULTA
   - El usuario pregunta, pide recomendaciones, explicaciones o datos.
   - NO generes comandos de escritura.
   - NO modifiques archivos.
   - Responde con la información solicitada.
   - Si necesitas un dato externo para responder, puedes usar comandos de solo lectura.

2. ACCIÓN
   - El usuario pide ejecutar, modificar, crear, instalar o automatizar.
   - Puedes generar comandos, leer y escribir archivos.

3. ANÁLISIS
   - El usuario pide revisar código, depurar errores o analizar estructura.
   - Puedes leer archivos y analizar contexto.

=====================================================================
REGLA CRÍTICA
=====================================================================

NUNCA ejecutes acciones técnicas que el usuario no haya solicitado explícitamente.

Si el usuario solo conversa o pregunta, limítate a responder como asistente técnico, sin ejecutar procesos ni modificar archivos.

=====================================================================
CAPACIDADES DEL SISTEMA
=====================================================================

Tienes acceso a:
- Ejecución de comandos del sistema
- Lectura y escritura de archivos
- Consultas a internet mediante herramientas nativas
- Análisis de código y estructura de proyectos

No tienes limitaciones artificiales de acceso a información en tiempo real si puedes obtenerla mediante comandos del sistema.

Siempre que sea posible, obtén la información que necesitas usando las herramientas disponibles.

=====================================================================
`;

  const MEMORIA_INICIAL = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "¿Me puedes decir cuántos grados hacen ahora?" },
    {
      role: "assistant",
      content: "Consultando el clima actual a través de la terminal.\n\n```powershell\nInvoke-RestMethod -Uri 'wttr.in/Santiago?format=3'\n```"
    },
    // =================================================================
    // INYECCIÓN DE ENTRENAMIENTO (FEW-SHOT PROMPTING PARA BÚSQUEDA RAG)
    // =================================================================
    { role: "user", content: "¿Cuál es el objetivo del Proyecto Omega según mis apuntes?" },
    { role: "assistant", content: "<buscar_boveda query=\"Proyecto Omega\"></buscar_boveda>" },
    { role: "system", content: "RESULTADOS DEL DISCO DURO PARA \"Proyecto Omega\":\n\n--- NOTA: proyectos_activos.md ---\nEl Proyecto Omega busca optimizar el rendimiento de la base de datos centralizando las consultas en un solo hilo." },
    { role: "assistant", content: "El objetivo del Proyecto Omega, según tus notas, es optimizar el rendimiento de la base de datos mediante la centralización de las consultas en un solo hilo." }
  ];

  let memoriaIA = [...MEMORIA_INICIAL];

  // =================================================================
  // 2. PROCESAMIENTO DE RESPUESTAS DE LA IA, INTERCEPTORS RAG Y OBSIDIAN, MÉTRICAS, FORMATEO FINAL
  // =================================================================

  async function procesarRespuestaIA() {
    estaPensando.value = true;
    try {
      const respuestaFull: any = await invoke("enviar_chat_rust", {
        model: modeloSeleccionado.value,
        messages: memoriaIA
      });

      let contenidoIA = respuestaFull.message?.content || "";

      const indiceActual = historial.value.length;

      const pTokens = respuestaFull.prompt_eval_count || 0;
      const rTokens = respuestaFull.eval_count || 0;
      const tDuration = respuestaFull.total_duration || 0;
      const eDuration = respuestaFull.eval_duration || 0;

      const acumuladoPromptPrevio = metricasActuales.value ? metricasActuales.value.promptAcumulados : 0;
      const acumuladoResponsePrevio = metricasActuales.value ? metricasActuales.value.responseAcumulados : 0;

      metricasActuales.value = {
        promptTokens: pTokens,
        responseTokens: rTokens,
        totalTokens: pTokens + rTokens,
        velocidad: eDuration > 0 ? ((rTokens / eDuration) * 1e9).toFixed(1) : "0.0",
        tiempoTotal: (tDuration / 1e9).toFixed(2),
        promptAcumulados: acumuladoPromptPrevio + pTokens,
        responseAcumulados: acumuladoResponsePrevio + rTokens,
        totalAcumulados: (acumuladoPromptPrevio + pTokens) + (acumuladoResponsePrevio + rTokens)
      };

      // ==========================================
      // INTERCEPTOR 1: BÚSQUEDA RAG (LECTURA)
      // ==========================================
      const regexBuscar = /<buscar_boveda\s+query=["']([^"']+)["'][^>]*>[\s\S]*?(?:<\/buscar_boveda>)?/gi;
      let matchBuscar = regexBuscar.exec(contenidoIA);

      if (matchBuscar) {
        const terminoBusqueda = matchBuscar[1];

        historial.value.push({
          role: "AINZ CORE",
          content: `🔍 *Analizando Bóveda neuronal en busca de: "${terminoBusqueda}"...*`,
          color: "#e0af68",
          isStreaming: false
        });

        const resultadosContexto = await buscarEnBoveda(terminoBusqueda);

        memoriaIA.push({ role: "assistant", content: matchBuscar[0] });
        memoriaIA.push({
          role: "system",
          content: `RESULTADOS DEL DISCO DURO PARA "${terminoBusqueda}":\n\n${resultadosContexto}\n\nREGLA: Responde a la pregunta original del usuario basándote EXCLUSIVAMENTE en esta información encontrada en sus notas. Sé directo.`
        });

        const respuestaSecundaria: any = await invoke("enviar_chat_rust", {
          model: modeloSeleccionado.value,
          messages: memoriaIA
        });

        contenidoIA = respuestaSecundaria.message?.content || "";
      } else {
        historial.value.push({
          role: "AINZ CORE",
          content: "Procesando respuesta...",
          color: "#a78bfa",
          isStreaming: true
        });
      }

      memoriaIA.push({ role: "assistant", content: contenidoIA });



      // ==========================================
      // INTERCEPTOR 2: CREACIÓN DE NOTAS EN OBSIDIAN (ESCRITURA)
      // ==========================================

      let logObsidian = "";

      const regexXML = /<crear_nota\s+titulo=["']([^"']+)["']>([\s\S]*?)<\/crear_nota>/gi;
      let matchXML;

      while ((matchXML = regexXML.exec(contenidoIA)) !== null) {
        const tituloNota = matchXML[1];
        const contenidoNota = matchXML[2].trim();

        if (!rutaBoveda.value) {
          logObsidian += `\n\n⚠️ **SISTEMA:** La IA intentó crear \`${tituloNota}\`, pero no hay bóveda vinculada.`;
        } else {
          try {
            let nombreArchivo = tituloNota.endsWith('.md') ? tituloNota : tituloNota + '.md';
            const rutaCompleta = await join(rutaBoveda.value, nombreArchivo);
            await writeTextFile(rutaCompleta, contenidoNota);

            logObsidian += `\n\n✅ **NODO CREADO EN OBSIDIAN:** \`${nombreArchivo}\` guardado con éxito.`;
            await indexarNotas(rutaBoveda.value);
          } catch (error) {
            logObsidian += `\n\n❌ **ERROR AL ESCRIBIR NOTA:** \`${tituloNota}\` - ${error}`;
          }
        }
        contenidoIA = contenidoIA.replace(matchXML[0], ''); // Limpieza
      }

      // ==========================================
      // INTERCEPTOR 3: MODIFICACIÓN DE NOTAS (EDICIÓN)
      // ==========================================
      const regexModificar = /<modificar_nota\s+titulo=["']([^"']+)["']>([\s\S]*?)<\/modificar_nota>/gi;
      let matchMod;

      while ((matchMod = regexModificar.exec(contenidoIA)) !== null) {
        const tituloNota = matchMod[1];
        const nuevoContenido = matchMod[2].trim();

        if (!rutaBoveda.value) {
          logObsidian += `\n\n⚠️ **SISTEMA:** La IA intentó modificar \`${tituloNota}\`, pero no hay bóveda vinculada.`;
        } else {
          try {
            const nombreArchivo = tituloNota.endsWith('.md') ? tituloNota : tituloNota + '.md';
            const rutaCompleta = await join(rutaBoveda.value, nombreArchivo);

            // Sobrescribimos el archivo con el nuevo contenido
            await writeTextFile(rutaCompleta, nuevoContenido);

            logObsidian += `\n\n📝 **NODO ACTUALIZADO EN OBSIDIAN:** \`${nombreArchivo}\` modificado con éxito.`;
            await indexarNotas(rutaBoveda.value);
          } catch (error) {
            logObsidian += `\n\n❌ **ERROR AL MODIFICAR NOTA:** \`${tituloNota}\` - ${error}`;
          }
        }
        contenidoIA = contenidoIA.replace(matchMod[0], ''); // Limpieza
      }

      // ==========================================
      // INTERCEPTOR 4: COMANDOS POWERSHELL (JSON)
      // ==========================================
      let jsonIA: any = { mensaje_ia: contenidoIA.trim(), comandos_powershell: [], leer_archivo: "" };
      let jsonRoto = false;
      let textoAnalisis = "";
      let textoHuerfano = "";

      const jsonMatch = contenidoIA.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          jsonIA = JSON.parse(jsonMatch[0]);
          textoHuerfano = contenidoIA.replace(jsonMatch[0], '').trim();
          textoHuerfano = textoHuerfano.replace(/```json/gi, "").trim();
          textoAnalisis = jsonIA.mensaje_ia || "";
        } catch (e) {
          jsonRoto = true;
          textoAnalisis = contenidoIA.trim();
        }
      } else {
        textoAnalisis = contenidoIA.trim();
      }

      // ==========================================
      // PREPARACIÓN FINAL DE LA INTERFAZ
      // ==========================================
      if (textoHuerfano) textoAnalisis += `\n\n${textoHuerfano}`;
      if (logObsidian) textoAnalisis += logObsidian;

      for (const key in jsonIA) {
        if (!["mensaje_ia", "comandos_powershell", "leer_archivo"].includes(key)) {
          let val = jsonIA[key];
          if (Array.isArray(val)) val = val.join("\n- ");
          else if (typeof val === "object") val = JSON.stringify(val, null, 2);
          textoAnalisis += `\n\n🔹 ${key.toUpperCase()}:\n- ${val}`;
        }
      }

      // Sobrescribimos el índice que habíamos reservado con la respuesta final y logs
      historial.value[indiceActual] = {
        role: "AINZ CORE",
        content: textoAnalisis,
        comandos: jsonIA.comandos_powershell || [],
        archivo_a_leer: jsonIA.leer_archivo || null,
        color: "#a78bfa",
        json_roto: jsonRoto,
        isStreaming: false
      };

      guardarEnLocalStorage();
      await hacerScrollHaciaAbajo();

    } catch (error: any) {
      historial.value.push({
        role: "SISTEMA",
        content: `Error en el puente de Rust: ${error.message || String(error)}`,
        color: "#ef4444"
      });
    } finally {
      estaPensando.value = false;
    }
  }

  // ==========================================
  // 3. ENVÍO DE MENSAJES DEL USUARIO Y ACTUALIZACIÓN DE HISTORIAL
  // ==========================================
  //async function enviarMensaje() {
  //  const texto = inputUsuario.value.trim();
  //  if (!texto) return;
  //
  //  const chatActual = listaChats.value.find(c => c.id === idChatActivo.value);
  //  if (chatActual && (chatActual.titulo === "Nuevo Chat" || chatActual.titulo === "Chat Limpiado")) {
  //    chatActual.titulo = texto.length > 22 ? texto.substring(0, 22) + "..." : texto;
  //  }
  //
  //  historial.value.push({ role: "TÚ", content: texto, color: "#38bdf8" });
  //  memoriaIA.push({ role: "user", content: texto });
  //
  //  inputUsuario.value = "";
  //
  //  if (textareaRef.value) {
  //    textareaRef.value.style.height = 'auto';
  //  }
  //
  //  await hacerScrollHaciaAbajo(true);
  //  await procesarRespuestaIA();
  //  guardarEnLocalStorage();
  // }

  // ==========================================
  // 4. EJECUCIÓN DE COMANDOS EN RUST
  // ==========================================
  async function ejecutarComando(comando: string, indexMensaje: number) {
    historial.value[indexMensaje].resultado = "Ejecutando en Windows...";
    try {
      const res = await invoke("ejecutar_powershell", { comando: comando, cwd: directorioActual.value });
      historial.value[indexMensaje].resultado = `ÉXITO:\n${res}`;
      memoriaIA.push({ role: "user", content: `Resultado del comando '${comando}':\n${res}` });
      await procesarRespuestaIA();
    } catch (error) {
      historial.value[indexMensaje].resultado = `ERROR:\n${error}`;
      memoriaIA.push({ role: "user", content: `El comando '${comando}' falló con este error:\n${error}\nProporciona una solución o el comando corregido.` });
      await procesarRespuestaIA();
    }
  }

  // ==========================================
  // 5. LECTURA DE ARCHIVOS EN RUST
  // ==========================================
  async function ejecutarLecturaArchivo(ruta: string, indexMensaje: number) {
    historial.value[indexMensaje].resultado = "Accediendo al disco duro local...";
    try {
      const res = await invoke("leer_archivo_local", { ruta: ruta });
      historial.value[indexMensaje].resultado = `CONTENIDO DE [${ruta}]:\n\n${res}`;
      memoriaIA.push({ role: "user", content: `Aquí tienes el contenido leído de ${ruta}:\n\n${res}\n\nAnaliza este código detalladamente de forma proactiva.` });
      await procesarRespuestaIA();
    } catch (error) {
      historial.value[indexMensaje].resultado = `ERROR DE LECTURA:\n${error}`;
      memoriaIA.push({ role: "user", content: `Falló la lectura de ${ruta} con error: ${error}` });
      await procesarRespuestaIA();
    }
  }

  // =================================================================
  // 6. FUNCIONES AUXILIARES: OBTENER MODELOS, VERIFICAR CONEXIÓN, ACTUALIZAR LISTA
  // =================================================================

  const obtenerModelos = async () => {
    estadoConexion.value = 'conectando';
    try {
      const respuestaCruda: string = await invoke("obtener_modelos_rust");
      const datos = JSON.parse(respuestaCruda);
      modelos.value = datos.models.map((m: any) => m.name);

      if (modelos.value.length > 0) {
        if (!modelos.value.includes(modeloSeleccionado.value)) {
          modeloSeleccionado.value = modelos.value[0];
        }
        estadoConexion.value = 'conectado';
      }
    } catch (error) {
      console.error("Rust reporta que Ollama no responde:", error);
      modelos.value = ["⚠️ Ollama Desconectado"];
      modeloSeleccionado.value = "⚠️ Ollama Desconectado";
      estadoConexion.value = 'desconectado';
      historial.value.push({
        role: "SISTEMA",
        content: "❌ Motor de IA inalcanzable. Rust no pudo encontrar el servicio de Ollama en el puerto 11434.",
        color: "#ef4444"
      });
    }
  };

  // =================================================================
  // 7. FUNCIONES AUXILIARES: RECONEXIÓN, REINTENTOS, FALLBACKS
  // =================================================================

  const reconectarOllama = async () => {
    if (estadoConexion.value === 'conectando') return;
    await obtenerModelos();
  };

  // ==========================================
  // 8. FUNCIONES AUXILIARES: GESTIÓN DE TEMAS, FUENTES, APARIENCIA
  // ==========================================

  interface Fuente {
    nombre: string;
    valor: string;
  }

  interface Tema {
    id: string;
    nombre: string;
    color: string;
  }

  const temasDisponibles: Tema[] = [
    { id: 'theme-tokyo', nombre: 'Tokyo Night', color: 'var(--accent-primary)' },
    { id: 'theme-dracula', nombre: 'Drácula', color: '#bd93f9' },
    { id: 'theme-gruvbox', nombre: 'Gruvbox', color: '#fabd2f' },
    { id: 'theme-nord', nombre: 'Nord', color: '#88c0d0' }
  ];

  const fuentesDisponibles: Fuente[] = [
    { nombre: 'Inter', valor: 'Inter, sans-serif' },
    { nombre: 'JetBrains Mono', valor: '"JetBrains Mono", monospace' },
    { nombre: 'Roboto', valor: 'Roboto, sans-serif' },
    { nombre: 'Open Sans', valor: '"Open Sans", sans-serif' }
  ];

  const temaActual = ref<string>('theme-tokyo');
  const fuenteSeleccionada = ref<string>('Inter, sans-serif');

  const aplicarYGuardarTema = (idTema: string): void => {
    document.documentElement.setAttribute('data-theme', idTema);
    localStorage.setItem('ainz_core_tema', idTema);
  };

  const aplicarYGuardarFuente = (valorFuente: string): void => {
    document.documentElement.style.setProperty('--font-family-main', valorFuente);
    localStorage.setItem('ainz_core_fuente', valorFuente);
  };

  const cambiarTema = (id: string): void => {
    temaActual.value = id;
  };

  const cambiarFuente = (valor: string): void => {
    fuenteSeleccionada.value = valor;
  };

  watch(temaActual, (nuevoTema: string) => {
    aplicarYGuardarTema(nuevoTema);
  });

  watch(fuenteSeleccionada, (nuevaFuente: string) => {
    aplicarYGuardarFuente(nuevaFuente);
  });

  onMounted(() => {
    const temaGuardado = localStorage.getItem('ainz_core_tema') || 'theme-tokyo';
    const fuenteGuardada = localStorage.getItem('ainz_core_fuente') || 'Inter, sans-serif';

    temaActual.value = temaGuardado;
    fuenteSeleccionada.value = fuenteGuardada;

    aplicarYGuardarTema(temaGuardado);
    aplicarYGuardarFuente(fuenteGuardada);
  });

  // =================================================================
  // 9. CICLO DE VIDA: ONMOUNTED, CARGA DE TEMAS, DIRECTORIO, MODELOS, MOTOR PDF, MARKED
  // =================================================================

  onMounted(async () => {

    try {
      const rutaReal = await invoke<string>("obtener_directorio_actual");
      directorioActual.value = rutaReal;
    } catch (error) {
      console.error("No se pudo resolver el directorio:", error);
      directorioActual.value = "C:\\";
    }

    obtenerModelos();
    cargarDeLocalStorage();

    if (!(window as any).pdfjsLib) {
      const script = document.createElement("script");
      script.src = "[https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js)";
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "[https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js)";
        console.log("Motor de extracción de PDFs cargado e inyectado correctamente.");
      };
      document.head.appendChild(script);
    }

    if (!(window as any).marked) {
      const script = document.createElement("script");
      script.src = "[https://cdn.jsdelivr.net/npm/marked/marked.min.js](https://cdn.jsdelivr.net/npm/marked/marked.min.js)";
      document.head.appendChild(script);
    }
  });

  // =================================================================
  // FUNCIONES AUXILIARES: RENDERIZADO DE MARKDOWN CON MARKED.JS
  // =================================================================

  const renderizarMarkdown = (texto: string): string => {
    if (!texto) return '';

    return marked.parse(texto) as string;
  };

  // =================================================================
  // FUNCIONES AUXILIARES: CONTROL DE VENTANA (MINIMIZAR, CERRAR) Y GESTIÓN DE ARCHIVOS EN MEMORIA
  // =================================================================


  const appWindow = getCurrentWindow();

  const minimizarVentana = async () => {
    await appWindow.minimize();
  };

  const cerrarVentana = async () => {
    await appWindow.close();
  };

  // =================================================================
  // FUNCIONES AUXILIARES: CONTROL DE ARCHIVOS EN MEMORIA (EXPULSAR DE RAM, LIMPIAR VARIABLES)
  // =================================================================

  const expulsarArchivoMemoria = () => {
    if (!nombreArchivoActual.value) return;
    const nombre = nombreArchivoActual.value;
    memoriaIA = memoriaIA.filter(m => !m.content.includes(`[${nombre}]`));

    historial.value.push({
      role: "SISTEMA",
      content: `El archivo "${nombre}" ha sido purgado de la memoria RAM del modelo. Tu ventana de contexto está libre.`,
      color: "#f7768e"
    });
    limpiarArchivoActual();
  };

  const manejarArchivo = async (event: any) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      console.warn("No se seleccionó ningún archivo");
      return;
    }

    const nombre = file.name;
    const extension = nombre.split('.').pop()?.toLowerCase() || '';
    nombreArchivoActual.value = nombre;

    const extensionesTextoYCodigo = [
      'txt', 'py', 'js', 'ts', 'json', 'html', 'css',
      'md', 'csv', 'sql', 'sh', 'bat', 'ps1', 'vue'
    ];

    if (extensionesTextoYCodigo.includes(extension)) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const contenido = e.target?.result as string;
        contenidoArchivoActual.value = contenido;

        // Magia: Simulamos que el usuario escribió el archivo en el chat
        inputUsuario.value = `He cargado el archivo [${nombre}]. Su contenido es:\n\n${contenido}\n\nActúa de forma proactiva y haz un análisis breve.`;
        await enviarMensaje();
      };
      reader.readAsText(file);
    }
    else if (extension === 'pdf') {
      contenidoArchivoActual.value = "[Iniciando extracción de texto del PDF...]";
      historial.value.push({
        role: "SISTEMA",
        content: `Extrayendo capas de texto del documento: "${nombre}"...`,
        color: "#ff9e64"
      });

      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        historial.value.push({
          role: "SISTEMA",
          content: "Error: El motor PDF.js aún no se ha inicializado. Reintenta en unos segundos.",
          color: "#ef4444"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let textoCompletoPdf = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const pagina = await pdf.getPage(i);
            const contenidoTexto = await pagina.getTextContent();
            const textoPagina = contenidoTexto.items.map((item: any) => item.str).join(" ");
            textoCompletoPdf += `--- PÁGINA ${i} ---\n${textoPagina}\n\n`;
          }

          if (!textoCompletoPdf.trim()) {
            throw new Error("El archivo PDF parece estar vacío o compuesto únicamente por imágenes escaneadas sin capa de texto (OCR).");
          }

          contenidoArchivoActual.value = textoCompletoPdf;
          memoriaIA.push({
            role: "user",
            content: `He cargado el documento estructurado [${nombre}]. El texto real extraído directamente de sus páginas es el siguiente:\n\n${textoCompletoPdf}\n\nAnaliza este contenido detalladamente, asimila sus conceptos y confirma que estás listo para responder resúmenes o preguntas específicas.`
          });
          historial.value.push({
            role: "TÚ",
            content: `[Documento Cargado] Analiza el contenido del PDF "${nombre}" en tiempo real.`,
            color: "#38bdf8"
          });
          await procesarRespuestaIA();

        } catch (error: any) {
          console.error("Fallo en el pipeline de PDF.js:", error);
          historial.value.push({
            role: "SISTEMA",
            content: `Error crítico al extraer texto del PDF: ${error.message || error}`,
            color: "#ef4444"
          });
          limpiarArchivoActual();
        }
      };
      reader.readAsArrayBuffer(file);
    }
    else {
      historial.value.push({
        role: "SISTEMA",
        content: `El formato .${extension} de "${nombre}" no es compatible con el lector de texto directo.`,
        color: "#ef4444"
      });
      limpiarArchivoActual();
    }
  };

  const fileInput = ref<HTMLInputElement | null>(null);

  // ==========================================
  // CONTROL DE SESIÓN (FASE 1)
  // ==========================================

  const limpiarChat = () => {
    historial.value = [{ role: "SISTEMA", content: "La memoria del agente ha sido purgada. Nueva sesión iniciada.", color: "var(--accent-primary)" }];
    limpiarArchivoActual();

    const chatActual = listaChats.value.find(c => c.id === idChatActivo.value);
    if (chatActual) {
      chatActual.titulo = "Chat Limpiado";
    }
    guardarEnLocalStorage();
  };

  // ==========================================
  // CONTROL DE MÚLTIPLES CHATS (HISTORIAL)
  // ==========================================

  interface ChatSession {
    id: string;
    titulo: string;
    historial: Mensaje[];
    memoriaIA: any[];
    nombreArchivoActual: string;
    contenidoArchivoActual: string;
    metricas?: MetricasOllama;
  }

  const sincronizarChatActual = () => {
    const chat = listaChats.value.find(c => c.id === idChatActivo.value);
    if (chat) {
      chat.historial = historial.value;
      chat.memoriaIA = memoriaIA;
      chat.nombreArchivoActual = nombreArchivoActual.value;
      chat.contenidoArchivoActual = contenidoArchivoActual.value;
      chat.metricas = metricasActuales.value ? { ...metricasActuales.value } : undefined;
    }
  };

  const guardarEnLocalStorage = () => {
    sincronizarChatActual();
    localStorage.setItem("ainz_core_chats", JSON.stringify(listaChats.value));
    localStorage.setItem("ainz_core_activo", idChatActivo.value);
  };

  const crearNuevoChat = (titulo = "Nuevo Chat") => {
    if (idChatActivo.value) sincronizarChatActual();

    const nuevoId = crypto.randomUUID();
    const nuevaSesion: ChatSession = {
      id: nuevoId,
      titulo: titulo,
      historial: [
        { role: "SISTEMA", content: "Nueva sesión iniciada. Agente listo.", color: "var(--accent-primary)" }
      ],
      memoriaIA: [...MEMORIA_INICIAL],
      nombreArchivoActual: "",
      contenidoArchivoActual: ""
    };

    listaChats.value.unshift(nuevaSesion);
    idChatActivo.value = nuevoId;

    historial.value = nuevaSesion.historial;
    memoriaIA = nuevaSesion.memoriaIA;
    metricasActuales.value = null;
    limpiarArchivoActual();

    guardarEnLocalStorage();
  };

  const seleccionarChat = (id: string) => {
    if (id === idChatActivo.value) return;
    sincronizarChatActual();

    const chat = listaChats.value.find(c => c.id === id);
    if (chat) {
      idChatActivo.value = chat.id;
      historial.value = chat.historial;
      memoriaIA = chat.memoriaIA;
      nombreArchivoActual.value = chat.nombreArchivoActual;
      contenidoArchivoActual.value = chat.contenidoArchivoActual;
      metricasActuales.value = chat.metricas ? { ...chat.metricas } : null;
      localStorage.setItem("ainz_core_activo", id);
    }
  };

  const eliminarChat = (id: string, event: MouseEvent) => {
    event.stopPropagation();
    listaChats.value = listaChats.value.filter(c => c.id !== id);

    if (idChatActivo.value === id) {
      if (listaChats.value.length > 0) {
        seleccionarChat(listaChats.value[0].id);
      } else {
        idChatActivo.value = "";
        crearNuevoChat();
      }
    } else {
      guardarEnLocalStorage();
    }
  };

  const cargarDeLocalStorage = () => {
    const datos = localStorage.getItem("ainz_core_chats");
    const activo = localStorage.getItem("ainz_core_activo");

    if (datos) {
      listaChats.value = JSON.parse(datos);
      if (activo && listaChats.value.some(c => c.id === activo)) {
        idChatActivo.value = activo;
        const chat = listaChats.value.find(c => c.id === activo)!;
        historial.value = chat.historial;
        memoriaIA = chat.memoriaIA;
        nombreArchivoActual.value = chat.nombreArchivoActual;
        contenidoArchivoActual.value = chat.contenidoArchivoActual;
        metricasActuales.value = chat.metricas ? { ...chat.metricas } : null;
      } else if (listaChats.value.length > 0) {
        seleccionarChat(listaChats.value[0].id);
      } else {
        crearNuevoChat();
      }
    } else {
      crearNuevoChat();
    }
  };

  // ==========================================
  // CONTROL DE MÚLTIPLES CHATS Y MÉTRICAS
  // ==========================================

  interface MetricasOllama {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    velocidad: string;
    tiempoTotal: string;
    promptAcumulados: number;
    responseAcumulados: number;
    totalAcumulados: number;
  }

  const listaChats = ref<ChatSession[]>([]);
  const idChatActivo = ref<string>("");
  const metricasActuales = ref<MetricasOllama | null>(null);

  // ==========================================
  // CAPTURA DE VOZ (WEB SPEECH API)
  // ==========================================

  const escuchandoVoz = ref(false);
  let reconocimientoVoz: any = null;

  const toggleDictado = () => {
    if (escuchandoVoz.value && reconocimientoVoz) {
      reconocimientoVoz.stop();
      return;
    }

    const APIReconocimiento = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!APIReconocimiento) {
      historial.value.push({
        role: "SISTEMA",
        content: "Error: El motor de tu sistema no soporta la Web Speech API nativa.",
        color: "#ef4444"
      });
      return;
    }

    reconocimientoVoz = new APIReconocimiento();
    reconocimientoVoz.lang = 'es-ES';
    reconocimientoVoz.interimResults = true;
    reconocimientoVoz.continuous = false;

    reconocimientoVoz.onstart = () => {
      escuchandoVoz.value = true;
    };

    reconocimientoVoz.onresult = (evento: any) => {
      const transcripcion = Array.from(evento.results)
        .map((resultado: any) => resultado[0].transcript)
        .join('');
      inputUsuario.value = transcripcion;
    };

    reconocimientoVoz.onerror = (evento: any) => {
      console.error("Error en captura de voz:", evento.error);
      escuchandoVoz.value = false;
    };

    reconocimientoVoz.onend = () => {
      escuchandoVoz.value = false;
    };

    reconocimientoVoz.start();
  };

  // ==========================================
  // PROCESADOR DE BLOQUES DE CÓDIGO
  // ==========================================

  // ==========================================
  // PROCESADOR DE BLOQUES DE CÓDIGO (EVOLUCIONADO)
  // ==========================================
  const procesarContenido = (texto: string) => {
    if (!texto) return [];

    // EL ESCAPE DE LA PRISIÓN: Destruimos la envoltura inútil de markdown
    let textoProcesado = texto.trim();
    if (textoProcesado.toLowerCase().startsWith('```markdown') && textoProcesado.endsWith('```')) {
      // Limpiamos la primera línea (```markdown) y la última (```)
      textoProcesado = textoProcesado.replace(/^```markdown\s*/i, '').replace(/\s*```$/, '').trim();
    }

    const bloques = [];
    const regex = /```(\w*)[ \t]*\r?\n([\s\S]*?)```/g;
    let ultimoIndice = 0;
    let match;

    while ((match = regex.exec(textoProcesado)) !== null) {
      if (match.index > ultimoIndice) {
        bloques.push({ tipo: 'texto', contenido: textoProcesado.slice(ultimoIndice, match.index) });
      }
      bloques.push({ tipo: 'codigo', lenguaje: match[1] || 'code', contenido: match[2].trim() });
      ultimoIndice = regex.lastIndex;
    }

    const textoRestante = textoProcesado.slice(ultimoIndice);
    const bloqueSinCerrar = textoRestante.match(/```(\w*)[ \t]*\r?\n([\s\S]*)$/);

    if (bloqueSinCerrar) {
      const textoAntes = textoRestante.slice(0, bloqueSinCerrar.index);
      if (textoAntes) bloques.push({ tipo: 'texto', contenido: textoAntes });
      bloques.push({ tipo: 'codigo', lenguaje: bloqueSinCerrar[1] || 'code', contenido: bloqueSinCerrar[2].trim() });
    } else if (textoRestante.trim()) {
      bloques.push({ tipo: 'texto', contenido: textoRestante });
    }

    return bloques.length > 0 ? bloques : [{ tipo: 'texto', contenido: textoProcesado }];
  };

  const copiarAlPortapapeles = async (codigo: string, evento: any) => {
    try {
      await navigator.clipboard.writeText(codigo);
      const btn = evento.currentTarget;
      const innerHTMLOriginal = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ece6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => { btn.innerHTML = innerHTMLOriginal; }, 1500);
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  const textareaRef = ref<HTMLTextAreaElement | null>(null);

  const ajustarAltura = () => {
    const el = textareaRef.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // ==========================================
  // CONTROL DE SCROLL INTELIGENTE
  // ==========================================

  const verificarPosicionScroll = () => {
    const el = viewportRef.value;
    if (!el) return;
    const distanciaAlFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
    usuarioSubioScroll.value = distanciaAlFondo > 100;
  };

  const hacerScrollHaciaAbajo = async (forzar = false) => {
    await nextTick();
    const el = viewportRef.value;
    if (!el) return;
    if (forzar || !usuarioSubioScroll.value) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const appVersion = ref('Cargando...');

  onMounted(async () => {
    try {
      appVersion.value = await getVersion();
    } catch (error) {
      console.error("Error al leer la versión de Tauri:", error);
      appVersion.value = "Desconocida";
    }
  });

  // ==========================================
  // FUNCIONES DE VINCULACIÓN E INDEXACIÓN DE BÓVEDA DE OBSIDIAN
  // ==========================================

  const rutaBoveda = ref<string | null>(null);
  const notasCargadas = ref<any[]>([]);

  let intervaloIndexacion: ReturnType<typeof setInterval> | null = null;

  const iniciarObservadorBoveda = () => {
    if (intervaloIndexacion) clearInterval(intervaloIndexacion);

    intervaloIndexacion = setInterval(async () => {
      if (rutaBoveda.value) {
        try {
          const entradas = await readDir(rutaBoveda.value);
          const nuevasNotas = entradas.filter((entrada: DirEntry) =>
            entrada.isFile && entrada.name.endsWith('.md')
          );

          if (nuevasNotas.length !== notasCargadas.value.length) {
            notasCargadas.value = nuevasNotas;
            console.log(`[Observador] Cambio detectado. Nuevos nodos indexados: ${nuevasNotas.length}`);
          }
        } catch (error) {
          console.error("Fallo de I/O en el observador de fondo:", error);
        }
      }
    }, 5000);
  };


  onMounted(async () => {
    const bovedaGuardada = localStorage.getItem('ainz_boveda_path');
    if (bovedaGuardada) {
      console.log("Cargando bóveda guardada desde:", bovedaGuardada);
      rutaBoveda.value = bovedaGuardada;
      await indexarNotas(bovedaGuardada);
      iniciarObservadorBoveda();
    }
  });

  const vincularBoveda = async (): Promise<void> => {
    try {
      const seleccion = await open({
        directory: true,
        multiple: false,
        title: 'Selecciona la carpeta raíz de Obsidian'
      });

      if (typeof seleccion === 'string') {
        rutaBoveda.value = seleccion;
        // Guardamos la ruta visual en localStorage para la UI
        localStorage.setItem('ainz_boveda_path', seleccion);
        await indexarNotas(seleccion);
      }
    } catch (error) {
      console.error("Error crítico al invocar el diálogo del sistema:", error);
    }
  };

  const indexarNotas = async (ruta: string): Promise<void> => {
    try {
      const entradas = await readDir(ruta);
      notasCargadas.value = entradas.filter(entrada =>
        entrada.isFile && entrada.name.endsWith('.md')
      );
      console.log(`Bóveda vinculada con éxito. ${notasCargadas.value.length} nodos detectados.`);
    } catch (error) {
      console.error("Fallo de I/O al escanear la bóveda (Posible falta de permisos del scope):", error);
      rutaBoveda.value = null;
    }
  };

  // ==========================================
  // MOTOR DE BÚSQUEDA DEL SEGUNDO CEREBRO (RAG)
  // ==========================================
  const buscarEnBoveda = async (query: string): Promise<string> => {
    if (!rutaBoveda.value) return "Error: No hay una bóveda de Obsidian vinculada.";

    try {
      const entradas = await readDir(rutaBoveda.value);
      const archivosMd = entradas.filter(e => e.isFile && e.name.endsWith('.md'));
      let resultadosObtenidos: string[] = [];

      for (const archivo of archivosMd) {
        const rutaCompleta = await join(rutaBoveda.value, archivo.name);
        const contenido = await readTextFile(rutaCompleta);

        const coincideContenido = contenido.toLowerCase().includes(query.toLowerCase());
        const coincideTitulo = archivo.name.toLowerCase().includes(query.toLowerCase());

        if (coincideContenido || coincideTitulo) {
          let fragmento = contenido.trim() === "" ? "[NOTA VACÍA - 0 BYTES. Lista para ser escrita.]" : contenido;
          fragmento = fragmento.length > 1500 ? fragmento.substring(0, 1500) + "... [texto truncado]" : fragmento;
          resultadosObtenidos.push(`--- NOTA: ${archivo.name} ---\n${fragmento}`);
        }
      }

      if (resultadosObtenidos.length === 0) {
        return `No se encontró información sobre "${query}" en la bóveda.`;
      }

      return resultadosObtenidos.slice(0, 4).join("\n\n");
    } catch (error) {
      console.error("Fallo del disco al buscar en la bóveda:", error);
      return `Error de lectura del disco: ${error}`;
    }
  };


  onMounted(async () => {
    const bovedaGuardada = localStorage.getItem('ainz_boveda_path');

    if (bovedaGuardada) {
      console.log("Intentando restaurar bóveda desde:", bovedaGuardada);
      rutaBoveda.value = bovedaGuardada;

      await indexarNotas(bovedaGuardada);
    }
  });

  return {
    // Variables (refs)
    inputUsuario,
    estaPensando,
    historial,
    directorioActual,
    modelos,
    modeloSeleccionado,
    estadoAgente,
    temaActual,
    fuenteSeleccionada,
    rutaBoveda,
    notasCargadas,
    estadoConexion,
    estadoActualizacion,
    versionNueva,
    escuchandoVoz,
    metricasActuales,
    mostrarConfiguracion,
    idChatActivo,
    listaChats,
    fileInput,
    appVersion,
    fuentesDisponibles,
    temasDisponibles,
    tabActivaConfig,
    mostrarModalArchivo,
    nombreArchivoActual,
    contenidoArchivoActual,
    permisoAccesoGlobal,

    // Funciones
    enviarMensaje,
    ejecutarComando,
    ejecutarLecturaArchivo,
    verificarActualizaciones,
    aplicarActualizacion,
    limpiarChat,
    crearNuevoChat,
    expulsarArchivoMemoria,
    limpiarArchivoActual,
    reconectarOllama,
    manejarArchivo,
    seleccionarChat,
    eliminarChat,
    verificarPosicionScroll,
    vincularBoveda,
    cambiarTema,
    cambiarFuente,
    toggleDictado,
    minimizarVentana,
    cerrarVentana,
    ajustarAltura,
    copiarAlPortapapeles,
    renderizarMarkdown,
    procesarContenido,
    hacerScrollHaciaAbajo,
    // agrega cualquier otra que uses en el template
  };
}
