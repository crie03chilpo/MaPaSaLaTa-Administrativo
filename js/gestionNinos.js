//Importaciones de la instancia de la base de datos (db)
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore y la función de query
import {
    collection, getDocs, doc, getDoc, updateDoc,
    query, where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Importación asumida para obtener la sesión del usuario
import { obtenerSesion } from "./sessionManager.js";


//Variables globales
let listaNinosCompleta = []; 
let datosRelacionales = {}; //Almacenará CRIE, Escuelas, Grados, Grupos para lookups
let ninosFiltradosActuales = []; //La lista que se muestra actualmente en la tabla

//Elementos del DOM HTML
const formFiltrosBusqueda = document.getElementById('formFiltrosBusqueda');
const selectCRIE = document.getElementById('filtroCRIE');
const selectEscuela = document.getElementById('filtroEscuela');
const selectGrado = document.getElementById('filtroGrado');
const selectGrupo = document.getElementById('filtroGrupo');

const selectCampo = document.getElementById('campoBusqueda');
const inputBusqueda = document.getElementById('inputBusqueda'); 
const btnReiniciar = document.getElementById('btn-reiniciar-busca');


// Variables de permisos:
const DIRECTOR_ROL_ID = '2';
const ASESOR_ROL_ID = '3';
let usuarioActual = obtenerSesion();

// Determinar el rol actual
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;
let esAsesor = usuarioActual && usuarioActual.idRol === ASESOR_ROL_ID;
let isAdmin = !esDirector && !esAsesor;

let idCrieDirector = null; // Se cargará asíncronamente si es Director
let idAsesorActual = null; // Se establecerá si es Asesor


// Funciones Auxiliares para Roles:

/**
 * Obtiene el idCrie del Director a partir de su entidadId (llave en colección Director).
 * @param {string} entidadId - El ID del documento en la colección 'Director'.
 * @returns {Promise<string|null>} El idCrie asociado.
 */
async function obtenerIdCrieDirector(entidadId) {
    if (!entidadId) return null;

    try {
        const directorRef = doc(db, 'Director', entidadId);
        const docSnap = await getDoc(directorRef);

        if (docSnap.exists()) {
            return docSnap.data().idCrie;
        } else {
            console.warn("No se encontró registro de Director para el entidadId proporcionado.");
            return null;
        }
    } catch (error) {
        console.error("Error al obtener el idCrie del Director:", error);
        mostrarNotificacion("Error: No se pudo verificar la entidad CRIE asociada.", 'danger');
        return null;
    }
}


//**********************Inicialización**********************

//1. Funcion para iniciar eventos y cargar datos base
function inicializarEventos() {
    
    //Evento principal del formulario de filtros y búsqueda
    if (formFiltrosBusqueda) {
        formFiltrosBusqueda.addEventListener('submit', (e) => {
            e.preventDefault();
            aplicarFiltrosYBusqueda();
        });
    }

    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarFiltrosYBusqueda);
    }

    //Evento de cambio para el filtro CRIE (Maneja el cambio de CRIE Y aplica filtros)
    if (selectCRIE) {
        selectCRIE.addEventListener('change', manejarCambioCRIE);
    }

    //Eventos de cambio para los filtros Escuela, Grado y Grupo (Disparan el filtrado inmediato)
    if (selectEscuela) {
        selectEscuela.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    if (selectGrado) {
        selectGrado.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    if (selectGrupo) {
        selectGrupo.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    
    //Evento de click para Acciones de la Tabla (Bloqueo, Editar, Ver)
    const tablaBody = document.getElementById('tablaBodyNinos');
    if (tablaBody) {
        tablaBody.addEventListener('click', manejarAccionesTabla);
    }
}

//2. Función para cargar CRIE, escuelas, grados y grupos para los selects y lookups
async function cargarDatosRelacionales() {
    console.log("Cargando datos relacionales...");

    try {
        // Cargar CRIE (Necesario para Director y Admin)
        const crieSnapshot = await getDocs(collection(db, 'Crie'));
        datosRelacionales.cries = crieSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data();
            return acc;
        }, {});

        // Cargar Escuelas
        const escuelaSnapshot = await getDocs(collection(db, 'Escuela'));
        datosRelacionales.escuelas = escuelaSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data();
            return acc;
        }, {});

        // Cargar Grados
        const gradoSnapshot = await getDocs(collection(db, 'Grado'));
        datosRelacionales.grados = gradoSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data().numGrado; 
            return acc;
        }, {});

        // Cargar Grupos
        const grupoSnapshot = await getDocs(collection(db, 'Grupo'));
        datosRelacionales.grupos = grupoSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data().nombreGrupo;
            return acc;
        }, {});

    } catch (error) {
        console.error("Error al cargar datos relacionales:", error);
    }
}

