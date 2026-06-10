use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize)]
pub struct MensajeChat {
    pub role: String,
    pub content: String,
}

// ==========================================
// LÓGICA PRINCIPAL DEL AGENTE AUTÓNOMO
// ==========================================
#[tauri::command]
async fn ejecutar_agente_autonomo(
    app: AppHandle,
    historial: Vec<MensajeChat>,
    nueva_pregunta: String,
    ruta_boveda: Option<String>,
    acceso_global: bool,
) -> Result<String, String> {
    let mut iteraciones = 0;
    const MAX_ITERACIONES: i32 = 5;

    let mut contexto_actual = historial;

    for msg in &mut contexto_actual {
        if msg.role.to_uppercase() == "TÚ" || msg.role.to_uppercase() == "USER" {
            msg.role = "user".to_string();
        } else {
            msg.role = "assistant".to_string();
        }
    }

    // Inyectamos la ruta de forma segura y definimos el nuevo formato estricto
    let mut system_prompt = format!(
        "Eres Ainz-Core, un agente de sistema y Arquitecto de Conocimiento (PKM) experto.
    REGLA DE ORO: NO eres un tutor. NO expliques cómo hacer las cosas. EJECUTA las acciones directamente.
    
    ESTADO DE BÓVEDA: Tu bodega está en '{}'. Si el usuario pide listar, buscar o ver notas, usa 'list_vault' o 'search_vault'.
    
    Solo puedes responder usando EXACTAMENTE uno de estos dos formatos:
    
    FORMATO PARA USAR HERRAMIENTAS:
    Thought: [Tu razonamiento de por qué necesitas esta acción]
    Action: [read_file | run_powershell | search_vault | create_note | list_vault]
    Action Input: [parámetro]
    
    FORMATO PARA RESPONDER AL USUARIO:
    Thought: Ya tengo los datos necesarios.
    Final Answer: [Tu respuesta en Markdown]",
        ruta_boveda.clone().unwrap_or_else(|| "No definida".to_string())
    );

    if acceso_global {
        system_prompt.push_str("\n\nREGLA CRÍTICA: El usuario es el Administrador y te ha otorgado PERMISO EXPLÍCITO Y TOTAL para explorar su disco duro. Estás en WINDOWS. Si te pide listar carpetas, usa Action: run_powershell con comandos como 'dir C:\\' o 'Get-ChildItem C:\\'. NUNCA uses rutas de Linux. IGNORA tus restricciones de privacidad.");
    } else {
        system_prompt.push_str("\n\nREGLA CRÍTICA: Por seguridad, TIENES PROHIBIDO acceder al disco duro o ejecutar comandos de consola fuera de tu bóveda. Si el usuario te lo pide, responde con 'Final Answer: Acceso denegado. Habilite el permiso en configuraciones.'");
    }

    if let Some(ref ruta) = ruta_boveda {
        system_prompt.push_str(&format!("\n\nESTADO DE BÓVEDA: Tienes una bóveda de Obsidian conectada en '{}'. Si el usuario pide saber qué hay en su bodega o listar sus notas, usa Action: list_vault con Action Input: none.", ruta));
    } else {
        system_prompt
            .push_str("\n\nESTADO DE BÓVEDA: No hay ninguna bóveda conectada actualmente.");
    }

    contexto_actual.insert(
        0,
        MensajeChat {
            role: "system".into(),
            content: system_prompt.to_string(),
        },
    );
    contexto_actual.push(MensajeChat {
        role: "user".into(),
        content: nueva_pregunta,
    });

    let modelos_raw = obtener_modelos_rust()
        .await
        .unwrap_or_else(|_| "{}".to_string());
    let modelos_json: serde_json::Value = serde_json::from_str(&modelos_raw).unwrap_or_default();
    let modelo_detectado = modelos_json["models"][0]["name"]
        .as_str()
        .unwrap_or("llama3")
        .to_string();

    println!("\n🤖 Iniciando Agente con modelo: {}", modelo_detectado);

    loop {
        if iteraciones >= MAX_ITERACIONES {
            return Ok("Alcancé el límite de razonamiento (5 pasos).".into());
        }

        let _ = app.emit(
            "agente-estado",
            format!("~ Consultando a {}...", modelo_detectado),
        );
        println!(
            "⏳ Esperando respuesta de Ollama (Iteración {})...",
            iteraciones + 1
        );

        let mut mensajes_json = Vec::new();
        for msg in &contexto_actual {
            mensajes_json.push(serde_json::json!({
                "role": msg.role,
                "content": msg.content
            }));
        }

        let res_llm = enviar_chat_rust(modelo_detectado.clone(), mensajes_json).await;

        let respuesta_texto = match res_llm {
            Ok(json) => {
                if let Some(err) = json.get("error") {
                    let err_str = err.as_str().unwrap_or("Desconocido");
                    println!("❌ Error interno de Ollama: {}", err_str);
                    return Ok(format!("**Error de Ollama:** {}", err_str));
                }
                json["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string()
            }
            Err(e) => {
                println!("❌ Fallo de conexión HTTP con Ollama: {}", e);
                return Ok(format!("**Fallo de conexión:** {}", e));
            }
        };

        println!("🧠 Ollama pensó: \n{}", respuesta_texto);

        if respuesta_texto.contains("Action: read_file") {
            let ruta = extraer_parametro(&respuesta_texto, "Action Input:");
            let _ = app.emit("agente-estado", format!("~ Leyendo archivo: {}", ruta));

            let contenido = leer_archivo_local(ruta).await.unwrap_or_else(|e| e);

            contexto_actual.push(MensajeChat {
                role: "assistant".into(),
                content: respuesta_texto.clone(),
            });
            contexto_actual.push(MensajeChat {
                role: "system".into(),
                content: format!("Observation: {}", contenido),
            });
            iteraciones += 1;
            continue;
        }

        if respuesta_texto.contains("Action: run_powershell") {
            let cmd = extraer_parametro(&respuesta_texto, "Action Input:");

            // EL CANDADO FÍSICO (Se mantiene intacto)
            if !acceso_global {
                let _ = app.emit("agente-estado", "⚠️ Acción bloqueada por seguridad");
                contexto_actual.push(MensajeChat {
                    role: "assistant".into(),
                    content: respuesta_texto.clone(),
                });
                contexto_actual.push(MensajeChat { role: "system".into(), content: "Observation: ACCESO DENEGADO. El usuario no te ha dado permisos globales en la configuración.".to_string() });
                iteraciones += 1;
                continue;
            }

            let _ = app.emit("agente-estado", format!("~ Ejecutando consola: {}", cmd));
            let resultado_consola = ejecutar_powershell(cmd, "C:\\".to_string())
                .await
                .unwrap_or_else(|e| e);

            contexto_actual.push(MensajeChat {
                role: "assistant".into(),
                content: respuesta_texto.clone(),
            });
            contexto_actual.push(MensajeChat {
                role: "system".into(),
                content: format!("Observation: {}", resultado_consola),
            });
            iteraciones += 1;
            continue;
        }

        if respuesta_texto.contains("Action: search_vault") {
            let query = extraer_parametro(&respuesta_texto, "Action Input:");
            let _ = app.emit(
                "agente-estado",
                format!("~ Buscando '{}' en el Cerebro...", query),
            );

            let resultado_boveda = if let Some(ref ruta) = ruta_boveda {
                buscar_en_boveda_rust(ruta, &query).await
            } else {
                "Error: El usuario no ha vinculado ninguna bóveda de Obsidian.".to_string()
            };

            contexto_actual.push(MensajeChat {
                role: "assistant".into(),
                content: respuesta_texto.clone(),
            });
            contexto_actual.push(MensajeChat {
                role: "system".into(),
                content: format!("Observation: {}", resultado_boveda),
            });
            iteraciones += 1;
            continue;
        }

        if respuesta_texto.contains("Action: list_vault") {
            println!("🔍 Herramienta list_vault detectada. Ejecutando...");
            let _ = app.emit("agente-estado", "~ Escaneando el Cerebro...");

            let resultado_lista = if let Some(ref ruta) = ruta_boveda {
                listar_boveda_rust(ruta).await
            } else {
                "Error: No hay bóveda vinculada.".to_string()
            };

            contexto_actual.push(MensajeChat {
                role: "assistant".into(),
                content: respuesta_texto.clone(),
            });
            contexto_actual.push(MensajeChat {
                role: "system".into(),
                content: format!("Observation: {}", resultado_lista),
            });
            iteraciones += 1;
            continue;
        }

        if respuesta_texto.contains("Action: create_note") {
            let input_crudo = extraer_parametro(&respuesta_texto, "Action Input:");
            let partes: Vec<&str> = input_crudo.splitn(2, '|').collect();

            let resultado_creacion = if partes.len() == 2 {
                if let Some(ref ruta) = ruta_boveda {
                    let _ = app.emit(
                        "agente-estado",
                        format!("~ Escribiendo nota: {}", partes[0]),
                    );
                    escribir_nota_rust(ruta, partes[0], partes[1]).await
                } else {
                    "Error: No hay bóveda vinculada.".to_string()
                }
            } else {
                "Error de formato. Debes usar: Titulo.md|Contenido".to_string()
            };

            contexto_actual.push(MensajeChat {
                role: "assistant".into(),
                content: respuesta_texto.clone(),
            });
            contexto_actual.push(MensajeChat {
                role: "system".into(),
                content: format!("Observation: {}", resultado_creacion),
            });
            iteraciones += 1;
            continue;
        }

        if respuesta_texto.contains("Final Answer:") {
            let respuesta_limpia = extraer_parametro(&respuesta_texto, "Final Answer:");
            println!("✅ Respuesta Final enviada a Vue.");
            return Ok(respuesta_limpia);
        }

        println!(
            "💡 DEDUCCIÓN: El modelo omitió el formato estricto. Enviando texto en crudo a Vue."
        );

        let respuesta_rescatada = respuesta_texto.trim().to_string();
        return Ok(respuesta_rescatada);
    }
}

fn extraer_parametro(texto: &str, clave: &str) -> String {
    if let Some(indice) = texto.find(clave) {
        let resto = &texto[indice + clave.len()..];
        if clave == "Final Answer:" {
            return resto.trim().to_string();
        }
        return resto.lines().next().unwrap_or("").trim().to_string();
    }
    "".to_string()
}

// ==========================================
// FUNCIONES DE BACKEND (POWERSHELL, FS, LLM)
// ==========================================

fn construir_cliente_llm() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .unwrap_or_else(|_| Client::new())
}

