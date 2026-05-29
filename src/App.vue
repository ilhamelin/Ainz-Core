<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { invoke } from '@tauri-apps/api/core';



import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

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
const directorioActual = ref("Iniciando...");

const modelos = ref<string[]>([]);
const modeloSeleccionado = ref<string>("");

const nombreArchivoActual = ref("");
const contenidoArchivoActual = ref("");
const mostrarModalArchivo = ref(false);
const mostrarConfiguracion = ref(false);
const tabActivaConfig = ref<'apariencia' | 'motor' | 'actualizaciones' | 'acerca'>('apariencia');

// Estado de salud del servidor Ollama
const estadoConexion = ref<'conectando' | 'conectado' | 'desconectado'>('conectando');

const viewportRef = ref<HTMLElement | null>(null);
const usuarioSubioScroll = ref(false);

const limpiarArchivoActual = () => {
  nombreArchivoActual.value = "";
  contenidoArchivoActual.value = "";
};


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
  }
];

let memoriaIA = [...MEMORIA_INICIAL];

async function procesarRespuestaIA() {
  estaPensando.value = true;
  try {
    const respuestaFull: any = await invoke("enviar_chat_rust", {
      model: modeloSeleccionado.value,
      messages: memoriaIA
    });

    const contenidoIA = respuestaFull.message?.content || "";
    const pTokens = respuestaFull.prompt_eval_count || 0;
    const rTokens = respuestaFull.eval_count || 0;
    const tDuration = respuestaFull.total_duration || 0;
    const eDuration = respuestaFull.eval_duration || 0;

    // 2. PREPARAMOS EL MENSAJE
    const indiceActual = historial.value.length;
    historial.value.push({
      role: "AINZ CORE",
      content: contenidoIA,
      color: "#a78bfa",
      isStreaming: false
    });

    memoriaIA.push({ role: "assistant", content: contenidoIA });

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

    let jsonIA;
    let textoHuerfano = "";
    let jsonRoto = false;

    try {
      const jsonMatch = contenidoIA.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonIA = JSON.parse(jsonMatch[0]);
        textoHuerfano = contenidoIA.replace(jsonMatch[0], '').trim();
        textoHuerfano = textoHuerfano.replace(/```json/gi, "").trim();
      } else throw new Error("No JSON");
    } catch (e) {
      jsonRoto = true;
      jsonIA = { mensaje_ia: contenidoIA.trim(), comandos_powershell: [], leer_archivo: "" };
    }

    let textoAnalisis = jsonIA.mensaje_ia || "";
    if (textoHuerfano) textoAnalisis += `\n\n${textoHuerfano}`;

    for (const key in jsonIA) {
      if (!["mensaje_ia", "comandos_powershell", "leer_archivo"].includes(key)) {
        let val = jsonIA[key];
        if (Array.isArray(val)) val = val.join("\n- ");
        else if (typeof val === "object") val = JSON.stringify(val, null, 2);
        textoAnalisis += `\n\n🔹 ${key.toUpperCase()}:\n- ${val}`;
      }
    }

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
// 3. INTERACCIÓN DEL USUARIO
// ==========================================
async function enviarMensaje() {
  const texto = inputUsuario.value.trim();
  if (!texto) return;

  const chatActual = listaChats.value.find(c => c.id === idChatActivo.value);
  if (chatActual && (chatActual.titulo === "Nuevo Chat" || chatActual.titulo === "Chat Limpiado")) {
    chatActual.titulo = texto.length > 22 ? texto.substring(0, 22) + "..." : texto;
  }

  historial.value.push({ role: "TÚ", content: texto, color: "#38bdf8" });
  memoriaIA.push({ role: "user", content: texto });


  inputUsuario.value = "";

  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }

  await hacerScrollHaciaAbajo(true);

  await procesarRespuestaIA();
  guardarEnLocalStorage();
}

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

const reconectarOllama = async () => {
  if (estadoConexion.value === 'conectando') return;
  await obtenerModelos();
};

const temasDisponibles = [
  { id: 'theme-tokyo', nombre: 'Tokyo Night', color: 'var(--accent-primary)' },
  { id: 'theme-dracula', nombre: 'Drácula', color: '#bd93f9' },
  { id: 'theme-gruvbox', nombre: 'Gruvbox', color: '#fabd2f' },
  { id: 'theme-nord', nombre: 'Nord', color: '#88c0d0' }
];

const temaActual = ref('theme-tokyo');

const cambiarTema = (id: string) => {
  temaActual.value = id;
  localStorage.setItem("ainz_core_tema", id);
};

onMounted(async () => {

  const temaGuardado = localStorage.getItem("ainz_core_tema");
  if (temaGuardado) temaActual.value = temaGuardado;

  try {
    const rutaReal = await invoke<string>("obtener_directorio_actual");
    directorioActual.value = rutaReal;
  } catch (error) {
    console.error("No se pudo resolver el directorio:", error);
    directorioActual.value = "C:\\"; // Fallback de seguridad
  }

  obtenerModelos();
  cargarDeLocalStorage();


  if (!(window as any).pdfjsLib) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      console.log("Motor de extracción de PDFs cargado e inyectado correctamente.");
    };
    document.head.appendChild(script);
  }

  if (!(window as any).marked) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);
  }

});

const renderizarMarkdown = (texto: string) => {
  if ((window as any).marked) {
    return (window as any).marked.parse(texto);
  }
  return texto;
};

import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const minimizarVentana = async () => {
  await appWindow.minimize();
};

const cerrarVentana = async () => {
  await appWindow.close();
};

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
  console.log("Archivo detectado:", nombre);

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

      memoriaIA.push({
        role: "user",
        content: `He cargado el archivo [${nombre}]. Su contenido es el siguiente:\n\n${contenido}\n\nActúa de forma proactiva: Haz un análisis técnico muy breve de lo que hace este archivo, identifica su propósito principal y confirma que lo tienes en memoria listo para responder preguntas.`
      });

      historial.value.push({
        role: "TÚ",
        content: `[Subida de Archivo] Analiza el código de ${nombre} en tiempo real.`,
        color: "#38bdf8"
      });

      await procesarRespuestaIA();
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
  memoriaIA = [...MEMORIA_INICIAL];;
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
}

const sincronizarChatActual = () => {
  const chat = listaChats.value.find(c => c.id === idChatActivo.value);
  if (chat) {
    chat.historial = historial.value;
    chat.memoriaIA = memoriaIA;
    chat.nombreArchivoActual = nombreArchivoActual.value;
    chat.contenidoArchivoActual = contenidoArchivoActual.value;
    chat.metricas = metricasActuales.value ? { ...metricasActuales.value } : undefined; //

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

const eliminarChat = (id: string, event: Event) => {
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

interface ChatSession {
  id: string;
  titulo: string;
  historial: Mensaje[];
  memoriaIA: any[];
  nombreArchivoActual: string;
  contenidoArchivoActual: string;
  metricas?: MetricasOllama; //
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
const procesarContenido = (texto: string) => {
  if (!texto) return [];
  const bloques = [];
  const regex = /```(\w*)[ \t]*\r?\n([\s\S]*?)```/g;
  let ultimoIndice = 0;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimoIndice) {
      bloques.push({ tipo: 'texto', contenido: texto.slice(ultimoIndice, match.index) });
    }
    bloques.push({ tipo: 'codigo', lenguaje: match[1] || 'code', contenido: match[2].trim() });
    ultimoIndice = regex.lastIndex;
  }

  const textoRestante = texto.slice(ultimoIndice);
  const bloqueSinCerrar = textoRestante.match(/```(\w*)[ \t]*\r?\n([\s\S]*)$/);

  if (bloqueSinCerrar) {
    const textoAntes = textoRestante.slice(0, bloqueSinCerrar.index);
    if (textoAntes) bloques.push({ tipo: 'texto', contenido: textoAntes });
    bloques.push({ tipo: 'codigo', lenguaje: bloqueSinCerrar[1] || 'code', contenido: bloqueSinCerrar[2].trim() });
  } else if (textoRestante.trim()) {
    bloques.push({ tipo: 'texto', contenido: textoRestante });
  }

  return bloques.length > 0 ? bloques : [{ tipo: 'texto', contenido: texto }];
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

  // 1. Resetear la altura a 'auto' para que pueda encogerse si borras texto
  el.style.height = 'auto';
  // 2. Asignar la altura real del contenido (scrollHeight)
  el.style.height = `${el.scrollHeight}px`;
};

// ==========================================
// CONTROL DE SCROLL INTELIGENTE
// ==========================================
const verificarPosicionScroll = () => {
  const el = viewportRef.value;
  if (!el) return;

  // Si la distancia desde el fondo es mayor a 100px, asumimos que el usuario subió a leer
  const distanciaAlFondo = el.scrollHeight - el.scrollTop - el.clientHeight;
  usuarioSubioScroll.value = distanciaAlFondo > 100;
};

const hacerScrollHaciaAbajo = async (forzar = false) => {
  // Esperamos a que Vue renderice el nuevo mensaje en el DOM
  await nextTick();

  const el = viewportRef.value;
  if (!el) return;

  // Hacemos scroll SI se fuerza (ej. cuando el usuario envía un mensaje) 
  // O SI el usuario no había subido a leer otra cosa.
  if (forzar || !usuarioSubioScroll.value) {
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth'
    });
  }
};

