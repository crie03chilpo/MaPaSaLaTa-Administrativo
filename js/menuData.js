// js/menuData.js

/**
 * Define la estructura de los módulos principales de navegación.
 * Cada módulo tiene una 'key' que usaremos para determinar el enlace activo.
 */
export const mainMenuItems = [
    { key: 'administradores', label: 'Administradores', href: 'gestionAdministradores.html' },
    { key: 'crie', label: 'CRIE', href: 'gestionCries.html' },
    { key: 'directores', label: 'Directores', href: 'gestionDirectores.html' },
    { key: 'escuelas', label: 'Escuelas', href: 'gestionEscuelas.html' },
    { key: 'asesores', label: 'Asesores', href: 'gestionAsesores.html' },
    { key: 'ninos', label: 'Niños', href: 'gestionNinos.html' },
];

/**
 * Define la estructura de los submenús de gestión.
 * La clave (key) debe coincidir con la 'key' de un módulo principal.
 */
export const subMenus = {
    'administradores': [
        { key: 'lista', label: 'Lista de Administradores', href: 'gestionAdministradores.html' },
        { key: 'agregar', label: 'Agregar Administrador', href: 'formAdministradores.html' },
    ],
    'crie': [
        { key: 'lista', label: 'Lista de los CRIE', href: 'gestionCries.html' },
        { key: 'agregar', label: 'Agregar CRIE', href: 'formCries.html' },
    ],
    'directores': [
        { key: 'lista', label: 'Lista de Directores', href: 'gestionDirectores.html' },
        { key: 'agregar', label: 'Agregar Director', href: 'formDirector.html' },
    ],
    'ninos': [
        { key: 'lista', label: 'Lista de Niños', href: 'gestionNinos.html' },
        
    ],    
    'escuelas': [
        { key: 'lista', label: 'Lista de Escuelas', href: 'gestionEscuelas.html' },
        { key: 'agregar', label: 'Agregar Escuela', href: 'formEscuelas.html' },
        
    ],     
    'asesores': [
        { key: 'lista', label: 'Lista de Asesores', href: 'gestionAsesores.html' },
        { key: 'agregar', label: 'Agregar Asesor', href: 'formAsesor.html' },
        
    ],         
};