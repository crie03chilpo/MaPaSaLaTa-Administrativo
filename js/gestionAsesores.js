//Importaciones de la instancia de la base de datos
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { obtenerSesion } from "./sessionManager.js";


//Variables globales
let listaAsesoresCompleta = [];
//Almacena los CRIE para mapeo rápido (idCrie -> nombre)
let crieMap = {};

//Elementos del DOM HTML
const selectCampo = document.getElementById('campoBusquedaAsesor');
const inputBusqueda = document.getElementById('terminoBusquedaAsesor');
const btnReiniciar = document.getElementById('btn-reiniciar-busca-asesor');

//Variables permisos:
const DIRECTOR_ROL_ID = '2';
let usuarioActual = obtenerSesion();
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;
let idCrieDirector = null; // Se cargará asíncronamente

//Funciones, métodos y eventos------------------


//Funciones de Director:
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
        mostrarNotificacion("Error de seguridad: No se pudo verificar la entidad CRIE asociada.", 'danger');
        return null;
    }
}

//**********************Inicialización**********************
//1. Funcion para iniciar eventos (para filtros, búsqueda y acciones de la tabla)
function inicializarEventos() {
    //Evento de búsqueda
    const btnBuscar = document.getElementById('btn-empezar-busca-asesor');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            filtrarAsesores();
        });
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filtrarAsesores();
                }
            });
        }
    }

    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarBusqueda);
    }

    //Bloqueo, Desbloqueo, Edición y Detalles
    const tablaBody = document.getElementById('cuerpoTablaAsesores');
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {

            //Lógica de Bloqueo/Desbloqueo
            const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
            if (buttonLock) {
                const idUsuario = buttonLock.dataset.idusuario;
                //Buscar el Asesor en la lista completa para obtener su status actual
                const asesorEncontrado = listaAsesoresCompleta.find(ase => ase.idUsuario === idUsuario);
                if (asesorEncontrado) {
                    cambiarEstadoUsuario(idUsuario, asesorEncontrado.status);
                }
                return;
            }

            //Lógica para los botones de editar
            const buttonEdit = e.target.closest('.btn-edit');
            if (buttonEdit) {
                const idAsesorEditar = buttonEdit.dataset.idasesor;
                //Redirige al formulario, pasando el ID del Asesor como parámetro URL
                window.location.href = `formAsesor.html?idAsesor=${idAsesorEditar}`;
            }

            //Para asignar directamente
            const buttonAssign = e.target.closest('.btn-assign');
            if (buttonAssign) {
                const idAsesorAsignar = buttonAssign.dataset.idasesor;
                //Pasamos un parámetro 'from' para saber el origen
                window.location.href = `asignarEscuelaAsesor.html?idAsesor=${idAsesorAsignar}&from=gestion`;
                return;
            }


            //Lógica de los botones de detalles
            const buttonView = e.target.closest('.btn-view');
            if (buttonView) {
                const idAsesorVer = buttonView.dataset.idasesor;
                //Redirige a la página de detalle, pasando el ID
                window.location.href = `detalleAsesor.html?idAsesor=${idAsesorVer}`;
                return;
            }

        });
    }
}


//Función auxiliar para obtener el mapeo de CRIE.
async function obtenerMapeoCRiE() {
    const crieCol = collection(db, 'Crie');
    const snapshotCrie = await getDocs(crieCol);

    snapshotCrie.forEach(docCrie => {
        //Almacena solo el nombre del CRIE, usando su ID como clave
        crieMap[docCrie.id] = docCrie.data().nombre;
    });
}


