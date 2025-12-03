// js/appInitializer.js

import { renderNavigation } from './navManager.js';
import { isSessionActive, obtenerSesion } from './sessionManager.js';
import { modulePermissions } from './permissions.js';
// ⚠️ Asegúrate de que este import sea correcto para tu archivo toastFlotante.js
import { mostrarNotificacionPendiente } from './toastFlotante.js'; 


export function initializeApp(activeModuleKey, activeSubMenuKey = null) {
    
    const session = obtenerSesion();
    const active = isSessionActive();
    
    // Lista de páginas que no requieren sesión (p. ej., el Login y el Index)
    const noAuthPages = ['iniciosesion.html', 'index.html']; 
    const currentPage = window.location.pathname.split('/').pop();

    // --- 1.  VERIFICACIÓN DE AUTENTICACIÓN (Sesión requerida)  ---
    if (!noAuthPages.includes(currentPage) && !active) {
        // Si la página requiere autenticación y no hay sesión, redirigir al login
        // sessionStorage.setItem('notificacionPendiente', JSON.stringify({
        //     mensaje: "Debes iniciar sesión para acceder a esta página.",
        //     tipo: 'error'
        // }));
        window.location.href = 'iniciosesion.html';
        return; // Detener la ejecución
    }

    // --- 2. 🛡️ VERIFICACIÓN DE PERMISOS POR ROL 🛡️ ---
    // Solo se aplica a páginas que tienen un activeModuleKey definido (páginas de gestión)
    if (activeModuleKey && modulePermissions[activeModuleKey]) {
        const allowedRoles = modulePermissions[activeModuleKey];
        const userRol = session ? session.idRol : null; 
        
        // Si el rol del usuario NO está en la lista de roles permitidos:
        if (!allowedRoles.includes(userRol)) {
            // Guardar notificación de error (aunque la página de Denegado es inmediata)

            
            // Inyectar el HTML de Acceso Denegado y detener la ejecución
            renderAccessDeniedPage(); 
            return; 
        }
    }


    // --- 3. Renderizar la Navegación (Si pasa la seguridad) ---
    renderNavigation(activeModuleKey, activeSubMenuKey);

    // --- 4. Mostrar notificaciones pendientes ---
    // Si tienes una función en toastFlotante.js, úsala aquí.
    mostrarNotificacionPendiente();
}


/**
 * Reemplaza el contenido del body por un mensaje de acceso denegado.
 */
function renderAccessDeniedPage() {
    // 1. Limpiamos el contenido del body
    document.body.innerHTML = ''; 

    // 2. Inyectamos el HTML de acceso denegado, incluyendo los scripts necesarios
    const deniedHTML = `
        <script src="https://kit.fontawesome.com/13c51e858e.js" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"
            integrity="sha384-FKyoEForCGlyvwx9Hj09JcYn3nv7wiPVlz7YYwJrWVcXK/BmnVDxM+D2scQbITxI"
            crossorigin="anonymous"></script>

        <style>
            .acceso-denegado-page {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #f8f9fa; /* Fondo claro */
            }
            .btn-principal {
                background-color: #991011 !important; 
                border-color: #991011 !important;
            }
            .text-denied {
                 color: #5C0000 !important;
            }
            /* Estilo para la imagen personalizada */
            .img-alert {
                width: 120px; /* Ajusta el tamaño de la imagen */
                height: auto;
                margin-bottom: 20px;
            }
        </style>
        <div class="acceso-denegado-page w-100">
            <div class="container mt-5 mb-4 pt-5 text-center">
                <div class="row justify-content-center">
                    <div class="col-md-8">
                        <img src="img/account-alert.png" alt="Acceso Denegado" class="img-alert"> 
                        
                        <h1 class="display-4 fw-bold mb-3 text-denied">
                            Acceso Denegado
                        </h1>
                        <p class="lead">
                            Lo sentimos, no tiene los permisos necesarios para acceder a esta sección.
                            <br/>
                            Si crees que esto es un error, contacta al administrador del sistema.
                        </p>
                        <hr/>
                        <a href="index.html" class="btn btn-principal mt-3 btndenie">
                            Volver a la página principal
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', deniedHTML);
}