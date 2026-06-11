<template>
  <form @submit.prevent="guardarConfiguracion" class="mail-settings-form">
    <div class="settings-form-group">
      <label class="settings-label">Correo Electrónico</label>
      <input 
        v-model="config.email" 
        type="email" 
        placeholder="ejemplo@correo.com" 
        class="settings-input"
        required 
      />
    </div>

    <div class="settings-form-group">
      <label class="settings-label">Contraseña de Aplicación / Token</label>
      <input 
        v-model="config.token" 
        type="password" 
        placeholder="••••••••••••••••" 
        class="settings-input"
        required 
      />
      <span class="settings-input-help">Si usas Gmail, debes generar una contraseña de aplicación de 16 dígitos en tu cuenta de Google.</span>
    </div>

    <div class="settings-form-row">
      <div class="settings-form-group flex-1">
        <label class="settings-label">Servidor IMAP</label>
        <input 
          v-model="config.imap_server" 
          type="text" 
          placeholder="imap.gmail.com" 
          class="settings-input"
          required 
        />
      </div>

      <div class="settings-form-group flex-1">
        <label class="settings-label">Servidor SMTP</label>
        <input 
          v-model="config.smtp_server" 
          type="text" 
          placeholder="smtp.gmail.com" 
          class="settings-input"
          required 
        />
      </div>
    </div>

    <div style="margin-top: 20px;">
      <button type="submit" :disabled="guardando" class="oc-btn-settings-action mail-btn-submit">
        {{ guardando ? 'Guardando...' : '💾 Guardar Configuración' }}
      </button>
    </div>

    <div v-if="mensaje" :class="['status-toast', mensaje.tipo]">
      {{ mensaje.texto }}
    </div>
  </form>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const config = ref({
  email: '',
  token: '',
  imap_server: 'imap.gmail.com',
  smtp_server: 'smtp.gmail.com'
});

const guardando = ref(false);
const mensaje = ref(null);

onMounted(async () => {
  try {
    const configGuardada = await invoke('cargar_configuracion');
    if (configGuardada) {
      config.value = configGuardada;
    }
  } catch (error) {
    console.log('Sin configuración de correo previa detectada.');
  }
});

async function guardarConfiguracion() {
  guardando.value = true;
  mensaje.value = null;
  try {
    await invoke('salvar_configuracion', { 
      config: {
        email: config.value.email,
        token: config.value.token,
        imap_server: config.value.imap_server,
        smtp_server: config.value.smtp_server
      } 
    });
    mensaje.value = { texto: 'Configuración guardada correctamente.', tipo: 'success' };
  } catch (error) {
    mensaje.value = { texto: `Error: ${error}`, tipo: 'error' };
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.mail-settings-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 15px;
}
.settings-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.settings-form-row {
  display: flex;
  gap: 15px;
}
.flex-1 {
  flex: 1;
}
.settings-label {
  font-size: 13px;
  font-weight: bold;
  color: var(--text-main);
}
.settings-input {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-main);
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.settings-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}
.settings-input-help {
  font-size: 11px;
  color: var(--text-muted);
}
.mail-btn-submit {
  background: var(--accent-primary);
  color: #14151a;
  font-weight: bold;
  border: none;
  width: 100%;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
}
.status-toast {
  margin-top: 10px;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
}
.status-toast.success {
  background: rgba(158, 206, 106, 0.15);
  color: #9ece6a;
  border: 1px solid #9ece6a;
}
.status-toast.error {
  background: rgba(247, 118, 142, 0.15);
  color: #f7768e;
  border: 1px solid #f7768e;
}
</style>