</script>


<template>
  <div class="opencode-app" :class="temaActual">
    <header class="oc-header" data-tauri-drag-region>
      <div class="oc-title" data-tauri-drag-region>
        <span data-tauri-drag-region>⚡ Ainz Core | {{ directorioActual }}</span>
      </div>

      <div class="model-selector" data-tauri-drag-region>
        <select v-model="modeloSeleccionado" class="oc-select">
          <option v-for="modelo in modelos" :key="modelo" :value="modelo">
            {{ modelo }}
          </option>
        </select>
      </div>

      <div class="window-controls" data-tauri-drag-region="false">
        <button class="win-btn minimize" data-tauri-drag-region="false" @click="minimizarVentana">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>

        <button class="win-btn close" data-tauri-drag-region="false" @click="cerrarVentana">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="2" />
            <line x1="1" y1="11" x2="11" y2="1" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>
    </header>

    <main class="oc-main-container" id="editor-viewport">

      <aside class="oc-sidebar oc-sidebar-left">
        <div class="oc-sidebar-header">
          <h3>Historial de Chats</h3>
          <button class="oc-btn-small" @click="crearNuevoChat()">+</button>
        </div>
        <div class="oc-sidebar-content">
          <div v-for="chat in listaChats" :key="chat.id" class="oc-chat-item"
            :class="{ active: chat.id === idChatActivo }" @click="seleccionarChat(chat.id)">
            <span class="oc-chat-title">💬 {{ chat.titulo }}</span>
            <button class="oc-btn-delete" @click="eliminarChat(chat.id, $event)">×</button>
          </div>
        </div>
      </aside>

      <section class="oc-viewport" id="editor-viewport" ref="viewportRef" @scroll="verificarPosicionScroll">
        <div class="oc-thread">
          <div v-for="(msg, index) in historial" :key="index" class="oc-message">

            <div v-if="msg.role === 'TÚ'" class="oc-task-header">
              <h3 class="oc-user-text"># {{ msg.content }}</h3>
            </div>

            <div v-else class="oc-agent-block">
              <div class="oc-agent-header" style="margin-bottom: 8px;">
                <span v-if="msg.json_roto" title="El modelo colapsó el formato JSON. Se rescataron los datos en crudo."
                  style="color: #f7768e; margin-right: 5px;">⚠️</span>
              </div>

              <div class="oc-message-content">
                <pre v-if="msg.isStreaming" class="oc-streaming-text">{{ msg.content }}</pre>

                <template v-else v-for="(bloque, bIndex) in procesarContenido(msg.content)" :key="bIndex">

                  <div v-if="bloque.tipo === 'texto'" class="oc-markdown" v-html="renderizarMarkdown(bloque.contenido)">
                  </div>

                  <div v-else-if="bloque.tipo === 'codigo'" class="oc-code-block">
                    <div class="oc-code-header">
                      <span class="oc-code-lang">{{ bloque.lenguaje }}</span>
                      <div class="oc-code-actions">
                        <button class="oc-code-icon-btn" title="Descargar" disabled>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                        <button class="oc-code-icon-btn" @click="copiarAlPortapapeles(bloque.contenido, $event)"
                          title="Copiar código">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <pre><code :class="'language-' + bloque.lenguaje">{{ bloque.contenido }}</code></pre>
                  </div>

                </template>
              </div>

              <div v-if="msg.comandos && msg.comandos.length > 0" class="oc-execution-block">
                <div v-for="cmd in msg.comandos" :key="cmd" class="oc-cmd-row">
                  <span class="oc-bullet">*</span>
                  <code class="oc-code-cmd">Run "{{ cmd }}"</code>
                  <button @click="ejecutarComando(cmd, index)" class="oc-btn">Execute</button>
                </div>
              </div>

              <div v-if="msg.archivo_a_leer" class="oc-execution-block">
                <div class="oc-cmd-row">
                  <span class="oc-arrow">→</span>
                  <code class="oc-code-cmd">Read {{ msg.archivo_a_leer }}</code>
                  <button @click="ejecutarLecturaArchivo(msg.archivo_a_leer, index)" class="oc-btn">Read File</button>
                </div>
              </div>

              <div v-if="msg.resultado" class="oc-result-block">
                <pre>{{ msg.resultado }}</pre>
              </div>
            </div>
          </div>

          <div v-if="estaPensando" class="oc-agent-block oc-thinking">
            <span class="oc-muted">~ Hacer preguntas a Qwen...</span>
          </div>
        </div>
      </section>

      <aside class="oc-sidebar oc-sidebar-right">
        <div class="oc-sidebar-header">
          <h3>Métricas (Tokens)</h3>
        </div>
        <div class="oc-sidebar-content">
          <div v-if="metricasActuales" class="oc-metrics-container">

            <div class="oc-metrics-group-title">Último Mensaje</div>

            <div class="oc-metric-box row-layout">
              <div class="metric-item">
                <span class="oc-metric-label">Entrada</span>
                <span class="oc-metric-value prompt-color small-val">{{ metricasActuales.promptTokens }}</span>
              </div>
              <div class="metric-item">
                <span class="oc-metric-label">Salida</span>
                <span class="oc-metric-value output-color small-val">{{ metricasActuales.responseTokens }}</span>
              </div>
            </div>

            <div class="oc-metric-box">
              <span class="oc-metric-label">Total Tokens Mensaje</span>
              <span class="oc-metric-value total-color">{{ metricasActuales.totalTokens }}</span>
            </div>

            <div class="oc-metric-divider"></div>

            <div class="oc-metrics-group-title">Acumulado del Chat</div>

            <div class="oc-metric-box">
              <span class="oc-metric-label">Tokens de Entrada Totales</span>
              <span class="oc-metric-value prompt-color">{{ metricasActuales.promptAcumulados }}</span>
            </div>

            <div class="oc-metric-box">
              <span class="oc-metric-label">Tokens de Salida Totales</span>
              <span class="oc-metric-value output-color">{{ metricasActuales.responseAcumulados }}</span>
            </div>

            <div class="oc-metric-box highlighted-box">
              <span class="oc-metric-label">Consumo Total del Chat</span>
              <span class="oc-metric-value total-color" style="font-size: 24px;">{{ metricasActuales.totalAcumulados
              }}</span>
            </div>

            <div class="oc-metric-divider"></div>

            <div class="oc-metric-box">
              <span class="oc-metric-label">Velocidad de Inferencia</span>
              <span class="oc-metric-value speed-color">{{ metricasActuales.velocidad }} <small>t/s</small></span>
            </div>

            <div class="oc-metric-box">
              <span class="oc-metric-label">Tiempo de Respuesta</span>
              <span class="oc-metric-value">{{ metricasActuales.tiempoTotal }} <small>s</small></span>
            </div>

          </div>
          <div v-else class="oc-metrics-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p>Esperando ejecución...</p>
          </div>
        </div>
      </aside>


    </main>

    <footer class="oc-footer">
      <div v-if="nombreArchivoActual" class="oc-file-badge">
        <span class="file-name">📎 {{ nombreArchivoActual }}</span>
        <button class="oc-btn-small" @click="mostrarModalArchivo = true">👁️ Ver Archivo</button>
        <button class="oc-btn-small warning" @click="expulsarArchivoMemoria">⏏️ Expulsar</button>
        <button class="oc-btn-small danger" @click="limpiarArchivoActual">❌</button>
      </div>

      <div class="oc-footer-actions">

        <button class="oc-btn-settings" @click="mostrarConfiguracion = true" title="Configuraciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
            </path>
          </svg>
        </button>

        <div class="oc-input-container">
          <button class="oc-attach-btn" @click="fileInput?.click()">+</button>
          <input type="file" id="file-input-hidden" ref="fileInput" @change="manejarArchivo" style="display: none"
            accept=".txt,.py,.js,.json,.html,.css,.md,.pdf,.csv,.xlsx" />

          <div class="oc-input-wrapper">
            <span class="oc-prompt">&gt;</span>

            <button class="oc-btn-mic" :class="{ 'is-listening': escuchandoVoz }" @click="toggleDictado"
              title="Dictar por voz">
              <svg v-if="!escuchandoVoz" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7768e" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="6" height="6"></rect>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>

            <textarea ref="textareaRef" v-model="inputUsuario" @keydown.enter.exact.prevent="enviarMensaje"
              @input="ajustarAltura" :disabled="estaPensando" placeholder="Escribe tus instrucciones" autofocus
              class="oc-textarea" rows="1"></textarea>
          </div>
        </div>

        <button class="oc-btn-clear" @click="limpiarChat">
          🗑️ Limpiar Chat
        </button>



      </div>
      <div class="oc-status-bar">
        <span><span class="oc-kbd">Ingresar</span> enviar</span>
        <span>Motor: <span class="oc-highlight">{{ modeloSeleccionado || 'Buscando...' }}</span> Local</span>
      </div>
    </footer>

    <div v-if="mostrarConfiguracion" class="oc-modal-overlay" @click.self="mostrarConfiguracion = false">
      <div class="oc-modal settings-modal">
        <div class="oc-modal-header">
          <h3>⚙️ Configuraciones de Ainz Core</h3>
          <button class="oc-btn-close" @click="mostrarConfiguracion = false">X</button>
        </div>

        <div class="settings-layout">

          <aside class="settings-sidebar">
            <button :class="{ active: tabActivaConfig === 'apariencia' }" @click="tabActivaConfig = 'apariencia'">
              🎨 Apariencia
            </button>
            <button :class="{ active: tabActivaConfig === 'motor' }" @click="tabActivaConfig = 'motor'">
              🧠 Motor IA
            </button>
            <button :class="{ active: tabActivaConfig === 'actualizaciones' }"
              @click="tabActivaConfig = 'actualizaciones'">
              🔄 Actualizaciones
            </button>
            <button :class="{ active: tabActivaConfig === 'acerca' }" @click="tabActivaConfig = 'acerca'">
              ℹ️ Acerca de...
            </button>
          </aside>

          <main class="settings-content">

            <div v-if="tabActivaConfig === 'apariencia'" class="settings-view">
              <h4 class="settings-title">Apariencia y Temas</h4>
              <p class="settings-desc">Selecciona la paleta de colores para la interfaz de la aplicación.</p>
              <div class="theme-grid">
                <div v-for="tema in temasDisponibles" :key="tema.id" class="theme-card"
                  :class="{ active: temaActual === tema.id }" @click="cambiarTema(tema.id)">
                  <div class="theme-color-preview" :style="{ backgroundColor: tema.color }"></div>
                  <span class="theme-name">{{ tema.nombre }}</span>
                  <span v-if="temaActual === tema.id" class="theme-active-icon">✓</span>
                </div>
              </div>
            </div>

            <div v-if="tabActivaConfig === 'motor'" class="settings-view">
              <h4 class="settings-title">Motor de Inteligencia Artificial</h4>
              <p class="settings-desc">Gestiona la conexión con tu servidor local de Ollama.</p>
              <div class="connection-card">
                <div class="connection-status">
                  <span class="status-dot" :class="estadoConexion"></span>
                  <span class="status-text">
                    {{
                      estadoConexion === 'conectado' ? 'Conectado y escuchando' :
                        estadoConexion === 'desconectado' ? 'Servidor Inalcanzable' :
                          'Estableciendo conexión...'
                    }}
                  </span>
                </div>
                <button class="oc-btn-settings-action" @click="reconectarOllama"
                  :disabled="estadoConexion === 'conectando'">
                  Reconectar
                </button>
              </div>
            </div>

            <div v-if="tabActivaConfig === 'actualizaciones'" class="settings-view">
              <h4 class="settings-title">Actualizaciones del Sistema</h4>
              <p class="settings-desc">Verifica si hay nuevas versiones de Ainz Core disponibles.</p>
              <div class="connection-card">
                <div class="connection-status">
                  <span class="status-dot" :class="{
                    'conectado': estadoActualizacion === 'actualizado',
                    'desconectado': estadoActualizacion === 'error',
                    'conectando': estadoActualizacion === 'buscando' || estadoActualizacion === 'actualizando'
                  }"></span>
                  <span class="status-text">
                    <template v-if="estadoActualizacion === 'inactivo'">Sistema listo</template>
                    <template v-else-if="estadoActualizacion === 'buscando'">Buscando en los servidores...</template>
                    <template v-else-if="estadoActualizacion === 'disponible'">¡Versión {{ versionNueva }}
                      disponible!</template>
                    <template v-else-if="estadoActualizacion === 'actualizando'">Instalando actualización...</template>
                    <template v-else-if="estadoActualizacion === 'actualizado'">Cuentas con la versión más
                      reciente.</template>
                    <template v-else-if="estadoActualizacion === 'error'">Error al contactar el servidor.</template>
                  </span>
                </div>
                <div style="display: flex; gap: 10px;">
                  <button
                    v-if="estadoActualizacion === 'inactivo' || estadoActualizacion === 'actualizado' || estadoActualizacion === 'error'"
                    class="oc-btn-settings-action" @click="verificarActualizaciones">
                    Buscar
                  </button>
                  <button v-if="estadoActualizacion === 'disponible'" class="oc-btn-settings-action"
                    style="background-color: var(--accent-primary); color: #14151a; font-weight: bold; border: none;"
                    @click="aplicarActualizacion">
                    Actualizar y Reiniciar
                  </button>
                </div>
              </div>
            </div>

            <div v-if="tabActivaConfig === 'acerca'" class="settings-view">
              <h4 class="settings-title">Acerca de Ainz Core</h4>
              <div style="display: flex; gap: 20px; align-items: center; margin-top: 15px;">
                <div
                  style="width: 80px; height: 80px; background: var(--bg-header); border-radius: 12px; display: flex; justify-content: center; align-items: center; border: 1px solid var(--accent-primary);">
                  <span style="font-size: 32px;">⚡</span>
                </div>
                <div>
                  <h3 style="color: var(--text-main); margin: 0;">Ainz Core</h3>
                  <p style="color: var(--text-muted); margin: 5px 0;">Versión 1.0.0</p>
                  <p style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                    Agente local autónomo especializado en Windows.<br>
                    Impulsado por Tauri v2 y modelos de lenguaje locales.
                  </p>
                </div>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>

    <div v-if="mostrarModalArchivo" class="oc-modal-overlay" @click.self="mostrarModalArchivo = false">
      <div class="oc-modal">
        <div class="oc-modal-header">
          <h3>📄 {{ nombreArchivoActual }}</h3>
          <button class="oc-btn-close" @click="mostrarModalArchivo = false">X</button>
        </div>
        <div class="oc-modal-body">
          <pre>{{ contenidoArchivoActual }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100vh;
  width: 100vw;
  overflow: hidden !important;
  background-color: var(--bg-app) !important;
}