//3. Función que renderiza los selects de CRIE, grado y grupo (Adaptada a Director y Asesor)
function renderizarSelectsFiltro(data, escuelasAsesor = null) {
    
    // Lógica para el filtro CRIE: 
    if (selectCRIE) {
        selectCRIE.innerHTML = '';
        
        if (esDirector && idCrieDirector) {
            // Director: Solo su CRIE y deshabilitado
            const crie = data.cries[idCrieDirector];
            if (crie) {
                selectCRIE.innerHTML += `<option value="${idCrieDirector}" selected>${crie.nombre} (${crie.cct})</option>`;
                selectCRIE.disabled = true; 
            } else {
                 selectCRIE.innerHTML += '<option value="" selected>CRIE no encontrado</option>';
                 selectCRIE.value = '';
            }
        } else if (esAsesor) {
            // Asesor: Ocultamos el campo CRIE completamente (lógica en DOMContentLoaded)
            // No hacemos nada aquí.
        } else {
            // Administrador: Se muestran todos los CRIE y es editable.
            selectCRIE.innerHTML += '<option value="" selected>Todos los CRIE</option>';
            Object.keys(data.cries).forEach(id => {
                const crie = data.cries[id];
                selectCRIE.innerHTML += `<option value="${id}">${crie.nombre} (${crie.cct})</option>`;
            });
            selectCRIE.disabled = false; 
        }
    }
    
    // Lógica para el filtro Escuela: 
    if (selectEscuela) {
        selectEscuela.innerHTML = '<option value="" selected>Todas las Escuelas</option>';
        selectEscuela.disabled = false;
        
        if (esAsesor && escuelasAsesor) {
            // Asesor: Solo sus escuelas asignadas
            escuelasAsesor.forEach(idEscuela => {
                const escuela = data.escuelas[idEscuela];
                if (escuela) {
                    selectEscuela.innerHTML += `<option value="${idEscuela}">${escuela.nombre}</option>`;
                }
            });
        } else if (esDirector && idCrieDirector) {
            // Director: Las escuelas de su CRIE
            Object.keys(data.escuelas).forEach(idEscuela => {
                const escuela = data.escuelas[idEscuela];
                if (escuela.idCrie === idCrieDirector) {
                    selectEscuela.innerHTML += `<option value="${idEscuela}">${escuela.nombre}</option>`;
                }
            });
        } else if (!esAsesor && !esDirector) {
            // Administrador: Inicialmente deshabilitado hasta seleccionar CRIE
            selectEscuela.disabled = true;
            selectEscuela.innerHTML = '<option value="" selected>Seleccione un CRIE primero</option>';
        }
    }


    // Lógica para los filtros Grado y Grupo (no cambian por rol, solo se llenan)
    if (selectGrado) {
        selectGrado.innerHTML = '<option value="" selected>Todos</option>';
        const gradosOrdenados = Object.keys(data.grados).sort((a, b) => data.grados[a] - data.grados[b]);
        gradosOrdenados.forEach(id => {
            selectGrado.innerHTML += `<option value="${id}">${data.grados[id]}</option>`;
        });
    }

    if (selectGrupo) {
        selectGrupo.innerHTML = '<option value="" selected>Todos</option>';
        const gruposOrdenados = Object.keys(data.grupos).sort((a, b) => data.grupos[a].localeCompare(data.grupos[b]));
        gruposOrdenados.forEach(id => {
            selectGrupo.innerHTML += `<option value="${id}">${data.grupos[id]}</option>`;
        });
    }
}

