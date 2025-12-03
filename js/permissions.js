// js/permissions.js

/**
 * Matriz de permisos que mapea la clave del módulo 
 * (usada en initializeApp y menuData) a los roles permitidos.
 * * Clave del Rol:
 * '1': Administrador
 * '2': Director
 * '3': Asesor
 * * Se asume que si un módulo no está aquí, es público o requiere autenticación básica (manejada por isSessionActive).
 */
export const modulePermissions = {
    // Nota: 'null' es para el index.html, que no requiere módulo ni rol específico.
    
    'administradores': ['1'],                 // Solo Administrador
    'cries': ['1'],                          // Solo Administrador
    'escuelas': ['1', '2'],                  // Administrador y Director
    'asesores': ['1', '2'],                  // Administrador y Director
    'ninos': ['1', '2', '3'],                // Administrador, Director y Asesor
    
    // Módulos que requieren solo estar logueado (si aplica, si no están listados)
    // Por ejemplo: 'perfil': ['1', '2', '3'],
};