//2. Función que hace la consulta a la base de datos de firebase para recuperar todos los Asesores
async function obtenerAsesoresConDetalles() {
    console.log("Iniciando obtención de Asesores, Usuarios y CRiE...");

    const mensajeCarga = document.getElementById('mensajeCarga');
    if (mensajeCarga) mensajeCarga.classList.remove('d-none');

    try {

        if (esDirector) {
            idCrieDirector = await obtenerIdCrieDirector(usuarioActual.entidadId);

            if (!idCrieDirector) {
                mostrarNotificacion("Error: Su cuenta de Director no está vinculada a un CRIE.", 'danger');
                renderizarTablaAsesores([]);
                return;
            }
            // Ocultamos la columna CRIE asociado si es director, ya que solo verá el suyo
            document.querySelector('.tabla-asesores th:nth-child(3)').classList.add('d-none');
        }

        //1. Obtener y mapear CRIE 
        await obtenerMapeoCRiE();

        //2. Obtener todos los Asesores
        const asesoresCol = collection(db, 'Asesor');

        let queryAsesores = asesoresCol;
        if (esDirector) {
            // 💡 Filtro por idCrie
            const { query: queryFirestore, where } = await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js");
            queryAsesores = queryFirestore(asesoresCol, where('idCrie', '==', idCrieDirector));
            console.log(`Aplicando filtro: solo Asesores del CRIE: ${idCrieDirector}`);
        }        


        const snapshotAse = await getDocs(queryAsesores);

        const usuarioPromises = [];
        const asesoresData = [];

        snapshotAse.forEach(docAse => {
            const asesor = { id: docAse.id, ...docAse.data() };
            asesoresData.push(asesor);

            const idUsuario = asesor.idUsuario;

            //Prepara la promesa para obtener los detalles del Usuario
            if (idUsuario) {
                const usuarioRef = doc(db, 'Usuario', idUsuario);

                usuarioPromises.push(
                    getDoc(usuarioRef).then(docUsuario => {
                        if (docUsuario.exists()) {
                            return { idUsuario: idUsuario, ...docUsuario.data() };
                        }
                        return { idUsuario: idUsuario, usuario: 'Usuario asociado no existe', status: 0 };
                    }).catch(error => {
                        console.warn(`Error al obtener Usuario ${idUsuario}:`, error.message);
                        return { idUsuario: idUsuario, usuario: 'Error de carga', status: 0 };
                    })
                );
            } else {
                //Si idUsuario está ausente en el documento asesor
                usuarioPromises.push(Promise.resolve({ idUsuario: null, usuario: 'N/A', status: 0 }));
            }
        });

        //3. Ejecutar todas las consultas de Usuarios
        const usuariosData = await Promise.all(usuarioPromises);

        const usuariosMap = usuariosData.reduce((map, usuario) => {
            map[usuario.idUsuario] = usuario;
            return map;
        }, {});

        //4. Consolidar los datos y resolver idCrie
        const listaFinalAsesores = asesoresData.map(asesor => {
            const usuarioDetalles = usuariosMap[asesor.idUsuario] || {};

            //Lógica de mapeo del CRIE
            const nombreCrie = asesor.idCrie && crieMap[asesor.idCrie]
                ? crieMap[asesor.idCrie]
                : 'Pendiente por asignar';

            return {
                idAsesor: asesor.id, //ID de la colección Asesor
                nombre: asesor.nombre,
                idCrie: asesor.idCrie,
                nombreCrie: nombreCrie, //Nombre del CRIE
                usuario: usuarioDetalles.usuario || 'N/A',
                idUsuario: asesor.idUsuario,
                status: usuarioDetalles.status
            };
        });

        //Almacena la lista completa y ordena alfabéticamente
        listaAsesoresCompleta = listaFinalAsesores.sort((a, b) =>
            String(a.nombre).localeCompare(String(b.nombre))
        );

        //Renderiza la lista completa al inicio
        filtrarAsesores();

    } catch (error) {
        console.error("Error al obtener los datos cruzados de Asesores:", error);
        mostrarNotificacion("Error al cargar la lista de Asesores. Verifique su conexión.", 'danger');
        renderizarTablaAsesores([]);
    } finally {
        if (mensajeCarga) mensajeCarga.classList.add('d-none');
    }
}

//3. La función que renderiza la tabla
function renderizarTablaAsesores(asesores) {
    const tablaBody = document.getElementById('cuerpoTablaAsesores');
    if (!tablaBody) return;

    tablaBody.innerHTML = '';

    const ocultarCrie = esDirector ? 'd-none' : '';

    if (asesores.length === 0) {
        //Mensaje para el caso de lista vacía o sin coincidencias
        tablaBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay asesores registrados o coincidencias con el término de búsqueda.</td></tr>';
        return;
    }

    asesores.forEach(asesor => {
        const row = document.createElement('tr');

        //Los estilos de bloqueo y desbloqueo
        const isActivo = asesor.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock';
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear Usuario' : 'Activar Usuario';

        //Inserta las filas
        row.innerHTML = `
            <td>${asesor.nombre}</td>
            <td>${asesor.usuario}</td>
            <td class="${ocultarCrie}">${asesor.nombreCrie}</td>
            <td>
                <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idusuario="${asesor.idUsuario}">
                    <i class="fas ${icon}"></i>
                </button>
                <button class="btn btn-action btn-edit me-2" title="Editar Asesor" data-idasesor="${asesor.idAsesor}" data-idusuario="${asesor.idUsuario}">
                    <i class="fas fa-edit"></i>
                </button>

                <button class="btn btn-action btn-success me-2 btn-assign" title="Asignar Escuelas" data-idasesor="${asesor.idAsesor}">
          <i class="fas fa-plus"></i>
        </button>


            </td>
        `;
        tablaBody.appendChild(row);
    });
}