//4. Función que maneja el cambio en el select de CRIE (Solo Admin lo dispara, los demás ya están fijos)
function manejarCambioCRIE(isInitialLoad = false) {
    
    // Esta función solo opera completamente si es Administrador, ya que Director/Asesor tienen filtros fijos.
    if (!isAdmin) {
        if (!isInitialLoad) aplicarFiltrosYBusqueda();
        return;
    }
    
    const idCRIE = selectCRIE.value; 

    if (selectEscuela) {
        selectEscuela.innerHTML = '<option value="" selected>Todas las Escuelas</option>';
        selectEscuela.disabled = false;
        
        if (idCRIE) {
            Object.keys(datosRelacionales.escuelas).forEach(idEscuela => {
                const escuela = datosRelacionales.escuelas[idEscuela];
                // Solo renderiza escuelas que pertenecen al CRIE seleccionado
                if (escuela.idCrie === idCRIE) {
                    selectEscuela.innerHTML += `<option value="${idEscuela}">${escuela.nombre}</option>`;
                }
            });
            
        } else {
            // Si no hay CRIE seleccionado (Admin)
             selectEscuela.disabled = true;
             selectEscuela.innerHTML = '<option value="" selected>Seleccione un CRIE primero</option>';
        }
        
        if (!isInitialLoad) {
            aplicarFiltrosYBusqueda();
        }
    }
}


// ********************** Obtención de Datos **********************