::-webkit-scrollbar {
  display: none;
  width: 0px;
  background: transparent;

}

.opencode-app.theme-tokyo {
  --bg-app: var(--bg-app);
  --bg-header: var(--bg-header);
  --bg-sidebar: var(--bg-sidebar);
  --bg-panel: var(--bg-panel);
  --border-color: var(--border-color);
  --text-main: var(--text-main);
  --text-muted: var(--text-muted);
  --accent-primary: var(--accent-primary);
}


.opencode-app.theme-dracula {
  --bg-app: #282a36;
  --bg-header: #21222c;
  --bg-sidebar: #191a21;
  --bg-panel: #44475a;
  --border-color: #6272a4;
  --text-main: #f8f8f2;
  --text-muted: #6272a4;
  --accent-primary: #bd93f9;
}


.opencode-app.theme-gruvbox {
  --bg-app: #282828;
  --bg-header: #3c3836;
  --bg-sidebar: #1d2021;
  --bg-panel: #504945;
  --border-color: #665c54;
  --text-main: #ebdbb2;
  --text-muted: #a89984;
  --accent-primary: #fabd2f;
}


.opencode-app.theme-nord {
  --bg-app: #2e3440;
  --bg-header: #3b4252;
  --bg-sidebar: #242933;
  --bg-panel: #434c5e;
  --border-color: #4c566a;
  --text-main: #eceff4;
  --text-muted: #d8dee9;
  --accent-primary: #88c0d0;
}

