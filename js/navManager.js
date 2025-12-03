// js/navManager.js

import { mainMenuItems, subMenus } from './menuData.js';
import { obtenerSesion, cerrarSesion, isSessionActive } from './sessionManager.js';



export function renderNavigation(activeModuleKey, activeSubMenuKey = null) {
    
    // Generar el HTML de todos los componentes
    const topBarHTML = buildTopBar();
    const navBarPrincipalHTML = buildMainNavbar(activeModuleKey);
    const offcanvasHTML = buildOffcanvas(activeModuleKey);
    const subNavbarHTML = buildSubNavbar(activeModuleKey, activeSubMenuKey);

    const body = document.body;

    // 1. Inyectar de arriba hacia abajo
    // ⚠️ Importante: El orden en que se insertan *después del inicio del body* importa para el layout
    
    // 1.1 Top Bar (Contiene Salir/Login)
    body.insertAdjacentHTML('afterbegin', topBarHTML);
    
    // 1.2 Main Navbar
    // Se inserta *después* del topBar (por lo que queda debajo)
    const topBarElement = document.querySelector('.top-bar'); // Seleccionamos la barra que acabamos de insertar
    if (topBarElement) {
        topBarElement.insertAdjacentHTML('afterend', navBarPrincipalHTML);
    } else {
        body.insertAdjacentHTML('afterbegin', navBarPrincipalHTML); // Fallback si el top-bar no existe
    }
    
    // 1.3 Offcanvas (este no afecta el flujo del documento, se puede inyectar al final del body si se quiere, o aquí)
    body.insertAdjacentHTML('beforeend', offcanvasHTML); // Lo movemos al final del body para mayor compatibilidad con Bootstrap

    // 2. Configurar el manejo del botón "Salir" después de la inyección
    // Ahora 'logoutLink' ya existe en el DOM
    setupLogoutHandler(); 

    // 3. Inyectar la Sub-Navbar (si existe)
    const mainContentArea = document.querySelector('main'); 
    if (mainContentArea && subNavbarHTML) {
        mainContentArea.insertAdjacentHTML('beforebegin', subNavbarHTML);
    }
}

// --- Generadores de Componentes Individuales ---

function buildTopBar() {
    const session = obtenerSesion();
    const active = isSessionActive();
    
    let welcomeText = `<a href="iniciosesion.html" class="text-white me-3">Iniciar sesión</a>`;
    let logoutButton = '';

    if (active && session) {
        // Mapear idRol a nombre de Rol
        let rolLabel = '';
        switch (session.idRol) {
            case '1': rolLabel = 'Administrador'; break;
            case '2': rolLabel = 'Director'; break;
            case '3': rolLabel = 'Asesor'; break;
            default: rolLabel = 'Usuario';
        }

        welcomeText = `<span class="text-white">Bienvenido ${session.nombreCompleto} - ${rolLabel}</span>`;
        logoutButton = `<a href="#" id="logoutLink" class="text-white">Salir</a>`;
    }

    return `
    <header class="top-bar">
        <div class="container-fluid d-flex justify-content-between align-items-center">
            ${welcomeText}
            <div>
                ${logoutButton}
            </div>
        </div>
    </header>
    `;
}



function buildMainNavbar(activeKey) {
    let desktopLinks = '';
    const permittedItems = getPermittedMenuItems(); // 💡 USAR ITEMS PERMITIDOS
    
    permittedItems.forEach(item => { // 💡 ITERAR SOBRE ITEMS PERMITIDOS
        const activeClass = item.key === activeKey ? ' active-page' : '';
        const linkHTML = `<li class="nav-item"><a class="nav-link${activeClass}" href="${item.href}">${item.label}</a></li>`;
        
        desktopLinks += linkHTML;
    });

    return `
    <nav class="navbar main-navbar py-0"> 
        <div class="container-fluid">
            <button class="navbar-toggler d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasNavbar" aria-controls="offcanvasNavbar" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="d-none d-lg-block w-100 nav-desktop-container"> 
                <ul class="navbar-nav"> 
                    <li>
                        <a class="navbar-brand" href="index.html">
                            <img src="img/crielogo.png" alt="CRIE Logo" height="60"> 
                        </a>
                    </li>
                    ${desktopLinks}
                </ul>
            </div>
        </div>
    </nav>
    `;
}


function buildOffcanvas(activeKey) {
    let offcanvasLinks = '';
    const permittedItems = getPermittedMenuItems(); // 💡 USAR ITEMS PERMITIDOS

    permittedItems.forEach(item => { // 💡 ITERAR SOBRE ITEMS PERMITIDOS
        const activeClass = item.key === activeKey ? ' active-page' : '';
        offcanvasLinks += `<li class="nav-item"><a class="nav-link${activeClass}" href="${item.href}">${item.label}</a></li>`;
    });

    // ... (El resto del HTML del offcanvas es el mismo, pero ahora solo contiene los links permitidos)
    return `
    <div class="offcanvas offcanvas-end" tabindex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
        <div class="offcanvas-header main-navbar">
            <h5 class="offcanvas-title" id="offcanvasNavbarLabel">Menú MaPaSaLaTa</h5>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body main-navbar">
            <ul class="navbar-nav justify-content-end flex-grow-1 pe-3">
                ${offcanvasLinks}
            </ul>
        </div>
    </div>
    `;
}

// ... (Después de buildOffcanvas, antes de renderNavigation) ...

/**
 * Filtra los items del menú según el rol del usuario.
 * @returns {Array<object>} Items de menú permitidos.
 */
function getPermittedMenuItems() {
    const session = obtenerSesion();
    if (!session) {
        // Si no hay sesión, no debería ver el menú principal (aunque las páginas lo eviten)
        return []; 
    }

    const idRol = session.idRol;
    
    let allowedKeys = [];

    if (idRol == '1') {
        // Administrador (idRol = 1): Todos los módulos
        allowedKeys = mainMenuItems.map(item => item.key);
    } else if (idRol == '2') {
        // Director (idRol = 2): Escuelas, Asesores y Niños
        allowedKeys = ['escuelas', 'asesores', 'ninos'];
    } else if (idRol == '3') {
        // Asesor (idRol = 3): Solo Niños
        allowedKeys = ['ninos'];
    }

    return mainMenuItems.filter(item => allowedKeys.includes(item.key));
}



function buildSubNavbar(activeModuleKey, activeSubMenuKey) {
    const subMenu = subMenus[activeModuleKey];
    
    if (!subMenu || subMenu.length === 0) {
        return ''; // No hay submenú para este módulo
    }

    let linksHTML = '';

    subMenu.forEach(item => {
        // La clase 'btn-gestion-active' se usará para marcar la subsección activa
        const activeClass = item.key === activeSubMenuKey ? ' btn-gestion-active' : '';
        linksHTML += `<a href="${item.href}" class="btn btn-gestion me-4${activeClass}">${item.label}</a>`;
    });
    
    // El contenedor de la sub-navbar
    return `
    <nav class="sub-navbar sticky-top bg-white py-2 shadow-sm">
        <div class="container d-flex justify-content-center">
            ${linksHTML}
        </div>
    </nav>
    `;
}

// Agregamos una función para manejar el cierre de sesión
function setupLogoutHandler() {
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion(); // Cierra la sesión en SessionStorage
            // // Opcional: mostrar notificación de cierre
            // sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            //     mensaje: `Sesión cerrada exitosamente.`,
            //     tipo: 'info'
            // }));
            window.location.href = 'iniciosesion.html'; // Redirige al login
        });
    }
}

