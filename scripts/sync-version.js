import { readFileSync, writeFileSync, existsSync } from 'fs';

try {
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
  const tauriConfPath = './src-tauri/tauri.conf.json';

  if (!existsSync(tauriConfPath)) {
    console.error("Error: tauri.conf.json no encontrado.");
    process.exit(1);
  }

  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  
  // Solo actualizamos si la versión es diferente para evitar escrituras innecesarias
  if (tauriConf.version !== packageJson.version) {
    tauriConf.version = packageJson.version;
    writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));
    console.log(`✅ Versión sincronizada: ${packageJson.version}`);
  }
} catch (error) {
  console.error("❌ Fallo en la sincronización de versiones:", error);
  process.exit(1);
}