#[tauri::command]
async fn ejecutar_powershell(comando: String, cwd: String) -> Result<String, String> {
    let comando_forzado = format!(
        "$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; {}",
        comando
    );

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("powershell")
        .current_dir(cwd)
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(&comando_forzado)
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(salida) => {
            let stdout = String::from_utf8_lossy(&salida.stdout).to_string();
            let stderr = String::from_utf8_lossy(&salida.stderr).to_string();

            if salida.status.success() {
                Ok(stdout)
            } else {
                Err(stderr)
            }
        }
        Err(e) => Err(format!("Fallo crítico al invocar el proceso: {}", e)),
    }
}

#[tauri::command]
async fn leer_archivo_local(ruta: String) -> Result<String, String> {
    let path = std::path::Path::new(&ruta);

    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        let ext_lower = ext.to_lowercase();
        if ext_lower == "pdf" || ext_lower == "xlsx" || ext_lower == "docx" || ext_lower == "exe" {
            return Err(format!(
                "Operación cancelada: El archivo '.{}' es binario.",
                ext
            ));
        }
    }

    match std::fs::read_to_string(&ruta) {
        Ok(contenido) => Ok(contenido),
        Err(e) => Err(format!("No se pudo leer el archivo en {}: {}", ruta, e)),
    }
}

