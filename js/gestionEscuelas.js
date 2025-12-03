//Importaciones de la instancia de la base de datos (db)
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc,
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { obtenerSesion } from "./sessionManager.js"; // Debes crear/revisar si tienes este archivo importable


//Variables globales
let listaEscuelasCompleta = []; 


const DIRECTOR_ROL_ID = '2'; // ID del rol Director
let usuarioActual = obtenerSesion(); // Obtener datos de la sesión (asumiendo que tiene idRol)
let idCrieDirector = null; // ID del CRIE al que está ligado el Director
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;

let directorEntidadId = esDirector ? usuarioActual.entidadId : null; 


console.log(esDirector);

//Cache para almacenar nombres de CRIE y Asesores y evitar peticiones repetidas
const cacheEntidades = {
    cries: {},
    asesores: {}
};


//Elementos del DOM HTML
const selectCampo = document.getElementById('campoBusqueda'); 
const inputBusqueda = document.getElementById('terminoBusqueda');
const btnBuscar = document.getElementById('btn-empezar-busca');
const btnReiniciar = document.getElementById('btn-reiniciar-busca'); 
const radioTurno = document.getElementsByName('turnoFiltro'); // Colección de radio buttons
const escuelasTableBody = document.getElementById('escuelasTableBody');


//Funciones, métodos y eventos------------------

//**********************Inicialización**********************

//1. Funcion para iniciar eventos (para filtros, búsqueda y acciones de la tabla)
function inicializarEventos() {
    //Eventos de Búsqueda
    if (btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            filtrarEscuelas();
        });
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filtrarEscuelas();
                }
            });
        }
    } 
    
    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarBusqueda);
    }

    //Eventos para el filtro de Turno
    radioTurno.forEach(radio => {
        radio.addEventListener('change', filtrarEscuelas);
    });

    //Evento para Bloqueo/Desbloqueo y Edición
    if (escuelasTableBody) {
        escuelasTableBody.addEventListener('click', (e) => {
            
            //Lógica de Bloqueo/Desbloqueo
            const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
            if (buttonLock) {
                const idEscuela = buttonLock.dataset.idescuela;
                //Buscar la escuela en la lista completa para obtener su status actual
                const escuelaEncontrada = listaEscuelasCompleta.find(esc => esc.id === idEscuela);
                if (escuelaEncontrada) {
                    cambiarEstadoEscuela(idEscuela, escuelaEncontrada.status); 
                }
                return; 
            }

            //Lógica para los botones de editar
            const buttonEdit = e.target.closest('.btn-edit');
            if (buttonEdit) {
                const idEscuelaEditar = buttonEdit.dataset.idescuela; 
                //Redirige al formulario, pasando el ID de la Escuela como parámetro URL
                window.location.href = `formEscuelas.html?idEscuela=${idEscuelaEditar}`;
                return;
            }
        });
    }
}

//----FUNCIONES ESPECIFICAS PARA UN DIRECTOR-------
async function obtenerIdCrieDirector(entidadId) {
    if (!entidadId) return null;

    try {
        // Hacemos un getDoc DIRECTO, que es más rápido que un query.
        const directorRef = doc(db, 'Director', entidadId);
        const docSnap = await getDoc(directorRef);

        if (docSnap.exists()) {
            const directorData = docSnap.data();
            console.log("CRIE ID del Director encontrado:", directorData.idCrie);
            return directorData.idCrie;
        } else {
            console.warn("No se encontró registro de Director para el entidadId proporcionado.");
            return null;
        }
    } catch (error) {
        console.error("Error al obtener el idCrie del Director:", error);
        mostrarNotificacion("Error de seguridad: No se pudo verificar la entidad CRIE asociada.", 'danger');
        return null;
    }
}

