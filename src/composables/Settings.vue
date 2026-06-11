<script setup>
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const config = ref({
  email: '',
  token: '',
  imap_server: 'imap.gmail.com',
  smtp_server: 'smtp.gmail.com'
});

async function guardarConfiguracion() {
  try {
    await invoke('salvar_configuracion', { config: config.value });
    alert('¡Configuración guardada de forma segura!');
  } catch (err) {
    console.error('Error al guardar:', err);
  }
}
</script>