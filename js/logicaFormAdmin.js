function inicializarNavegacion() {
    // Referencia al botón de Cancelar
    const btnCancelar = document.querySelector('.btn-cancel');

    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            // Redirigir al usuario a la página de listado
            window.location.href = 'gestionAdministradores.html';
        });
    }
}

// Ejecutar la inicialización cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', inicializarNavegacion);