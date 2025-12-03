// Importa las funciones de Firebase y utilidades
import { db } from "./firebase.js";
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { mostrarNotificacion } from "./toastFlotante.js";
import { guardarSesion } from "./sessionManager.js"; // Importamos el gestor de sesión

//------------------Variables e incialización------------------
const loginForm = document.getElementById('loginForm');
const usuarioInput = document.getElementById('usuario');
const contrasenaInput = document.getElementById('contrasena');
const btnLogin = document.querySelector('#loginForm button[type="submit"]');

let isProcessing = false; // Variable de control para evitar múltiples envíos
const MARGIN_BOTTOM_VALID = '30px'; // Ajustar si es necesario
const MARGIN_BOTTOM_INVALID = '0px'; // Ajustar si es necesario

//---------------------Funciones de Utilidad (Adaptadas) ---------------------

/**
 * Muestra u oculta el spinner y deshabilita el botón de Login.
 * @param {boolean} deshabilitar - Si es true, muestra spinner y deshabilita.
 */
function toggleBotonLogin(deshabilitar) {
    if (deshabilitar) {
        btnLogin.disabled = true;
        btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando...`;
    } else {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
    }
}

/**
 * Limpia los estados de validación de los campos del formulario de login.
 */
function limpiarFeedback() {
    [usuarioInput, contrasenaInput].forEach(input => {
        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');
        
        const parent = input.closest('.mb-3, .mb-4'); // Cambiado a mb-3/mb-4
        const inputGroupDiv = parent ? parent.querySelector('.input-group') : null;
        const feedbackDiv = inputGroupDiv ? inputGroupDiv.querySelector('.invalid-feedback') : null;
        
        if (inputGroupDiv) {
             // Asegura que el margen se resetee correctamente si usas el div padre .mb-3/.mb-4 para el espaciado
             // Para login lo dejaremos más simple: si hay error, el feedback usa el espacio.
        }
        
        if (feedbackDiv) {
            feedbackDiv.textContent = '';
        }
    });
}

/**
 * Función para mostrar el Feedback en los divs correspondientes del Login
 * (adaptado para la estructura del formulario de login).
 * @param {HTMLInputElement} inputElement - El input a marcar.
 * @param {boolean} valido - Si la validación pasó o falló.
 * @param {string} [mensaje=''] - Mensaje a mostrar si la validación falló.
 */
function mostrarFeedback(inputElement, valido, mensaje = '') {
    const parent = inputElement.closest('.mb-3, .mb-4');
    
    // El feedback está dentro del input-group en el HTML de login
    const inputGroupDiv = parent ? parent.querySelector('.input-group') : null;
    const feedbackDiv = inputGroupDiv ? inputGroupDiv.querySelector('.invalid-feedback') : null;

    if (valido) {
        inputElement.classList.remove('is-invalid');
        inputElement.classList.add('is-valid'); 
    } else {
        inputElement.classList.remove('is-valid');
        inputElement.classList.add('is-invalid');
        if (feedbackDiv) {
             feedbackDiv.textContent = mensaje; 
        }
    }
}

//---------------------Lógica Principal de Login (Pasos 1 a 5)---------------------

async function manejarLogin(e) {
    e.preventDefault();
    
    // Paso 0: Bloquear y verificar estado
    if (isProcessing) return;
    isProcessing = true;
    toggleBotonLogin(true);
    limpiarFeedback(); // Limpiar estados de validación anteriores

    const usuario = usuarioInput.value.trim();
    const contrasena = contrasenaInput.value;
    
    let userData = null;
    let entidadData = null; // Director o Asesor data
    
    try {
        // ------------------ 1. Validar existencia del Usuario (Username) ------------------
        const userQuery = query(collection(db, 'Usuario'), where('usuario', '==', usuario));
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
            mostrarFeedback(usuarioInput, false, 'Ese usuario no existe.');
            mostrarNotificacion("Ese usuario no existe.", 'danger');
            return; // Detener aquí
        }

        const userDoc = userSnap.docs[0];
        const userId = userDoc.id; // Clave primaria de Firebase de la colección Usuario
        userData = userDoc.data();
        
        // ------------------ 2. Validar Contraseña ------------------
        if (userData.contrasena !== contrasena) {
            mostrarFeedback(contrasenaInput, false, 'Contraseña incorrecta.');
            mostrarNotificacion("Contraseña incorrecta.", 'danger');
            return; // Detener aquí
        }
        
        // ------------------ 3. Validar Status del Usuario ------------------
        if (userData.status === 0) {
            mostrarFeedback(usuarioInput, false, 'Usuario desactivado.');
            mostrarNotificacion("Lo sentimos, tu usuario está desactivado.", 'danger');
            return; // Detener aquí
        }
        
        // El usuario y la contraseña son correctos y está activo. Procedemos a validar Rol/Entidad.
        const idRol = userData.idRol;
        let entidadName = null;
        let redirectPage = '';
        let validacionAdicionalExitosa = true;
        
        // ------------------ 4. Validar Rol y Dependencias ------------------
        
        // Buscar el documento en la entidad correspondiente (Administrador, Director, Asesor)
        let entidadQuery = query(collection(db, idRol == 1 ? 'Administrador' : idRol == 2 ? 'Director' : 'Asesor'), 
                                 where('idUsuario', '==', userId));
                                 
        const entidadSnap = await getDocs(entidadQuery);
        
        if (entidadSnap.empty) {
            // Este caso no debería ocurrir si la data es consistente, pero es un buen guardián
            mostrarNotificacion("Error de datos: No se encontró la entidad asociada a tu rol.", 'danger');
            return;
        }

        const entidadDoc = entidadSnap.docs[0];
        const entidadId = entidadDoc.id; // Clave primaria de Firebase de la colección Entidad (Admin, Director, Asesor)
        entidadData = entidadDoc.data();
        entidadName = entidadData.nombre || 'Usuario';
        
        // 4.1 Validaciones específicas para Director (idRol == 2)
        if (idRol == '2') {
            redirectPage = 'gestionAsesores.html'; // Ejemplo: Página principal del Director
            const idCrie = entidadData.idCrie;
            
            if (!idCrie) {
                 validacionAdicionalExitosa = false;
                 mostrarNotificacion(`Lo sentimos Director ${entidadName}, no se te ha asignado un CRIE aún.`, 'danger');
            } else {
                 // Verificar status del CRIE
                 const crieRef = doc(db, 'Crie', idCrie);
                 const crieSnap = await getDoc(crieRef);
                 
                 if (!crieSnap.exists() || crieSnap.data().status !== 1) {
                     validacionAdicionalExitosa = false;
                     mostrarNotificacion(`Lo sentimos Director ${entidadName}, tu CRIE asociado no está activo o fue eliminado.`, 'danger');
                 }
            }
            
            if (!validacionAdicionalExitosa) {
                 // Marcar ambos campos como inválidos si la validación adicional falla
                 mostrarFeedback(usuarioInput, false, `Director ${entidadName}, no le han asignado un CRIE.`);
                 mostrarFeedback(contrasenaInput, false, 'Revisa la validación adicional.');
                 return; 
            }
        } 
        
        // 4.2 Validaciones específicas para Asesor (idRol == 3)
        else if (idRol == '3') {
            redirectPage = 'gestionNinos.html'; // Ejemplo: Página principal del Asesor
            
            // Buscar si tiene al menos 1 Escuela con status 1
            const escuelaQuery = query(collection(db, 'Escuela'), 
                                       where('idAsesor', '==', entidadId), // Usamos entidadId (Asesor ID)
                                       where('status', '==', 1));
            const escuelaSnap = await getDocs(escuelaQuery);
            
            if (escuelaSnap.empty) {
                validacionAdicionalExitosa = false;
                mostrarNotificacion(`Lo sentimos Asesor ${entidadName}, no tienes ninguna escuela activa a tu cargo aún.`, 'danger');
            }
            
            if (!validacionAdicionalExitosa) {
                 mostrarFeedback(usuarioInput, false, `Asesor ${entidadName}, no le han asignado una escuela.`);
                 mostrarFeedback(contrasenaInput, false, 'Revisa la validación adicional.');
                 return;
            }
        }
        
        // 4.3 Redirección para Administrador (idRol == 1)
        else if (idRol == '1') {
             redirectPage = 'gestionAdministradores.html'; // Ejemplo: Página principal del Administrador
             // No hay validaciones adicionales para el Administrador
        }

        // ------------------ 5. Sesión Persistente y Redirección ------------------
        if (validacionAdicionalExitosa) {
            // Datos a guardar para la sesión persistente
            const sessionData = {
                // idUsuario de Firebase de la colección Usuario
                firebaseId: userId, 
                // Rol (1, 2, 3)
                idRol: idRol, 
                // Clave primaria de Firebase de la entidad específica (Admin/Director/Asesor)
                entidadId: entidadId, 
                // Nombre completo
                nombreCompleto: entidadName,
                // Puedes agregar más si es necesario, como el username, si lo necesitas para mostrar en el navbar
                usuario: userData.usuario
            };

            guardarSesion(sessionData); // Guardar en SessionStorage
            
            mostrarNotificacion(`Bienvenido, ${entidadName}.`, 'success');
            
            // Redirigir
            window.location.href = redirectPage;
        }


    } catch (error) {
        console.error("Error en el proceso de login:", error);
        mostrarNotificacion("Ocurrió un error inesperado al iniciar sesión. Inténtalo de nuevo.", 'danger');
    } finally {
        isProcessing = false;
        toggleBotonLogin(false);
    }
}

//---------------------Inicialización---------------------

document.addEventListener('DOMContentLoaded', () => {
    if (loginForm) {
        // Enlace del evento submit a la función manejarLogin
        loginForm.addEventListener('submit', manejarLogin);
    }
});