//5. Función que hace la consulta a la base de datos de firebase para recuperar los Niños (Adaptada a todos los roles)
async function obtenerNinosConDetalles() {
    console.log("Iniciando obtención de Niños y sus detalles...");

    document.getElementById('tablaBodyNinos').innerHTML = '<tr><td colspan="5" class="text-center">Cargando niños...</td></tr>';
    
    // 1. Cargar datos relacionales (CRIE, Escuelas, etc.)
    await cargarDatosRelacionales();
    
    let queryNinos = collection(db, 'Nino');
    let idEscuelasAFiltrar = null;

    // 2. Lógica de filtro de roles (Director/Asesor)
    if (esDirector) {
        idCrieDirector = await obtenerIdCrieDirector(usuarioActual.entidadId);

        if (!idCrieDirector) {
            mostrarNotificacion("Error: Su cuenta de Director no está vinculada a un CRIE.", 'danger');
            renderizarTablaNinos([]);
            return;
        }

        // Obtener los IDs de las escuelas asociadas a este CRIE
        idEscuelasAFiltrar = Object.keys(datosRelacionales.escuelas).filter(id => {
            return datosRelacionales.escuelas[id].idCrie === idCrieDirector;
        });

        console.log(`Aplicando filtro: solo Niños de las escuelas del CRIE: ${idCrieDirector}`);
        
    } else if (esAsesor) {
        idAsesorActual = usuarioActual.entidadId;
        
        // Obtener los IDs de las escuelas donde idAsesor es este usuario
        idEscuelasAFiltrar = Object.keys(datosRelacionales.escuelas).filter(id => {
            return datosRelacionales.escuelas[id].idAsesor === idAsesorActual;
        });

        console.log(`Aplicando filtro: solo Niños de las escuelas del Asesor: ${idAsesorActual}`);
    }


    // Aplicar filtro en Firebase si hay una restricción por rol
    if (idEscuelasAFiltrar && idEscuelasAFiltrar.length > 0) {
        // NOTA: Firebase soporta hasta 10 elementos en el array 'in'
        if (idEscuelasAFiltrar.length > 10) {
             console.error("ADVERTENCIA: Más de 10 escuelas asociadas, el filtro 'in' de Firebase podría fallar.");
             mostrarNotificacion("Advertencia: Demasiadas escuelas asociadas, la lista podría ser incompleta. Contacte a soporte.", 'warning');
             // Usamos solo los primeros 10 elementos
             const top10Escuelas = idEscuelasAFiltrar.slice(0, 10);
             queryNinos = query(queryNinos, where('idEscuela', 'in', top10Escuelas));
        } else {
             queryNinos = query(queryNinos, where('idEscuela', 'in', idEscuelasAFiltrar));
        }
    } else if ((esDirector || esAsesor) && idEscuelasAFiltrar.length === 0) {
        // Si es Director o Asesor y no tiene escuelas, no hay niños que mostrar
        mostrarNotificacion("Advertencia: No se encontraron escuelas asociadas a su entidad.", 'warning');
        renderizarTablaNinos([]);
        return;
    }


    try {
        const snapshotNino = await getDocs(queryNinos);
        const listaNinosData = [];
        const usuarioPromises = []; 

        snapshotNino.forEach(docNino => {
            const nino = { id: docNino.id, ...docNino.data() }; 
            listaNinosData.push(nino);

            // Preparar para obtener el detalle del Usuario
            if (nino.idUsuario) {
                const usuarioRef = doc(db, 'Usuario', nino.idUsuario);
                usuarioPromises.push(
                    getDoc(usuarioRef).then(docUsuario => {
                        if (docUsuario.exists()) {
                            return { idUsuario: nino.idUsuario, ...docUsuario.data() };
                        }
                        return { idUsuario: nino.idUsuario, status: 0 }; 
                    })
                );
            }
        });

        const usuariosData = await Promise.all(usuarioPromises);
        const usuariosMap = usuariosData.reduce((map, usuario) => {
            map[usuario.idUsuario] = usuario;
            return map;
        }, {});
        
        const listaNinosFinal = listaNinosData.map(nino => {
            
            const usuarioDetalles = usuariosMap[nino.idUsuario] || { status: 0 };
            const escuela = datosRelacionales.escuelas[nino.idEscuela] || { nombre: 'Escuela Desconocida', idCrie: null };
            const crie = datosRelacionales.cries[escuela.idCrie] || { nombre: 'CRIE Desconocido' };
            const grado = datosRelacionales.grados[nino.idGrado] || 'N/A';
            const grupo = datosRelacionales.grupos[nino.idGrupo] || 'N/A';
            
            return {
                idNino: nino.id,
                nombre: nino.nombre,
                apellidoPaterno: nino.apellido_paterno,
                apellidoMaterno: nino.apellido_materno,
                curp: nino.curp,
                idUsuario: nino.idUsuario,
                status: usuarioDetalles.status, 
                idEscuela: nino.idEscuela, 
                nombreEscuela: escuela.nombre,
                idCrie: escuela.idCrie,
                nombreCrie: crie.nombre,
                idGrado: nino.idGrado,
                numGrado: grado,
                idGrupo: nino.idGrupo,
                nombreGrupo: grupo,
                nombreCompleto: `${nino.nombre} ${nino.apellido_paterno} ${nino.apellido_materno}`,
                gradoGrupo: `${grado}° ${grupo}`
            };
        });

        // Almacena la lista completa (ya pre-filtrada si es Director/Asesor)
        listaNinosCompleta = listaNinosFinal;
        ninosFiltradosActuales = listaNinosCompleta;
        
        // 3. Renderizar Selects con la data relacional y el filtro de rol
        renderizarSelectsFiltro(datosRelacionales, idEscuelasAFiltrar); 
        
        // 4. Renderiza la lista
        renderizarTablaNinos(listaNinosCompleta);

    } catch (error) {
        console.error("Error al obtener los datos de Niños:", error);
        mostrarNotificacion("Error al cargar la lista de niños. Verifique su conexión.", 'danger');
        renderizarTablaNinos([]); 
    }
}


//**********************Renderizado y Acciones**********************