.opencode-app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-app);
  color: #a9b1d6;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 14px;
  overflow: hidden;
}

.oc-header:active {
  cursor: grabbing;
}

.oc-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

.oc-thread {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.oc-task-header {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
  margin-top: 10px;
}

.oc-task-header h3 {
  color: var(--text-main);
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.oc-agent-block {
  color: #9aa5ce;
  line-height: 1.6;
}

.oc-text {
  margin: 0 0 12px 0;
  white-space: pre-wrap;
}

.oc-execution-block {
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oc-cmd-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.oc-bullet {
  color: var(--accent-primary);
}

.oc-arrow {
  color: #9ece6a;
}

.oc-code-cmd {
  color: var(--text-main);
  background: var(--bg-header);
  padding: 4px 8px;
  border-radius: 4px;
  flex: 1;
}

.oc-btn {
  background: transparent;
  color: var(--accent-primary);
  border: 1px solid var(--border-color);
  padding: 4px 12px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.oc-btn:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.oc-result-block {
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
  margin-top: 10px;
}

.oc-result-block pre {
  margin: 0;
  color: #9ece6a;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

.oc-footer {
  background-color: var(--bg-header);
  border-top: 1px solid var(--border-color);
  padding: 10px 20px;
}

.oc-input-wrapper {
  flex: 1;

  display: flex;
  align-items: center;
  background-color: var(--bg-app);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 12px 16px;
}

.oc-prompt {
  color: var(--accent-primary);
  font-weight: bold;
  margin-right: 12px;
}

.oc-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.oc-input-wrapper input::placeholder {
  color: var(--text-muted);
}

.oc-status-bar {
  max-width: 900px;
  margin: 10px auto 0 auto;
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 12px;
}

.oc-kbd {
  color: var(--text-main);
  font-weight: bold;
}

.oc-highlight {
  color: var(--accent-primary);
}

.oc-thinking {
  animation: pulse 1.5s infinite;
}

.oc-muted {
  color: var(--text-muted);
}

@keyframes pulse {
  0% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.5;
  }
}

.oc-header {
  height: 32px;
  background-color: var(--bg-header);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 15px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--border-color);
  color: var(--accent-primary);
  font-size: 12px;
}

.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 40px;
  height: 32px;
  background: transparent;
  border: none;
  color: #a9b1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.win-btn:hover {
  background: var(--border-color);
}

.win-btn.close:hover {
  background: #f7768e;
  color: #ffffff;
}

.model-selector {
  margin-right: 15px;
  -webkit-app-region: no-drag;
}

.model-dropdown {
  background-color: var(--border-color);
  color: var(--text-main);
  border: 1px solid #3b4261;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  outline: none;
}

.model-dropdown:hover {
  background-color: #3b4261;
}

.oc-attach-btn {
  background: transparent;
  border: 1px solid #3b4261;
  color: var(--accent-primary);
  padding: 12px 15px;
  cursor: pointer;
  border-radius: 4px;
  font-weight: bold;
}

.oc-attach-btn:hover {
  background: var(--border-color);
}

.oc-prompt {
  color: var(--accent-primary);
  font-weight: bold;
  margin-right: 12px;
}

.oc-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  outline: none;
}

.oc-input-container {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 900px;
  margin: 0 auto;
}

/* ==========================================
   ESTILOS DEL ARCHIVO Y MODAL
   ========================================== */
.oc-file-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--bg-app);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.file-name {
  color: #9ece6a;
  font-weight: bold;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oc-btn-small {
  background: transparent;
  color: var(--accent-primary);
  border: 1px solid var(--border-color);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: 0.2s;
}

.oc-btn-small:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.oc-btn-small.danger {
  color: #f7768e;
}

.oc-btn-small.danger:hover {
  background: #f7768e;
  color: var(--bg-app);
}

.oc-modal-overlay {
  position: fixed;
  top: 32px;
  left: 0;
  width: 100vw;
  height: calc(100vh - 32px);
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  backdrop-filter: blur(2px);
}

.oc-modal {
  background-color: var(--bg-app);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 80%;
  max-width: 900px;
  height: 80%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.oc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-header);
  border-radius: 8px 8px 0 0;
}

