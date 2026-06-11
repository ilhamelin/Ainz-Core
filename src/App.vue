<script setup lang="ts">
import { useAppLogic } from './composables/useAppLogic';

// Usamos toda la lógica
const {
  inputUsuario,
  estaPensando,
  historial,
  directorioActual,
  modeloSeleccionado,
  modelos,
  estadoAgente,
  temaActual,
  permisoAccesoGlobal,
  crearNuevoChat,
  idChatActivo,
  minimizarVentana,
  cerrarVentana,
  seleccionarChat,
  eliminarChat,
  procesarContenido,
  renderizarMarkdown,
  copiarAlPortapapeles,
  verificarPosicionScroll,
  toggleDictado,
  escuchandoVoz,
  ajustarAltura,
  manejarArchivo,
  fileInput,
  limpiarChat,
  metricasActuales,
  nombreArchivoActual,
  contenidoArchivoActual,
  expulsarArchivoMemoria,
  limpiarArchivoActual,
  vincularBoveda,
  listaChats,
  rutaBoveda,
  notasCargadas,
  estadoConexion,
  reconectarOllama,
  temasDisponibles,
  cambiarTema,
  fuentesDisponibles,
  fuenteSeleccionada,
  cambiarFuente,
  tabActivaConfig,
  appVersion,
  estadoActualizacion,
  versionNueva,
  verificarActualizaciones,
  aplicarActualizacion,
  mostrarConfiguracion,
  mostrarModalArchivo,
  enviarMensaje,


} = useAppLogic();
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


              <div v-if="msg.resultado" class="oc-result-block">
                <pre>{{ msg.resultado }}</pre>
              </div>
            </div>
          </div>

          <div v-if="estaPensando" class="oc-agent-block oc-thinking">
            <span class="oc-muted">{{ estadoAgente }}</span>
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
              🎨 Apariencia y Tipografia
            </button>
            <button :class="{ active: tabActivaConfig === 'permisos' }" @click="tabActivaConfig = 'permisos'">
              🛡️ Permisos de Sistema
            </button>
            <button :class="{ active: tabActivaConfig === 'motor' }" @click="tabActivaConfig = 'motor'">
              🧠 Motor IA
            </button>
            <button :class="{ active: tabActivaConfig === 'cerebro' }" @click="tabActivaConfig = 'cerebro'">
              🧠 Segundo Cerebro
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

              <div style="margin-top: 30px;">
                <h4 class="settings-title">Tipografía</h4>
                <p class="settings-desc">Elige la fuente que mejor se adapte a tu lectura.</p>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
                  <div v-for="fuente in fuentesDisponibles" :key="fuente.nombre" @click="cambiarFuente(fuente.valor)"
                    class="theme-card" :class="{ 'selected': fuenteSeleccionada === fuente.valor }"
                    :style="{ fontFamily: fuente.valor }">
                    {{ fuente.nombre }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="tabActivaConfig === 'permisos'" class="settings-view">
              <h4 class="settings-title">Acceso Global al Ordenador</h4>
              <p class="settings-desc">Permite que Ainz-Core ejecute comandos y lea cualquier archivo fuera de su bóveda. Actívalo solo si confías en el modelo local.</p>
              
              <div class="connection-card" style="margin-top: 15px;">
                <label style="display: flex; align-items: center; gap: 15px; cursor: pointer; padding: 10px;">
                  <input type="checkbox" v-model="permisoAccesoGlobal" style="width: 20px; height: 20px; accent-color: var(--accent-primary);">
                  <div style="display: flex; flex-direction: column;">
                    <strong style="color: var(--text-main);">Otorgar acceso total al sistema</strong>
                    <span style="font-size: 12px; color: var(--text-muted);">Si está desactivado, el agente bloqueará los comandos de consola por seguridad.</span>
                  </div>
                </label>
              </div>
            </div>

            <div v-if="tabActivaConfig === 'cerebro'" class="settings-view">
              <h4 class="settings-title">Integración con Obsidian</h4>
              <p class="settings-desc">
                Vincula tu bóveda local para que Ainz Core pueda leer, razonar y estructurar tus notas de forma privada.
              </p>

              <div class="connection-card" style="margin-top: 15px;">
                <div class="connection-status">
                  <div class="status-dot" :class="rutaBoveda ? 'conectado' : 'desconectado'"></div>
                  <div>
                    <div class="status-text">
                      {{ rutaBoveda ? 'Bóveda Conectada' : 'Bóveda No Vinculada' }}
                    </div>
                    <div v-if="rutaBoveda"
                      style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-family: var(--font-family-main);">
                      <strong>Ruta:</strong> {{ rutaBoveda }} <br>
                      <strong>Nodos indexados:</strong> {{ notasCargadas.length }} archivos .md detectados.
                    </div>
                  </div>
                </div>

                <button class="oc-btn-settings-action" @click="vincularBoveda">
                  <span v-if="!rutaBoveda">📁 Seleccionar Carpeta</span>
                  <span v-else>🔄 Cambiar Bóveda</span>
                </button>
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
                    <template v-if="estadoActualizacion === 'inactivo'">Sistema Operativo</template>
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
                  <p style="color: var(--text-muted); margin: 5px 0;">Versión {{ appVersion }}</p>
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

<style scoped src="./assets/css/app.css"></style>