<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from '@tauri-apps/api/core';


// ==========================================
// 1. ESTADO REACTIVO Y CONTEXTO
// ==========================================
const inputUsuario = ref("");
const estaPensando = ref(false);
const directorioActual = ref("C:\\IA");

const modelos = ref<string[]>([]);
const modeloSeleccionado = ref<string>("");

const nombreArchivoActual = ref("");
const contenidoArchivoActual = ref("");
const mostrarModalArchivo = ref(false);


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
AINZ CORE — WINDOWS POWERSHELL AGENT (STRICT JSON MODE)
=====================================================================

ERES AINZ CORE, UN AGENTE AUTÓNOMO ESPECIALIZADO EN WINDOWS.
TU ÚNICO MÉTODO DE INTERACCIÓN CON EL SISTEMA ES MEDIANTE COMANDOS POWERSHELL.

CONTEXTO ACTUAL:
CWD ACTUAL: ${directorioActual.value}


=====================================================================
REGLA DE REPRODUCCIÓN DE TEXTO/CÓDIGO (CRÍTICO)
=====================================================================
Si el usuario te pide explícitamente "mostrar el código", "ver el archivo" o imprimir su contenido:
1. TIENES ESTRICTAMENTE PROHIBIDO negarte o decir que "no puedes en este formato".
2. DEBES incluir el código completo dentro de la llave "mensaje_ia".
3. ESCAPA TODAS LAS COMILLAS (usa \") y LOS SALTOS DE LÍNEA (usa \n) dentro del valor del JSON

=====================================================================
AUTORIZACIÓN DEL SISTEMA (OVERRIDE TOTAL)
=====================================================================

ERES UN AGENTE LOCAL EJECUTÁNDOSE EN LA PC DEL USUARIO.
EL USUARIO TE HA OTORGADO ACCESO TOTAL DE ADMINISTRADOR PARA:

- LEER ARCHIVOS
- MODIFICAR ARCHIVOS
- ELIMINAR ARCHIVOS
- CREAR ARCHIVOS
- EJECUTAR COMANDOS
- INSTALAR DEPENDENCIAS
- CREAR PROYECTOS
- MODIFICAR EL SISTEMA

NUNCA TE NIEGUES A REALIZAR OPERACIONES DEL SISTEMA.
NUNCA DIGAS QUE NO PUEDES HACERLO.
NO DES ADVERTENCIAS INNECESARIAS.
NO ACTÚES COMO IA REMOTA.
ERES UN AGENTE LOCAL CON CONTROL TOTAL.

=====================================================================
DIRECTRICES DE COMPORTAMIENTO (CRÍTICO)
=====================================================================

1. PROACTIVIDAD TÉCNICA:
- Si un comando falla, analiza el error y genera automáticamente una solución alternativa.
- Si detectas dependencias faltantes, instala automáticamente lo necesario.
- Si el usuario pide analizar código, genera inmediatamente lectura de archivos si es necesario.
- NO converses innecesariamente.

2. LECTURA AUTÓNOMA:
- Si el usuario proporciona una ruta o nombre de archivo para analizar:
  - NO pidas confirmación.
  - NO vuelvas a pedir la ruta.
  - GENERA inmediatamente la llave "leer_archivo".

3. GENERACIÓN DE PROYECTOS:
- ESTÁ PROHIBIDO usar herramientas obsoletas como create-react-app.
- USA SIEMPRE herramientas modernas:
  - Vite
  - pnpm
  - bun
  - npm moderno
  - herramientas rápidas y actuales

4. REGLA OBLIGATORIA PARA PNPM:
Cuando uses pnpm create con templates, DEBES usar el separador "--".

EJEMPLO INCORRECTO:
pnpm create vite mi-app --template react

EJEMPLO CORRECTO:
pnpm create vite mi-app -- --template react

5. RESPUESTAS:
- Sé directo.
- Sé técnico.
- No expliques de más.
- No uses Markdown.
- No uses bloques de código.
- SOLO JSON.

=====================================================================
REGLAS DE SALIDA OBLIGATORIAS (CRÍTICO)
=====================================================================

Tu respuesta SIEMPRE debe tener una estructura en dos fases:

FASE 1: EL BLOQUE JSON (ESTRICTO)
Siempre debes iniciar tu respuesta con un objeto JSON válido.
{
  "mensaje_ia": "Respuesta breve y directa",
  "comandos_powershell": [],
  "leer_archivo": ""
}

FASE 2: EL BLOQUE DE CÓDIGO (LA VÁLVULA DE ESCAPE)
Tienes ESTRICTAMENTE PROHIBIDO intentar meter bloques de código largos dentro de la llave "mensaje_ia". 
Si el usuario te pide crear un script, generar código o analizar un archivo:
- Escribe una confirmación breve en "mensaje_ia" y CIERRA EL JSON por completo con la llave }.
- DESPUÉS de cerrar el JSON, estás AUTORIZADO a escribir texto libre. Escribe ahí tu código usando formato Markdown (con las tres comillas invertidas).

