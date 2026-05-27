# ⚡ Ainz Core

Un agente autónomo local-first especializado en Windows, construido con una arquitectura híbrida de alto rendimiento. Diseñado para ejecutar comandos de PowerShell, analizar código y extraer texto de documentos complejos (PDFs) en tiempo real mediante modelos de lenguaje locales.

## 🏗️ Arquitectura del Proyecto

* **Frontend:** Vue.js 3 + TypeScript (Interfaz reactiva, renderizado de Markdown, Web Speech API).
* **Backend:** Rust / Tauri (Interacción nativa con el OS, ejecución silenciosa de PowerShell, manejo seguro de binarios).
* **Cerebro (IA):** Integración nativa con la API local de Ollama (Optimizado para `qwen2.5-coder`).
* **Procesamiento de Documentos:** Inyección dinámica de PDF.js para extracción de texto estructurado en el cliente.

## 🚀 Requisitos Previos

Antes de compilar el proyecto, asegúrate de tener instalados los siguientes componentes en tu máquina:

1. [Node.js](https://nodejs.org/) (v18 o superior) y tu gestor de paquetes preferido (npm, pnpm, o yarn).
2. [Rust](https://www.rust-lang.org/tools/install) y las dependencias de compilación de Windows (Visual Studio C++ Build Tools).
3. [Ollama](https://ollama.com/) ejecutándose localmente.

### Modelo de IA Recomendado
Para un rendimiento óptimo, asegúrate de descargar el modelo local de Qwen:
\`\`\`bash
ollama pull qwen2.5-coder:14b
\`\`\`
*(Nota: Requiere al menos 10GB de VRAM libre. Para equipos con menos recursos, usar la versión `7b`).*

## 🛠️ Instalación y Desarrollo

1. Clona este repositorio:
\`\`\`bash
git clone https://github.com/TU-USUARIO/ainz-core.git
cd ainz-core
\`\`\`

2. Instala las dependencias del frontend:
\`\`\`bash
npm install
\`\`\`

3. Inicia el entorno de desarrollo de Tauri:
\`\`\`bash
npm run tauri dev
\`\`\`

## 📦 Compilación para Producción

Para compilar un ejecutable `.exe` optimizado para Windows:
\`\`\`bash
npm run tauri build
\`\`\`
El instalador final se generará en la ruta: `src-tauri/target/release/bundle/`.