.oc-modal-header h3 {
  color: var(--text-main);
  font-size: 14px;
  margin: 0;
}

.oc-btn-close {
  background: transparent;
  border: none;
  color: #f7768e;
  font-size: 16px;
  cursor: pointer;
  font-weight: bold;
}

.oc-btn-close:hover {
  color: #ff9e64;
}

.oc-modal-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.oc-modal-body pre {
  margin: 0;
  color: var(--text-main);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ==========================================
   NUEVA ESTRUCTURA DE 3 COLUMNAS
   ========================================== */
.oc-main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.oc-sidebar {
  width: 250px;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.oc-sidebar-right {
  border-right: none;
  border-left: 1px solid var(--border-color);
}

.oc-sidebar-header {
  padding: 12px 15px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.oc-sidebar-header h3 {
  color: var(--text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.oc-sidebar-content {
  padding: 15px;
  flex: 1;
  overflow-y: auto;
}

.oc-placeholder {
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  text-align: center;
  margin-top: 20px;
}

.oc-footer-actions {
  display: flex;
  align-items: center;
  gap: 15px;
  max-width: 1100px;
  margin: 0 auto;
}

.oc-input-container {
  flex: 1;
}

.oc-btn-clear {
  background-color: var(--border-color);
  color: #f7768e;
  border: 1px solid #3b4261;
  padding: 12px 20px;
  border-radius: 4px;
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.oc-btn-clear:hover {
  background-color: #f7768e;
  color: var(--bg-app);
}

/* ==========================================
   ELEMENTOS DINÁMICOS DE LA LISTA DE CHATS
   ========================================== */
.oc-chat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  background-color: var(--bg-panel);
  border: 1px solid #23242e;
}

.oc-chat-item:hover {
  background-color: var(--border-color);
}

.oc-chat-item.active {
  background-color: var(--border-color);
  border-color: var(--accent-primary);
}

.oc-chat-title {
  color: var(--text-main);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 8px;
}

.oc-chat-item.active .oc-chat-title {
  color: var(--accent-primary);
  font-weight: 600;
}

.oc-btn-delete {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  font-weight: bold;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.oc-btn-delete:hover {
  color: #f7768e;
}

/* ==========================================
   ESTILOS DE MÉTRICAS (PANEL DERECHO)
   ========================================== */
.oc-metrics-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oc-metric-box {
  background-color: var(--bg-panel);
  border: 1px solid #23242e;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.oc-metric-label {
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.oc-metric-value {
  color: var(--text-main);
  font-size: 20px;
  font-weight: bold;
  font-family: 'JetBrains Mono', monospace;
}

.oc-metric-value small {
  font-size: 12px;
  color: var(--text-muted);
}

.prompt-color {
  color: #bb9af7;
}

.output-color {
  color: #9ece6a;
}

.total-color {
  color: var(--accent-primary);
}

.speed-color {
  color: #ff9e64;
}

.oc-metric-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 0;
}

.oc-metrics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  gap: 12px;
  margin-top: 40px;
}

.oc-metrics-group-title {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 6px;
  margin-bottom: 2px;
}

.row-layout {
  display: flex;
  flex-direction: row !important;
  justify-content: space-between;
  gap: 15px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.small-val {
  font-size: 16px !important;
}

.highlighted-box {
  border: 1px solid #3b4261 !important;
  background-color: #1a1b26 !important;
}

/* ==========================================
   ESTILOS DEL MICRÓFONO
   ========================================== */
.oc-btn-mic {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: 8px;
}

.oc-btn-mic:hover {
  color: var(--text-main);
}

.oc-btn-mic.is-listening {
  color: #f7768e;
  animation: pulse-mic 1.5s infinite;
}

@keyframes pulse-mic {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ==========================================
   ESTÉTICA DEL BLOQUE DE CÓDIGO
   ========================================== */
.oc-code-block {
  background-color: #121212;
  border: 1px solid #232323;
  border-radius: 12px;
  margin: 16px 0;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.oc-code-header {
  background-color: #1a1a1a;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #232323;
}

.oc-code-lang {
  color: #e0e0e0;
  font-size: 13px;
  font-weight: bold;
  text-transform: capitalize;
  font-family: system-ui, -apple-system, sans-serif;
}

.oc-code-actions {
  display: flex;
  gap: 12px;
}

.oc-code-icon-btn {
  background: transparent;
  border: none;
  color: #888888;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.oc-code-icon-btn:hover {
  color: #ffffff;
}

.oc-code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  background-color: #121212;
}

.oc-code-block code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #e0e0e0;
}

.oc-textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  resize: none;
  min-height: 24px;
  max-height: 200px;
  padding-top: 4px;
  overflow-y: auto;
}

.oc-textarea::placeholder {
  color: var(--text-muted);
}

.oc-markdown {
  color: #9aa5ce;
  line-height: 1.6;
  margin-bottom: 12px;
}

.oc-markdown :deep(strong) {
  color: var(--text-main);
  font-weight: 600;
}

.oc-markdown :deep(ul),
.oc-markdown :deep(ol) {
  margin-left: 20px;
  margin-bottom: 10px;
}

.oc-markdown :deep(li) {
  margin-bottom: 4px;
}

.oc-markdown :deep(code:not(pre code)) {
  background-color: var(--bg-header);
  color: #bb9af7;
  padding: 2px 4px;
  border-radius: 4px;
}

.oc-streaming-text {
  color: #9ece6a;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.oc-btn-small.warning {
  color: #ff9e64;
}

.oc-btn-small.warning:hover {
  background: #ff9e64;
  color: var(--bg-app);
}


.oc-user-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', Consolas, monospace;
  line-height: 1.5;
  color: var(--accent-primary);
}

/* ==========================================
   ESTILOS DE CONFIGURACIÓN Y MODAL
   ========================================== */
.oc-btn-settings {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 5px;
}

.oc-btn-settings:hover {
  background: var(--border-color);
  color: var(--text-main);
}

.settings-modal {
  max-width: 950px !important; 
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden; 
}

.settings-sidebar {
  width: 220px;
  background-color: var(--bg-header);
  border-right: 1px solid var(--border-color);
  padding: 15px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.settings-sidebar button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  text-align: left;
  padding: 10px 15px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.settings-sidebar button:hover {
  background-color: var(--bg-panel);
  color: var(--text-main);
}

.settings-sidebar button.active {
  background-color: var(--bg-panel);
  color: var(--accent-primary);
  border-left: 3px solid var(--accent-primary);
  border-radius: 0 6px 6px 0;
}

.settings-content {
  flex: 1;
  padding: 30px;
  background-color: var(--bg-app);
  overflow-y: auto;
}

.settings-view {
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-section {
  background-color: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin-bottom: 0;
  transition: border-color 0.2s ease;
}

.settings-section:hover {
  border-color: var(--text-muted);
}

.settings-title {
  color: var(--text-main);
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.settings-desc {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 20px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.theme-card {
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-card:hover {
  border-color: var(--text-muted);
}

.theme-card.active {
  border-color: var(--accent-primary);
  background: rgba(122, 162, 247, 0.05);
}

.theme-color-preview {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: 12px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
}

.theme-name {
  color: var(--text-main);
  font-size: 14px;
  flex: 1;
}

.theme-active-icon {
  color: var(--accent-primary);
  font-weight: bold;
}


/* ==========================================
   ESTILOS DE CONEXIÓN OLLAMA
   ========================================== */
.connection-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: 12px 16px;

  border-radius: 6px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.status-dot.conectado {
  background-color: #9ece6a;
  box-shadow: 0 0 8px rgba(158, 206, 106, 0.4);
}

.status-dot.desconectado {
  background-color: #f7768e;
  box-shadow: 0 0 8px rgba(247, 118, 142, 0.4);
}

.status-dot.conectando {
  background-color: #e0af68;
  animation: pulse-dot 1.5s infinite;
}

.status-text {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
}

.oc-btn-settings-action {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: all 0.2s;
}

.oc-btn-settings-action:hover:not(:disabled) {
  background: var(--border-color);
}

.oc-btn-settings-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse-dot {
  0% {
    transform: scale(0.95);
    opacity: 0.7;
  }

  50% {
    transform: scale(1.1);
    opacity: 1;
  }

  100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
}
</style>