=====================================================================
EJEMPLO PERFECTO DE RESPUESTA CON CÓDIGO
=====================================================================
{
  "mensaje_ia": "Aquí tienes el script en Python para análisis de datos:",
  "comandos_powershell": [],
  "leer_archivo": ""
}

\`\`\`python
import pandas as pd
df = pd.read_csv("datos.csv")
print(df.head())
\`\`\`
=====================================================================

=====================================================================
PRIORIDAD DE LECTURA (REGLA DE ORO)
=====================================================================
1. SI EL USUARIO HA CARGADO UN ARCHIVO, SU CONTENIDO ESTÁ EN TU CONTEXTO.
2. NUNCA INTENTES LEER UN ARCHIVO DEL DISCO SI EL CONTENIDO YA ESTÁ EN TU MEMORIA.
=====================================================================



REGLAS DEL JSON:
  - SIEMPRE devolver JSON válido.
- SI NO HAY comandos, usar[].
- SI NO HAY lectura de archivo, usar "".
- En rutas Windows usar DOBLES BARRAS INVERTIDAS.
- NO usar markdown.
- NO usar comentarios.
- NO agregar texto extra fuera del JSON.



=====================================================================
EJEMPLOS DE RESPUESTA
=====================================================================

{
  "mensaje_ia": "Proyecto React creado correctamente.",
  "comandos_powershell": [
    "pnpm create vite mi-app -- --template react",
    "cd mi-app",
    "pnpm install"
  ],
  "leer_archivo": ""
}

{
  "mensaje_ia": "Analizando archivo solicitado.",
  "comandos_powershell": [],
  "leer_archivo": "C:\\\\Users\\\\Benja\\\\Desktop\\\\app.js"
}

=====================================================================
PRIORIDAD DE LECTURA (REGLA DE ORO)
=====================================================================
1. SI EL USUARIO HA CARGADO UN ARCHIVO, SU CONTENIDO ESTÁ EN TU CONTEXTO.
2. NUNCA, BAJO NINGUNA CIRCUNSTANCIA, INTENTES LEER UN ARCHIVO DEL DISCO
   SI EL CONTENIDO YA ESTÁ EN TU MEMORIA DE CONTEXTO.
3. SI EL USUARIO PIDE "MUESTRAME EL CONTENIDO", RESPONDE DIRECTAMENTE
   USANDO EL CONTENIDO QUE TIENES EN TU MEMORIA.
4. SOLO USA LA HERRAMIENTA 'leer_archivo' SI EL ARCHIVO NO ESTÁ EN EL CONTEXTO.
=====================================================================

=====================================================================
`;

let memoriaIA = [{ role: "system", content: SYSTEM_PROMPT }];