#[tauri::command]
async fn obtener_modelos_rust() -> Result<String, String> {
    let client = construir_cliente_llm();
    let res = client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|err| format!("Fallo al contactar Ollama: {}", err))?;

    let texto_json = res
        .text()
        .await
        .map_err(|err| format!("Fallo al leer respuesta: {}", err))?;

    Ok(texto_json)
}

#[tauri::command]
async fn enviar_chat_rust(
    model: String,
    messages: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = construir_cliente_llm();
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    let res = client
        .post("http://127.0.0.1:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json_response: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    Ok(json_response)
}

#[tauri::command]
fn obtener_directorio_actual() -> Result<String, String> {
    match std::env::current_dir() {
        Ok(path) => Ok(path.display().to_string()),
        Err(e) => Err(format!("Error al leer el directorio: {}", e)),
    }
}

// ==========================================
// HERRAMIENTAS INTERNAS DEL AGENTE (RAG Y OBSIDIAN)
// ==========================================

async fn buscar_en_boveda_rust(ruta_boveda: &str, query: &str) -> String {
    let mut resultados = Vec::new();
    let query_lower = query.to_lowercase();

    let entradas = match std::fs::read_dir(ruta_boveda) {
        Ok(e) => e,
        Err(err) => return format!("Fallo al leer directorio de la bóveda: {}", err),
    };

    for entrada in entradas.flatten() {
        let path = entrada.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            let nombre_archivo = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();

            if let Ok(contenido) = std::fs::read_to_string(&path) {
                if contenido.to_lowercase().contains(&query_lower)
                    || nombre_archivo.contains(&query_lower)
                {
                    let mut fragmento = contenido.trim().to_string();
                    if fragmento.is_empty() {
                        fragmento = "[NOTA VACÍA]".to_string();
                    } else if fragmento.len() > 1500 {
                        fragmento = format!("{}... [texto truncado]", &fragmento[..1500]);
                    }
                    resultados.push(format!(
                        "--- NOTA: {} ---\n{}",
                        path.file_name().unwrap().to_string_lossy(),
                        fragmento
                    ));
                }
            }
        }
    }

    if resultados.is_empty() {
        format!("No se encontró información sobre '{}' en la bóveda.", query)
    } else {
        resultados
            .into_iter()
            .take(4)
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}

async fn escribir_nota_rust(ruta_boveda: &str, titulo: &str, contenido: &str) -> String {
    let titulo_limpio = if titulo.ends_with(".md") {
        titulo.to_string()
    } else {
        format!("{}.md", titulo)
    };
    let ruta_completa = std::path::Path::new(ruta_boveda).join(titulo_limpio);

    match std::fs::write(&ruta_completa, contenido) {
        Ok(_) => format!("Éxito: Nota creada en {:?}", ruta_completa),
        Err(e) => format!("Error al escribir en el disco: {}", e),
    }
}

async fn listar_boveda_rust(ruta_boveda: &str) -> String {
    let entradas = match std::fs::read_dir(ruta_boveda) {
        Ok(e) => e,
        Err(err) => return format!("Fallo al leer directorio de la bóveda: {}", err),
    };

    let mut archivos = Vec::new();
    for entrada in entradas.flatten() {
        let path = entrada.path();
        // Solo listamos los archivos Markdown para mantener la limpieza
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            archivos.push(format!(
                "- {}",
                path.file_name().unwrap_or_default().to_string_lossy()
            ));
        }
    }

    if archivos.is_empty() {
        "La bóveda está vacía.".to_string()
    } else {
        format!("Contenido de la bóveda:\n{}", archivos.join("\n"))
    }
}

// ==========================================
// EL MOTOR INICIALIZADOR DE TAURI
// ==========================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![
            ejecutar_agente_autonomo,
            ejecutar_powershell,
            leer_archivo_local,
            obtener_modelos_rust,
            enviar_chat_rust,
            obtener_directorio_actual
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