//Función auxiliar para obtener datos de CRIE o Asesor por ID y usar caché
async function getEntityName(collectionName, id) {
    if (!id || id === "") { 
        //Si es Asesor y el ID es "" (Pendiente), devolver "Pendiente"
        if (collectionName === 'Asesor') {
            return 'Pendiente'; 
        }
        //Para CRIE u otros, devolver 'N/A' (aunque idCrie nunca debería ser inválido)
        return 'N/A';
    }
    
    const cacheKey = collectionName === 'Crie' ? 'cries' : 'asesores';
    
    //1. Revisar caché
    if (cacheEntidades[cacheKey][id]) {
        return cacheEntidades[cacheKey][id];
    }

    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            let nombre = 'N/A';
            
            if (collectionName === 'Crie') {
                nombre = data.nombre || 'Nombre CRIE N/D';
            } else if (collectionName === 'Asesor') {
                nombre = data.nombre || 'Nombre Asesor N/D';
            }
            
            //2. Almacenar en caché y devolver
            cacheEntidades[cacheKey][id] = nombre;
            return nombre;
        }
        
        //Si no existe el ID
        cacheEntidades[cacheKey][id] = 'No Asignado';
        return 'No Asignado';

    } catch (error) {
        console.warn(`Error al obtener ${collectionName} ID ${id}:`, error.message);
        //3. Devolver fallback en caso de error de conexión/permisos
        cacheEntidades[cacheKey][id] = 'Error Carga';
        return 'Error Carga';
    }
}


//2. Función que hace la consulta a la base de datos para recuperar todas las Escuelas
async function obtenerEscuelasConRelaciones() {
    console.log("Iniciando obtención de Escuelas y sus relaciones...");
    
    const escuelasRef = collection(db, 'Escuela');
    let qEscuelas; 

    // 💡 1. Lógica de FILTRADO POR DIRECTOR
    if (esDirector) {
        if (idCrieDirector) {
             // Aplicar el filtro: solo escuelas cuyo idCrie coincida con el del director
            console.log(`Filtrando Escuelas por CRIE ID: ${idCrieDirector}`);
            qEscuelas = query(escuelasRef, where("idCrie", "==", idCrieDirector));
        } else {
            // Si es director pero idCrieDirector es null (falló la búsqueda en el DOMContentLoaded)
            console.error("Director logueado sin CRIE asociado. Imposible cargar escuelas.");
            mostrarNotificacion("Su cuenta de Director no está vinculada a ningún CRIE o hubo un error de carga.", 'danger');
            renderizarTablaEscuelas([]);
            return;
        }
    } else {
        // Si no es Director (es Admin o Asesor), se consulta la colección completa.
        qEscuelas = escuelasRef;
    }
    
    try {
        const snapshotEscuelas = await getDocs(qEscuelas);

        if (snapshotEscuelas.empty) {
            // Mensaje adaptado para el Director
            const msg = esDirector ? "No hay Escuelas asignadas a su CRIE." : "No hay Escuelas registradas.";
            console.warn(msg);
            mostrarNotificacion(msg, 'warning');
            renderizarTablaEscuelas([]);
            return; 
        }
        
        // ... (el resto del código de mapeo y renderizado de escuelas)
        const escuelaPromises = [];

        snapshotEscuelas.forEach(docEscuela => {
            const escuela = { id: docEscuela.id, ...docEscuela.data() }; 
            
            const criePromise = getEntityName('Crie', escuela.idCrie);
            const asesorPromise = getEntityName('Asesor', escuela.idAsesor);
            
            const relacionPromise = Promise.all([criePromise, asesorPromise]).then(([nombreCrie, nombreAsesor]) => {
                
                return {
                    id: escuela.id,
                    cct: escuela.cct || 'N/A',
                    nombre: escuela.nombre || 'N/A', 
                    direccion: escuela.direccion || 'N/A',
                    turno: escuela.turno ? escuela.turno.toLowerCase() : 'N/A',
                    status: escuela.status || 0,
                    idCrie: escuela.idCrie || null,
                    nombreCrie: nombreCrie,
                    idAsesor: escuela.idAsesor || null,
                    nombreAsesor: nombreAsesor
                };
            });
            escuelaPromises.push(relacionPromise);
        });

        const listaFinalEscuelas = await Promise.all(escuelaPromises);
        
        listaEscuelasCompleta = listaFinalEscuelas.sort((a, b) => 
            String(a.nombre).localeCompare(String(b.nombre))
        );
        
        renderizarTablaEscuelas(listaEscuelasCompleta);

    } catch (error) {
        console.error("Error FATAL al obtener los datos de Escuelas:", error);
        mostrarNotificacion("Error al cargar la lista de Escuelas. Verifique su conexión.", 'danger');
        renderizarTablaEscuelas([]); 
    }
}

