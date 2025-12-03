/**
 * Módulo para manejar la persistencia de la sesión de usuario
 * utilizando SessionStorage.
 */

// Clave usada en SessionStorage para almacenar los datos del usuario
const SESSION_KEY = 'maPaSaLaTa_user_session';

/**
 * Guarda los datos de la sesión en SessionStorage.
 * @param {object} userData - Objeto con los datos del usuario a guardar.
 * @param {string} userData.firebaseId - La clave primaria (ID del documento) de Firebase de la colección Usuario.
 * @param {string} userData.idRol - El idRol (1, 2, 3...) del usuario.
 * @param {string} userData.entidadId - La clave primaria (ID del documento) de Firebase de la Entidad específica (Admin, Director, Asesor).
 * @param {string} userData.nombreCompleto - Nombre completo del Administrador/Director/Asesor.
 */
export function guardarSesion(userData) {
    try {
        // Almacenamos el objeto como una cadena JSON
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    } catch (error) {
        console.error("Error al guardar la sesión en SessionStorage:", error);
    }
}

/**
 * Recupera los datos de la sesión de SessionStorage.
 * @returns {object | null} Los datos del usuario o null si no hay sesión.
 */
export function obtenerSesion() {
    try {
        const sessionData = sessionStorage.getItem(SESSION_KEY);
        if (sessionData) {
            return JSON.parse(sessionData);
        }
    } catch (error) {
        console.error("Error al obtener la sesión de SessionStorage:", error);
    }
    return null;
}

/**
 * Cierra la sesión y limpia SessionStorage.
 */
export function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Verifica si hay una sesión activa.
 * @returns {boolean} True si hay sesión, false en caso contrario.
 */
export function isSessionActive() {
    return !!obtenerSesion();
}

// Opcional: Función de ayuda para obtener un atributo específico
export function obtenerAtributoSesion(key) {
    const session = obtenerSesion();
    return session ? session[key] : null;
}