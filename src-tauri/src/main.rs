#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::os::windows::process::CommandExt;

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

            if salida.status.success() { Ok(stdout) } else { Err(stderr) }
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
                "Operación cancelada en Backend: El archivo '.{}' es binario estructurado. Por favor, cárgalo arrastrándolo directamente a la interfaz visual del chat para activar el extractor correspondiente.", 
                ext
            ));
        }
    }

    match std::fs::read_to_string(&ruta) {
        Ok(contenido) => Ok(contenido),
        Err(e) => Err(format!("No se pudo leer el archivo en {}: {}", ruta, e)),
    }
}

use tauri::command;
use reqwest::Client;

// Definimos el comando asíncrono que Vue podrá llamar
#[command]
async fn obtener_modelos_rust() -> Result<String, String> {
    // Rust crea un cliente HTTP nativo (ignora el CORS por completo)
    let client = Client::new();
    
    // Hacemos la petición directamente a la IP local de Ollama
    let res = client.get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|err| format!("Fallo al contactar Ollama: {}", err))?;

    // Extraemos el texto JSON en crudo
    let texto_json = res.text().await.map_err(|err| format!("Fallo al leer respuesta: {}", err))?;
    
    Ok(texto_json)
}

#[command]
async fn enviar_chat_rust(model: String, messages: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    let client = Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false
    });

    let res = client.post("http://127.0.0.1:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json_response: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    // Devolvemos el JSON completo para que Vue pueda extraer el mensaje Y las métricas
    Ok(json_response)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ejecutar_powershell, leer_archivo_local, obtener_modelos_rust, enviar_chat_rust])
        .run(tauri::generate_context!())
        .expect("Error crítico al iniciar Ainz Core");
}


