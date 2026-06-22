# ⚡ Ainz Core

Un **Agente Autónomo Local-First** especializado en Windows, construido con una arquitectura híbrida de alto rendimiento. Diseñado bajo el patrón ReAct (Reasoning and Acting), Ainz Core planifica, ejecuta herramientas y toma decisiones en un bucle autónomo sin depender de APIs en la nube.

## 🏗️ Arquitectura del Proyecto

El sistema divide estrictamente las responsabilidades entre la capa de presentación y el motor cognitivo:

* **Frontend (Vue.js 3 + TypeScript):** Interfaz conversacional fluida, renderizado de Markdown, telemetría de tokens en tiempo real e inyección dinámica para extracción de documentos.
* **Backend Orquestador (Rust / Tauri):** Motor autónomo ReAct que maneja el ciclo de vida del agente (hasta 5 iteraciones lógicas por tarea). Aislamiento de seguridad, ejecución nativa y puente de herramientas.
* **Cerebro (IA):** Integración nativa con la API de Ollama (Optimizado para `qwen2.5-coder`).

## 🧰 Herramientas Integradas (Agent Skills)

El modelo de lenguaje tiene acceso nativo a las siguientes capacidades a través del backend en Rust:
* **Gestión de Archivos y SO:** Ejecución silenciosa de PowerShell (`run_powershell`) y lectura/escritura en el disco (`read_file`).
* **Integración Obsidian (El Cerebro):** Búsqueda semántica, listado, creación y actualización de notas locales (`search_vault`, `Notes`, `update_note`).
* **Comunicaciones:** Lectura de bandeja de entrada vía IMAP y envío de correos vía SMTP (`read_emails`, `send_email`).
* **Investigación Externa:** Extracción de contenido web crudo (`fetch_web`).
* **Telemetría:** Monitoreo en tiempo real de RAM y CPU.

## 🚀 Requisitos Previos

1. [Node.js](https://nodejs.org/) (v18 o superior) y estrictamente **[pnpm](https://pnpm.io/)** como gestor de paquetes.
2. [Rust](https://www.rust-lang.org/tools/install) y las dependencias de compilación de Windows (Visual Studio C++ Build Tools).
3. [Ollama](https://ollama.com/) ejecutándose localmente.

### Modelo de IA Recomendado
Para soportar el razonamiento del bucle ReAct sin alucinaciones de formato, es obligatorio usar un modelo con alta capacidad de *tool-use*:
```bash
ollama pull qwen2.5-coder:14b
(Nota: Requiere al menos 10GB de VRAM libre. Para equipos con menos recursos, usar la versión 7b).

🛠️ Instalación y Desarrollo
Clona este repositorio:
Bash
git clone [https://github.com/TU-USUARIO/ainz-core.git](https://github.com/TU-USUARIO/ainz-core.git)
cd ainz-core
Instala las dependencias:

Bash
pnpm install
Inicia el entorno de desarrollo (con recarga en caliente):

Bash
pnpm tauri dev