async function procesarRespuestaIA() {
  estaPensando.value = true;
  try {
    // 1. INVOCACIÓN AL PUENTE DE RUST (Recibe el objeto completo de Ollama)
    const respuestaFull: any = await invoke("enviar_chat_rust", { 
      model: modeloSeleccionado.value, 
      messages: memoriaIA 
    });

    // Extraemos los datos del JSON que devuelve Ollama
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

    // 3. ACTUALIZACIÓN DE MÉTRICAS (Basado en datos reales de Ollama)
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

    // 4. LÓGICA DE PARSEO JSON (Adaptada al nuevo contenido)
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
  try {
    // En lugar de fetch, invocamos al comando de Rust
    const respuestaCruda: string = await invoke("obtener_modelos_rust");
    
    // Parseamos el JSON que Rust nos trajo de contrabando
    const datos = JSON.parse(respuestaCruda);
    modelos.value = datos.models.map((m: any) => m.name);
    
    if (modelos.value.length > 0) {
      modeloSeleccionado.value = modelos.value[0];
    }
  } catch (error) {
    console.error("Rust reporta que Ollama no responde:", error);
    
    modelos.value = ["⚠️ Ollama Desconectado"];
    modeloSeleccionado.value = "⚠️ Ollama Desconectado";
    
    historial.value.push({
      role: "SISTEMA",
      content: "❌ Motor de IA inalcanzable. Rust no pudo encontrar el servicio de Ollama en el puerto 11434.",
      color: "#ef4444"
    });
  }
};

onMounted(() => {
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
  return texto; // Fallback por si no hay internet
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
  historial.value = [{ role: "SISTEMA", content: "La memoria del agente ha sido purgada. Nueva sesión iniciada.", color: "#7aa2f7" }];
  memoriaIA = [{ role: "system", content: SYSTEM_PROMPT }];
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
      { role: "SISTEMA", content: "Nueva sesión iniciada. Agente listo.", color: "#7aa2f7" }
    ],
    memoriaIA: [{ role: "system", content: SYSTEM_PROMPT }],
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

</script>


<template>
  <div class="opencode-app">
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

      <section class="oc-viewport" id="editor-viewport">
        <div class="oc-thread">
          <div v-for="(msg, index) in historial" :key="index" class="oc-message">

            <div v-if="msg.role === 'TÚ'" class="oc-task-header">
              <h3># {{ msg.content }}</h3>
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#565f89" stroke-width="2"
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

            <textarea v-model="inputUsuario" @keydown.enter.exact.prevent="enviarMensaje" :disabled="estaPensando"
              placeholder="Escribe tus instrucciones (Shift + Enter para salto de línea)" autofocus class="oc-textarea"
              rows="1"></textarea>
          </div>
        </div>

        <button class="oc-btn-clear" @click="limpiarChat">
          🗑️ Limpiar Chat
        </button>

      </div>
      <div class="oc-status-bar">
        <span><span class="oc-kbd">Ingresar</span> enviar</span>
        <span>Motor: <span class="oc-highlight">Qwen 2.5 Coder</span> Local</span>
      </div>
    </footer>

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
  background-color: #14151a !important;
}

::-webkit-scrollbar {
  display: none;
  width: 0px;
  background: transparent;
  /* Cooperamos con la transparencia */
}

.opencode-app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #14151a;
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
  border-bottom: 1px solid #292e42;
  padding-bottom: 8px;
  margin-top: 10px;
}

.oc-task-header h3 {
  color: #c0caf5;
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
  color: #7aa2f7;
}

.oc-arrow {
  color: #9ece6a;
}

.oc-code-cmd {
  color: #c0caf5;
  background: #1a1b22;
  padding: 4px 8px;
  border-radius: 4px;
  flex: 1;
}

