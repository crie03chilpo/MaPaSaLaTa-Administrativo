// Importa la conexión a Firebase y funciones necesarias
import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { mostrarNotificacion } from "./toastFlotante.js";

// ------------------ Referencias al DOM ------------------
const formTitle = document.getElementById('formTitle'); // Usamos ID para más precisión
const directorNameInput = document.getElementById('directorName');
const crieAsociadoInput = document.getElementById('crieAsociado'); // Nuevo campo para CRIE
const userNameInput = document.getElementById('userName');
const passwordInput = document.getElementById('password'); // Mantener para mostrar el campo
const btnVolver = document.querySelector('.d-flex.justify-content-center .btn-accept:nth-child(1)');
const btnEditar = document.getElementById('btnEditar');
const btnBloquear = document.getElementById('btnBloquear');

// ------------------ Variables globales y estados ------------------
let idDirectorDetalle = null;
let idUsuarioDetalle = null;
let estadoActualUsuario = 0; // 1 (activo), 0 (bloqueado)

// ------------------ Funciones de Carga y Lógica ------------------

/**
 * Carga los datos del Director, el CRIE asociado y el Usuario.
 */
async function cargarDatosDirector() {
    // 1. Obtener ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    // Cambiamos 'idAdmin' por 'idDirector'
    idDirectorDetalle = urlParams.get('idDirector');

    if (!idDirectorDetalle) {
        mostrarNotificacion("Error: ID de director no proporcionado.", 'danger');
        return;
    }

    try {
        // --- PASO 1: Obtener el Director ---
        const directorRef = doc(db, 'Director', idDirectorDetalle);
        const directorSnap = await getDoc(directorRef);

        if (!directorSnap.exists()) {
            mostrarNotificacion("Error: Director no encontrado.", 'danger');
            return;
        }

        const directorData = directorSnap.data();
        idUsuarioDetalle = directorData.idUsuario; // Guardamos el ID de Usuario asociado
        const idCrieAsociado = directorData.idCrie; // Guardamos el ID del CRIE asociado

        // Rellenar campo 'Nombre' y el título
        directorNameInput.value = directorData.nombre || '';
        formTitle.textContent = `Director ${directorData.nombre || ''}`;

        // --- PASO 2: Obtener el CRIE Relacionado ---
        if (idCrieAsociado) {
            const crieRef = doc(db, 'Crie', idCrieAsociado);
            const crieSnap = await getDoc(crieRef);

            if (crieSnap.exists()) {
                const crieData = crieSnap.data();
                // Rellenar el campo CRIE con el nombre o CCT, lo que sea más informativo
                crieAsociadoInput.value = crieData.nombre || crieData.cct || 'CRIE Desconocido';
            } else {
                crieAsociadoInput.value = 'CRIE no encontrado';
            }
        } else {
            crieAsociadoInput.value = 'No tiene CRIE asociado';
        }

        // --- PASO 3: Obtener el Usuario Relacionado ---
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
        console.error("Error al cargar datos del detalle del Director:", error);
        mostrarNotificacion("Error al cargar los datos del director.", 'danger');
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

    // 1 -> 0 (Bloquear) o 0 -> 1 (Activar)
    const nuevoStatus = estadoActualUsuario === 1 ? 0 : 1; 
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";
    const nombreDirector = directorNameInput.value;

    try {
        const usuarioRef = doc(db, 'Usuario', idUsuarioDetalle);
        
        await updateDoc(usuarioRef, {
            status: nuevoStatus
        });

        // Actualizar el estado local y el botón
        estadoActualUsuario = nuevoStatus;
        actualizarBotonBloqueo();

        mostrarNotificacion(`El director ${nombreDirector} fue ${mensajeAccion} correctamente.`, 'success');
        
    } catch (error) {
        console.error(`Error al intentar ${mensajeAccion} al director:`, error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al director.`, 'danger');
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
    // Botón VOLVER (Vuelve al listado de Directores)
    if (btnVolver) {
        // En lugar de history.back() (que está en el HTML), reasignamos a la lista de directores por si viene de otro lugar
        // Pero usaremos la acción por defecto que dejaste en el HTML (onclick="history.back()")
    }

    // Botón EDITAR (Redirige al formDirector en modo edición)
    if (btnEditar) {
        btnEditar.addEventListener('click', () => {
            if (idDirectorDetalle) {
                // Redirigir a formDirectores.html usando idDirector
                window.location.href = `formDirector.html?idDirector=${idDirectorDetalle}`;
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

// ------------------ INICIALIZACIÓN ------------------

document.addEventListener('DOMContentLoaded', () => {
    inicializarEventosDetalle();
    cargarDatosDirector();
});