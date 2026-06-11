
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
  // TELEMETRÍA Y COOKBOOK DE MODELOS
  // ==========================================
  interface Telemetria {
    os: string;
    cpu: string;
    ram_total_gb: number;
    ram_libre_gb: number;
  }

  const telemetriaHardware = ref<Telemetria | null>(null);

  // Nuestra base de datos curada de modelos
  const catalogoModelos = [
    { id: "qwen2.5-coder:1.5b", reqRam: 4, params: "1.5B", desc: "Ultraligero. Ideal para máquinas con 8GB de RAM o menos. Rápido pero menos profundo." },
    { id: "llama3.2:3b", reqRam: 6, params: "3B", desc: "El equilibrio perfecto para portátiles modernos. Razonamiento sólido." },
    { id: "qwen2.5-coder:7b", reqRam: 8, params: "7B", desc: "Estándar actual. Excelente para tareas de sistema y código." },
    { id: "llama3:8b", reqRam: 12, params: "8B", desc: "Modelo robusto de uso general. Requiere al menos 16GB de RAM recomendados." },
    { id: "command-r:35b", reqRam: 24, params: "35B", desc: "Masivo. Nivel experto corporativo. Solo para bestias con 32GB+ de RAM." }
  ];

  const modelosRecomendados = ref<any[]>([]);

  const escanearHardware = async () => {
    try {
      telemetriaHardware.value = await invoke('obtener_telemetria_hardware');
      if (telemetriaHardware.value) {
        const ramUsuario = telemetriaHardware.value.ram_total_gb;
        modelosRecomendados.value = catalogoModelos.map(modelo => ({
          ...modelo,
          compatible: ramUsuario >= modelo.reqRam,
          sugerido: ramUsuario >= modelo.reqRam && ramUsuario < (modelo.reqRam * 2.5)
        }));
      }
    } catch (error) {
      console.error("Fallo al escanear hardware:", error);
    }
  };

  onMounted(async () => {
    await escanearHardware();
  });



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
  const tabActivaConfig = ref<'apariencia' | 'motor' | 'cerebro' | 'correo' | 'actualizaciones' | 'acerca' | 'permisos'>('apariencia');
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
            throw new Error("El PDF parece estar vacío o ser solo imágenes sin OCR.");
          }

          contenidoArchivoActual.value = textoCompletoPdf;

          // AQUÍ ESTÁ LA MAGIA: Enviamos el PDF al mismo flujo unificado del chat
          inputUsuario.value = `He cargado el documento PDF [${nombre}]. El texto extraído es el siguiente:\n\n${textoCompletoPdf}\n\nAnaliza este contenido detalladamente y confirma que estás listo para responder preguntas sobre él.`;
          await enviarMensaje();

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
    nombreArchivoActual: string;
    contenidoArchivoActual: string;
    metricas?: MetricasOllama;
  }

  const sincronizarChatActual = () => {
    const chat = listaChats.value.find(c => c.id === idChatActivo.value);
    if (chat) {
      chat.historial = historial.value;
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
      nombreArchivoActual: "",
      contenidoArchivoActual: ""
    };
    listaChats.value.unshift(nuevaSesion);
    idChatActivo.value = nuevoId;

    historial.value = nuevaSesion.historial;
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
      historial.value = chat.historial; // Vue carga los mensajes visuales
      // NO hay memoriaIA aquí. Rust recibirá este 'historial' al enviar un mensaje.
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
    telemetriaHardware,
    modelosRecomendados,
  

    // Funciones
    enviarMensaje,
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
    escanearHardware,
    buscarEnBoveda,





    // agrega cualquier otra que uses en el template
  };
}