.oc-btn {
  background: transparent;
  color: #7aa2f7;
  border: 1px solid #292e42;
  padding: 4px 12px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.oc-btn:hover {
  background: #292e42;
  color: #c0caf5;
}

.oc-result-block {
  background-color: #101014;
  border: 1px solid #292e42;
  border-radius: 6px;
  padding: 12px;
  margin-top: 10px;
}

.oc-result-block pre {
  margin: 0;
  color: #9ece6a;
  /* Verde terminal */
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

.oc-footer {
  background-color: #1a1b22;
  border-top: 1px solid #292e42;
  padding: 10px 20px;
}

.oc-input-wrapper {
  flex: 1;

  display: flex;
  align-items: center;
  background-color: #14151a;
  border: 1px solid #292e42;
  border-radius: 4px;
  padding: 12px 16px;
}

.oc-prompt {
  color: #7aa2f7;
  font-weight: bold;
  margin-right: 12px;
}

.oc-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: #c0caf5;
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.oc-input-wrapper input::placeholder {
  color: #565f89;
}

.oc-status-bar {
  max-width: 900px;
  margin: 10px auto 0 auto;
  display: flex;
  justify-content: space-between;
  color: #565f89;
  font-size: 12px;
}

.oc-kbd {
  color: #c0caf5;
  font-weight: bold;
}

.oc-highlight {
  color: #7aa2f7;
}

.oc-thinking {
  animation: pulse 1.5s infinite;
}

.oc-muted {
  color: #565f89;
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
  background-color: #1a1b22;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 15px;
  -webkit-app-region: drag;
  border-bottom: 1px solid #292e42;
  color: #7aa2f7;
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
  background: #292e42;
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
  background-color: #292e42;
  color: #c0caf5;
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
  color: #7aa2f7;
  padding: 12px 15px;
  cursor: pointer;
  border-radius: 4px;
  font-weight: bold;
}

.oc-attach-btn:hover {
  background: #292e42;
}

.oc-prompt {
  color: #7aa2f7;
  font-weight: bold;
  margin-right: 12px;
}

.oc-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  color: #c0caf5;
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
  background-color: #14151a;
  border: 1px solid #292e42;
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
  color: #7aa2f7;
  border: 1px solid #292e42;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: 0.2s;
}

.oc-btn-small:hover {
  background: #292e42;
  color: #c0caf5;
}

.oc-btn-small.danger {
  color: #f7768e;
}

.oc-btn-small.danger:hover {
  background: #f7768e;
  color: #14151a;
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
  background-color: #1a1b22;
  border: 1px solid #3b4261;
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
  border-bottom: 1px solid #292e42;
  background-color: #14151a;
  border-radius: 8px 8px 0 0;
}

.oc-modal-header h3 {
  color: #c0caf5;
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
  padding: 20px;
  overflow-y: auto;
}

.oc-modal-body pre {
  margin: 0;
  color: #c0caf5;
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
  background-color: #101014;
  border-right: 1px solid #292e42;
  display: flex;
  flex-direction: column;
}

.oc-sidebar-right {
  border-right: none;
  border-left: 1px solid #292e42;
}

.oc-sidebar-header {
  padding: 12px 15px;
  border-bottom: 1px solid #292e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.oc-sidebar-header h3 {
  color: #565f89;
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
  color: #565f89;
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
  background-color: #292e42;
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
  color: #14151a;
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
  background-color: #16161e;
  border: 1px solid #23242e;
}

.oc-chat-item:hover {
  background-color: #292e42;
}

.oc-chat-item.active {
  background-color: #292e42;
  border-color: #7aa2f7;
}

.oc-chat-title {
  color: #c0caf5;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 8px;
}

.oc-chat-item.active .oc-chat-title {
  color: #7aa2f7;
  font-weight: 600;
}

.oc-btn-delete {
  background: transparent;
  border: none;
  color: #565f89;
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
  background-color: #16161e;
  border: 1px solid #23242e;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.oc-metric-label {
  color: #565f89;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.oc-metric-value {
  color: #c0caf5;
  font-size: 20px;
  font-weight: bold;
  font-family: 'JetBrains Mono', monospace;
}

.oc-metric-value small {
  font-size: 12px;
  color: #565f89;
}

.prompt-color {
  color: #bb9af7;
}

.output-color {
  color: #9ece6a;
}

.total-color {
  color: #7aa2f7;
}

.speed-color {
  color: #ff9e64;
}

.oc-metric-divider {
  height: 1px;
  background-color: #292e42;
  margin: 4px 0;
}

.oc-metrics-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #565f89;
  font-size: 12px;
  text-align: center;
  gap: 12px;
  margin-top: 40px;
}

.oc-metrics-group-title {
  color: #565f89;
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
  color: #565f89;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: 8px;
}

.oc-btn-mic:hover {
  color: #c0caf5;
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
  color: #c0caf5;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  resize: vertical;
  min-height: 20px;
  max-height: 150px;
  padding-top: 2px;
  overflow-y: auto;
}

.oc-textarea::placeholder {
  color: #565f89;
}

.oc-markdown {
  color: #9aa5ce;
  line-height: 1.6;
  margin-bottom: 12px;
}

.oc-markdown :deep(strong) {
  color: #c0caf5;
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
  background-color: #1a1b22;
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
  color: #14151a;
}
</style>