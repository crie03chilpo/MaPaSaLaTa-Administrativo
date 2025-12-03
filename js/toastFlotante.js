// --- 3. FUNCIÓN DE NOTIFICACIÓN (NUEVA) ---

/**
 * Muestra una notificación simple (simulando un Toast/Alert de Bootstrap).
 * NOTA: Para un Toast real de Bootstrap, necesitarías un contenedor Toast en el HTML.
 * @param {string} mensaje - El texto a mostrar.
 * @param {string} tipo - 'success' o 'danger' (para colores).
 */
function mostrarNotificacion(mensaje, tipo) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error("No se encontró el contenedor de toasts. Asegúrate de agregarlo al HTML.");
        alert(mensaje); // Fallback en caso de error
        return;
    }
    
    // Mapeo de tipos para colores de Bootstrap (background)
    const bgClass = {
        'success': 'text-bg-success',
        'danger': 'text-bg-danger',
        'warning': 'text-bg-warning',
        'info': 'text-bg-info'
    }[tipo] || 'text-bg-primary';

    // Crear el elemento Toast
    const toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center ${bgClass} border-0 margenfint`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    // Le damos un ID único para la instancia de Bootstrap
    toastElement.id = `toast-${Date.now()}`; 
    
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${mensaje}</strong>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Inyectar el Toast en el contenedor
    // Importante: lo agregamos al contenedor. Bootstrap manejará el apilamiento.
    toastContainer.appendChild(toastElement);

    // Inicializar y mostrar el Toast
    // Nota: 'bootstrap.Toast' requiere que el archivo de JS de Bootstrap se haya cargado
    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastElement, {
        delay: 3000 // Ocultar después de 4 segundos
    });

    toastBootstrap.show();
    
    // Opcional: Eliminar el elemento Toast del DOM una vez que se oculte
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function mostrarNotificacionPendiente() {
    const notificacionJSON = sessionStorage.getItem('notificacionPendiente');
    
    if (notificacionJSON) {
        try {
            const notificacion = JSON.parse(notificacionJSON);
            mostrarNotificacion(notificacion.mensaje, notificacion.tipo);
        } catch (e) {
            console.error("Error al parsear notificación pendiente:", e);
        } finally {
            // MUY IMPORTANTE: Eliminar después de usar
            sessionStorage.removeItem('notificacionPendiente');
        }
    }
}


export{mostrarNotificacion, mostrarNotificacionPendiente};