//3. La función que renderiza, la que se encarga de cargar todas las filas en la tabla
function renderizarTablaEscuelas(escuelas) {
    if (!escuelasTableBody) return; 

    escuelasTableBody.innerHTML = ''; //Limpiar la tabla

    if (escuelas.length === 0) {
        escuelasTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay Escuelas registradas o coincidencias con el término de búsqueda.</td></tr>';
        return;
    }

    escuelas.forEach(escuela => {
        const row = document.createElement('tr');
        
        //Estilos de bloqueo y desbloqueo
        const isActivo = escuela.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock'; 
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear Escuela' : 'Activar Escuela'; 
        
        //Normalizar turno para visualización (capitalize first letter)
        const turnoDisplay = escuela.turno ? escuela.turno.charAt(0).toUpperCase() + escuela.turno.slice(1) : 'N/A';

        //Inserta las filas
        row.innerHTML = `
            <td>${escuela.cct}</td>
            <td>${escuela.nombre}</td>
            <td>${escuela.direccion}</td>
            <td>${turnoDisplay}</td>
            <td>${escuela.nombreCrie}</td>
            <td>${escuela.nombreAsesor}</td>
            <td class="text-center">
                <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idescuela="${escuela.id}">
                    <i class="fas ${icon}"></i>
                </button>
                <button class="btn btn-action btn-edit" title="Editar Escuela" data-idescuela="${escuela.id}">
                    <i class="fas fa-edit"></i>
                </button>
                </td>
        `;
        escuelasTableBody.appendChild(row);
    });
}


//*******************De filtrado*******************

//1. Reiniciar la busqueda y filtros
function reiniciarBusqueda() {
    //1. Limpiar el campo de búsqueda
    if (inputBusqueda) {
        inputBusqueda.value = '';
    }
    
    //2. Reiniciar el filtro de turno a 'ambos'
    const ambosRadio = document.getElementById('turnoAmbos');
    if (ambosRadio) {
        ambosRadio.checked = true;
    }

    //3. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
    
    //4. Mostrar la lista completa (reiniciar el filtro)
    renderizarTablaEscuelas(listaEscuelasCompleta);
}


//2. Para el filtrado, incluyendo la búsqueda por texto y el filtro por turno
function filtrarEscuelas() {
    if (!selectCampo || !inputBusqueda || !btnReiniciar || radioTurno.length === 0) {
        console.error("Elementos de búsqueda/filtro no encontrados.");
        return;
    }

    const campo = selectCampo.value; 
    const termino = inputBusqueda.value.toLowerCase().trim();
    
    let turnoSeleccionado = '';
    for (const radio of radioTurno) {
        if (radio.checked) {
            turnoSeleccionado = radio.value;
            break;
        }
    }
    
    let resultadosFiltrados = listaEscuelasCompleta;
    let hayFiltro = false;

    //Aplicar Filtro de Búsqueda por Texto
    if (termino !== "") {
        resultadosFiltrados = resultadosFiltrados.filter(escuela => {
            let valorCampo;
            
            //Si el campo es 'crieId', buscamos en el nombre enriquecido
            if (campo === 'crieId') {
                valorCampo = String(escuela.nombreCrie).toLowerCase();
            } else if (campo === 'nombreAsesor') {
                valorCampo = String(escuela.nombreAsesor).toLowerCase();
            } else {
                valorCampo = String(escuela[campo]).toLowerCase(); 
            }

            return valorCampo.includes(termino);
        });
        hayFiltro = true;
    }

    //Aplicar Filtro de Turno
    if (turnoSeleccionado !== 'ambos') {
        resultadosFiltrados = resultadosFiltrados.filter(escuela => 
            escuela.turno === turnoSeleccionado
        );
        hayFiltro = true;
    }

    //Lógica para mostrar/ocultar el botón Reiniciar
    if (hayFiltro) {
        btnReiniciar.classList.remove('d-none');
    } else {
        //Solo mostrar si el término está vacío Y el turno es "ambos"
        btnReiniciar.classList.add('d-none');
    }

    //Renderizamos los resultados
    renderizarTablaEscuelas(resultadosFiltrados);
}