//6. La función que renderiza, vaya, la que se encarga de cargar todos las filas en la tabla
function renderizarTablaNinos(ninos) {
    const tablaBody = document.getElementById('tablaBodyNinos');
    if (!tablaBody) return; 

    tablaBody.innerHTML = ''; 
    ninosFiltradosActuales = ninos;

    if (ninos.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay niños registrados o coincidencias con el término de búsqueda/filtro.</td></tr>';
        return;
    }

    ninos.forEach(nino => {
        const row = document.createElement('tr');
        
        //Lógica de bloqueo/desbloqueo
        const isActivo = nino.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock'; 
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear Usuario' : 'Activar Usuario'; 
        
        //Inserta las filas
        row.innerHTML = `
            <td>${nino.curp}</td>
            <td>${nino.nombreCompleto}</td>
            <td>${nino.nombreEscuela}</td>
            <td>${nino.gradoGrupo}</td>
            <td>
                ${nino.idUsuario ? `
                    <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idusuario="${nino.idUsuario}">
                        <i class="fas ${icon}"></i>
                    </button>
                ` : ''}
                
                <button class="btn btn-action btn-edit me-2" title="Editar Niño" data-idnino="${nino.idNino}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-action btn-view" title="Ver Expediente" data-idnino="${nino.idNino}">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        tablaBody.appendChild(row);
    });
}

//7. Manejar acciones de la tabla (Bloqueo, Editar, Ver)
function manejarAccionesTabla(e) {
    
    //Lógica de Bloqueo/Desbloqueo
    const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
    if (buttonLock) {
        const idUsuario = buttonLock.dataset.idusuario;
        // Buscar el Niño en la lista completa para obtener el status
        const ninoEncontrado = listaNinosCompleta.find(n => n.idUsuario === idUsuario); 
        if (ninoEncontrado) {
            cambiarEstadoUsuario(idUsuario, ninoEncontrado.status);
        }
        return; 
    }
    
    //Logica para los botones de editar
    const buttonEdit = e.target.closest('.btn-edit');
    if (buttonEdit) {
        const idNinoEditar = buttonEdit.dataset.idnino; 
        window.location.href = `formNino.html?idNino=${idNinoEditar}`;
        return;
    }

    //Logica de los botones de detalles
    const buttonView = e.target.closest('.btn-view');
    if (buttonView) {
        const idNinoVer = buttonView.dataset.idnino; 
        window.location.href = `detalleNino.html?idNino=${idNinoVer}`;
        return;
    }      
}


//-------Otras acciones-------

//Cambia el estado (status) de un usuario (1=activo, 0=bloqueado)
async function cambiarEstadoUsuario(idUsuario, currentStatus) {
    if (!idUsuario) {
        mostrarNotificacion('Error: ID de usuario no proporcionado.', 'danger');
        return;
    }

    const nuevoStatus = currentStatus === 1 ? 0 : 1;
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";

    try {
        const usuarioRef = doc(db, 'Usuario', idUsuario);
        
        await updateDoc(usuarioRef, {
            status: nuevoStatus
        });

        mostrarNotificacion(`El usuario asociado al niño fue ${mensajeAccion} correctamente.`, 'success');
        
        // Actualizar el estado localmente sin recargar todos los datos
        const indice = listaNinosCompleta.findIndex(nino => nino.idUsuario === idUsuario);

        if (indice !== -1) {
            listaNinosCompleta[indice].status = nuevoStatus;
            aplicarFiltrosYBusqueda(); // Re-renderizar la tabla manteniendo los filtros actuales
        } else {
            // Si por alguna razón no lo encontramos, hacemos una recarga completa
            await obtenerNinosConDetalles(); 
        }

    } catch (error) {
        console.error("Error al actualizar el estado del usuario:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al usuario asociado.`, 'danger');
    }
}


//*******************Lógica de Filtrado y Búsqueda*******************

//8. Reiniciar todos los filtros y la búsqueda
function reiniciarFiltrosYBusqueda() {
    
    // El CRIE se mantiene fijo si es Director/Asesor, solo reinicia la Escuela
    if (isAdmin && selectCRIE) selectCRIE.value = ""; 
    
    if (selectEscuela) {
        selectEscuela.value = "";
        manejarCambioCRIE(true); // Re-inicializa las escuelas del CRIE actual (solo afecta a Admin)
    }
    
    if (selectGrado) selectGrado.value = "";
    if (selectGrupo) selectGrupo.value = "";
    
    //2. Limpiar campo de búsqueda de texto
    if (inputBusqueda) {
        inputBusqueda.value = '';
    }
    
    //3. Mostrar la lista completa (reiniciar el filtro)
    renderizarTablaNinos(listaNinosCompleta);

    //4. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
}