//*******************De filtrado*******************
//Reiniciar la busqueda
function reiniciarBusqueda() {
    //1. Limpiar el campo de búsqueda
    if (inputBusqueda) {
        inputBusqueda.value = '';
    }

    //2. Mostrar la lista completa (reiniciar el filtro)
    filtrarAsesores();

    //3. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
}


//2. Para el filtrado
function filtrarAsesores() {
    if (!selectCampo || !inputBusqueda || !btnReiniciar) {
        console.error("Elementos de búsqueda no encontrados.");
        return;
    }

    const campo = selectCampo.value;
    const termino = inputBusqueda.value.toLowerCase().trim();

    //Aplicamos el filtro de doble capa
    const resultadosFiltrados = listaAsesoresCompleta.filter(asesor => {
        
        //Seguridad (Si el status es 0, no pasa el filtro)
        if (asesor.status === 0) return false;

        //Si no hay búsqueda, el asesor pasa (porque ya sabemos que su status es 1)
        if (termino === "") return true;

        //Filtrado por término de búsqueda
        let valorCampo;
        if (campo === 'crie') {
            valorCampo = String(asesor.nombreCrie).toLowerCase();
        } else {
            valorCampo = String(asesor[campo]).toLowerCase();
        }

        return valorCampo.includes(termino);
    });

    //Control visual del botón reiniciar
    if (termino === "") {
        btnReiniciar.classList.add('d-none');
    } else {
        btnReiniciar.classList.remove('d-none');
    }

    //Renderizamos los resultados filtrados
    renderizarTablaAsesores(resultadosFiltrados);
}


//-------Otras acciones-------

//Cambia el estado (status) de un usuario (1=activo, 0=bloqueado)
async function cambiarEstadoUsuario(idUsuario, currentStatus) {
    if (!idUsuario) {
        mostrarNotificacion('Error: ID de usuario no proporcionado.', 'danger');
        return;
    }

    //Calcula el nuevo estado
    const nuevoStatus = currentStatus === 1 ? 0 : 1;
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";

    try {
        const usuarioRef = doc(db, 'Usuario', idUsuario);

        //1. Actualizar el documento en Firebase
        await updateDoc(usuarioRef, {
            status: nuevoStatus
        });

        //2. Mostrar notificación de éxito
        mostrarNotificacion(`El asesor fue ${mensajeAccion} correctamente.`, 'success');

        //3. Actualizar el estado localmente sin recargar todos los datos
        const indice = listaAsesoresCompleta.findIndex(ase => ase.idUsuario === idUsuario);

        if (indice !== -1) {
            //Actualiza el status en la lista global
            listaAsesoresCompleta[indice].status = nuevoStatus;

            //Renderiza la tabla con los datos ya actualizados
            filtrarAsesores();
        } else {
            //Si por alguna razón no lo encontramos, hacemos una recarga completa (caso de emergencia/seguridad)
            //Aunque esto traerá de nuevo el parpadeo de carga
            await obtenerAsesoresConDetalles();
        }

    } catch (error) {
        console.error("Error al actualizar el estado del usuario:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al asesor.`, 'danger');
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
document.addEventListener('DOMContentLoaded', () => {
    // Lógica para ocultar el campo CRIE en el filtro de búsqueda si es Director
    if (esDirector) {
        const crieOption = document.querySelector('#campoBusquedaAsesor option[value="crie"]');
        if (crieOption) {
            crieOption.remove();
        }
    }
    
    manejarNotificacionPendiente(); 
    inicializarEventos();
    obtenerAsesoresConDetalles();
});