//************* Otras acciones ********+++++++++++++++++++++

//ambia el estado (status) de una Escuela (1=activo, 0=bloqueado)
async function cambiarEstadoEscuela(idEscuela, currentStatus) {
    if (!idEscuela) {
        mostrarNotificacion('Error: ID de Escuela no proporcionado.', 'danger');
        return;
    }

    const nuevoStatus = currentStatus === 1 ? 0 : 1; 
    const mensajeAccion = nuevoStatus === 0 ? "bloqueada" : "activada";

    try {
        const escuelaRef = doc(db, 'Escuela', idEscuela);
        
        await updateDoc(escuelaRef, {
            status: nuevoStatus
        });

        //Mostrar notificación de éxito
        mostrarNotificacion(`La Escuela fue ${mensajeAccion} correctamente.`, 'success');
        
        //Recargar la tabla (la carga completa) para mostrar el estado actualizado
        await obtenerEscuelasConRelaciones();

    } catch (error) {
        console.error("Error al actualizar el estado de la Escuela:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} la Escuela.`, 'danger');
    }
}


//Manejar la notificación pendiente al recargar la página
function manejarNotificacionPendiente() {
    const notificacionData = sessionStorage.getItem('notificacionPendiente');
    
    if (notificacionData) {
        try {
            const notificacion = JSON.parse(notificacionData);
            mostrarNotificacion(notificacion.mensaje, notificacion.tipo);
        } catch (error) {
            console.error("Error al parsear la notificación de sesión:", error);
        } finally {
            sessionStorage.removeItem('notificacionPendiente');
        }
    }
}

//----------------------------La llamada principal-----------------

//Carga el DOM
document.addEventListener('DOMContentLoaded', async () => { 
    manejarNotificacionPendiente(); 
    
    if (esDirector) {
        // 1. Si es Director, obtener su ID de CRIE usando el entidadId
        idCrieDirector = await obtenerIdCrieDirector(directorEntidadId); // 💡 Cambio aquí
        
        // 2. Si logramos obtener el ID del CRIE, ocultamos el filtro de CRIE
        if (idCrieDirector) {
            ocultarFiltroCRIE(); 
        } else {
            // Si es Director pero no encontramos su CRIE, lo tratamos como un error grave, 
            // la lista de escuelas debe mostrarse vacía o con error (gestionado en obtenerEscuelasConRelaciones)
        }
    }
    
    inicializarEventos();
    // La carga de datos usará idCrieDirector si está definido, si no, carga todo
    obtenerEscuelasConRelaciones(); 
});


// 💡 NUEVA FUNCIÓN para ocultar el campo de búsqueda de CRIE
function ocultarFiltroCRIE() {
    if (esDirector && selectCampo) {
        const opcionCRIE = selectCampo.querySelector('option[value="crieId"]');
        if (opcionCRIE) {
            opcionCRIE.remove();
        }
        // Si la opción eliminada era la seleccionada, seleccionamos 'nombre' por defecto
        if (selectCampo.value === 'crieId') {
            selectCampo.value = 'nombre';
        }
    }
}