
//Importa la conexión a Firebase y funciones necesarias (reutilizando la lógica de firebase en el firebasje.js)
import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Referencias a elementos del DOM en detalleAdministradores.html
const formTitle = document.querySelector('.custom-form-card h4');
const adminNameInput = document.getElementById('adminName');
const userNameInput = document.getElementById('userName');
const passwordInput = document.getElementById('password'); // Lo dejamos por ahora
const btnVolver = document.querySelector('.d-flex.justify-content-center .btn-accept:nth-child(1)');
const btnEditar = document.getElementById('btnEditar');
const btnBloquear = document.getElementById('btnBloquear');

//Variables globales y estados
let idAdminDetalle = null;
let idUsuarioDetalle = null;
let estadoActualUsuario = 0;

//Cargar los datos de los administradores
async function cargarDatosAdministrador() {
    // 1. Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    idAdminDetalle = urlParams.get('idAdmin');

    if (!idAdminDetalle) {
        mostrarNotificacion("Error: ID de administrador no proporcionado.", 'danger');
        return;
    }

    try {
        // --- PASO 1: Obtener el Administrador ---
        const adminRef = doc(db, 'Administrador', idAdminDetalle);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
            mostrarNotificacion("Error: Administrador no encontrado.", 'danger');
            return;
        }

        const adminData = adminSnap.data();
        idUsuarioDetalle = adminData.idUsuario; // Guardamos el ID de Usuario asociado

        // Rellenar campo 'Nombre' y el título
        adminNameInput.value = adminData.nombre || '';
        formTitle.textContent = `Administrador ${adminData.nombre || ''}`;

        // --- PASO 2: Obtener el Usuario Relacionado ---
        if (idUsuarioDetalle) {
            const userRef = doc(db, 'Usuario', idUsuarioDetalle);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                // Rellenar campo 'Usuario' (username)
                userNameInput.value = userData.usuario || '';
                estadoActualUsuario = userData.status || 0; // Guardar el estado
                
                // Actualizar el botón Bloquear/Desbloquear
                actualizarBotonBloqueo();
            }
        }
        
    } catch (error) {
        console.error("Error al cargar datos del detalle:", error);
        mostrarNotificacion("Error al cargar los datos del administrador.", 'danger');
    }
}

// --- 2. LÓGICA DE BOTONES ---

/**
 * Cambia el estado (status) de un Usuario en Firestore y recarga la vista.
 */
async function cambiarEstadoUsuario() {
    if (!idUsuarioDetalle) {
        mostrarNotificacion('Error: ID de usuario no proporcionado.', 'danger');
        return;
    }

    const nuevoStatus = estadoActualUsuario === 1 ? 0 : 1; // 1 -> 0 (Bloquear) o 0 -> 1 (Desbloquear)
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";

    try {
        const usuarioRef = doc(db, 'Usuario', idUsuarioDetalle);
        
        await updateDoc(usuarioRef, {
            status: nuevoStatus
        });

        // Actualizar el estado local y el botón
        estadoActualUsuario = nuevoStatus;
        actualizarBotonBloqueo();

        mostrarNotificacion(`El administrador fue ${mensajeAccion} correctamente.`, 'success');
        
    } catch (error) {
        console.error(`Error al intentar ${mensajeAccion} al administrador:`, error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al administrador.`, 'danger');
    }
}

/**
 * Actualiza el texto y la clase del botón Bloquear/Desbloquear.
 */
function actualizarBotonBloqueo() {
    if (estadoActualUsuario === 1) { // Si está activo (1), el botón debe decir Bloquear
        btnBloquear.textContent = "Bloquear";
        btnBloquear.classList.remove('btn-unlock');
        btnBloquear.classList.add('btn-lock');
    } else { // Si está inactivo/bloqueado (0), el botón debe decir Activar
        btnBloquear.textContent = "Activar";
        btnBloquear.classList.remove('btn-lock');
        btnBloquear.classList.add('btn-unlock');
    }
}

/**
 * Asigna eventos a los botones de navegación y acción.
 */
function inicializarEventosDetalle() {
    // Botón VOLVER (Vuelve al listado)
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            window.location.href = 'gestionAdministradores.html';
        });
    }

    // Botón EDITAR (Redirige al formAdmin en modo edición)
    if (btnEditar) {
        btnEditar.addEventListener('click', () => {
            if (idAdminDetalle) {
                window.location.href = `formAdministradores.html?idAdmin=${idAdminDetalle}`;
            } else {
                mostrarNotificacion("No se pudo obtener el ID para edición.", 'danger');
            }
        });
    }

    // Botón BLOQUEAR/DESBLOQUEAR
    if (btnBloquear) {
        btnBloquear.addEventListener('click', cambiarEstadoUsuario);
    }
}

// --- 3. INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    inicializarEventosDetalle();
    cargarDatosAdministrador();
});