//9. Función principal para aplicar todos los filtros y la búsqueda
function aplicarFiltrosYBusqueda() {
    
    // Solo el Admin usa el filtro CRIE dinámico
    const idCRIE = isAdmin ? selectCRIE.value : (esDirector ? idCrieDirector : (esAsesor ? '' : ''));
    
    const idEscuela = selectEscuela.value;
    const idGrado = selectGrado.value;
    const idGrupo = selectGrupo.value;
    
    const campoBusqueda = selectCampo.value; 
    const terminoBusqueda = inputBusqueda.value.toLowerCase().trim();

    // 1. Aplicar los filtros Select (AND)
    // listaNinosCompleta ya está pre-filtrada por rol si corresponde.
    let resultadosFiltrados = listaNinosCompleta.filter(nino => {
        
        // Filtrar por CRIE (Solo aplica si es Admin, o si Admin filtró por CRIE)
        if (idCRIE && nino.idCrie !== idCRIE) {
            return false;
        }
        
        //Filtrar por Escuela
        if (idEscuela && nino.idEscuela !== idEscuela) {
            return false;
        }
        //Filtrar por Grado
        if (idGrado && nino.idGrado !== idGrado) {
            return false;
        }
        //Filtrar por Grupo
        if (idGrupo && nino.idGrupo !== idGrupo) {
            return false;
        }
        return true; //Pasa todos los filtros SELECT
    });
    
    //2. Aplicar la búsqueda por texto
    if (terminoBusqueda) {
        resultadosFiltrados = resultadosFiltrados.filter(nino => {
            let valorCampo = '';
            
            switch (campoBusqueda) {
                case 'curp':
                    valorCampo = String(nino.curp).toLowerCase();
                    break;

                case 'nombre_completo':
                    // Búsqueda compleja: el término debe estar en Nombre, Apellido Paterno O Apellido Materno
                    const nombre = String(nino.nombre).toLowerCase();
                    const apPaterno = String(nino.apellidoPaterno).toLowerCase();
                    const apMaterno = String(nino.apellidoMaterno).toLowerCase();
                    
                    return nombre.includes(terminoBusqueda) || 
                               apPaterno.includes(terminoBusqueda) || 
                               apMaterno.includes(terminoBusqueda);
                                                        
                case 'nombre':
                    valorCampo = String(nino.nombre).toLowerCase();
                    break;
                case 'apellidoPaterno':
                    valorCampo = String(nino.apellidoPaterno).toLowerCase();
                    break;
                case 'apellidoMaterno':
                    valorCampo = String(nino.apellidoMaterno).toLowerCase();
                    break;
                default:
                    return false;
            }
            
            return valorCampo.includes(terminoBusqueda);
        });
        
        btnReiniciar.classList.remove('d-none'); 

    } else {
        // Lógica de ocultar/mostrar botón Reiniciar solo para filtros select activos
        const hayFiltrosActivos = idCRIE || idEscuela || idGrado || idGrupo;
        
        if (hayFiltrosActivos) {
             btnReiniciar.classList.remove('d-none'); 
        } else {
             btnReiniciar.classList.add('d-none'); 
        }
    }
    
    //4. Renderizar los resultados
    renderizarTablaNinos(resultadosFiltrados);
}

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

document.addEventListener('DOMContentLoaded', () => {
    
    // Lógica para ocultar/deshabilitar campos de filtro CRIE si el usuario es Director o Asesor
    if (esDirector || esAsesor) {
        const crieFilterGroup = selectCRIE.closest('.filter-group');
        if (crieFilterGroup) {
            // Oculta el contenedor completo del filtro CRIE
             crieFilterGroup.classList.add('d-none');
        }
    }
    
    manejarNotificacionPendiente(); 
    inicializarEventos(); 
    obtenerNinosConDetalles(); // Carga los datos (aplica filtro de rol si corresponde)
});