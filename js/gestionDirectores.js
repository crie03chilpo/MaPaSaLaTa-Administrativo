// js/gestionDirectores.js

//Importaciones de la instancia de la base de datos (db)
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


//Variables globales
let listaDirectoresCompleta = [];
// Almacena los CRIE para mapeo rápido (idCrie -> nombre)
let crieMap = {};

//Elementos del DOM HTML
const selectCampo = document.getElementById('buscarPorDirector'); // ID específico de Directores
const inputBusqueda = document.getElementById('terminoBusquedaDirector'); // ID específico de Directores
const btnReiniciar = document.getElementById('btn-reiniciar-busca-director'); // ID específico de Directores

//Funciones, métodos y eventos------------------


//**********************Inicialización**********************
//1. Funcion para iniciar eventos
function inicializarEventos() {
    //Evento de búsqueda (se mantiene igual)
    const btnBuscar = document.getElementById('btn-empezar-busca-director');
    
    if (btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            filtrarDirectores();
        });
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filtrarDirectores();
                }
             });
        }
    } 
    
    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarBusqueda);
    }

    //Bloqueo, Desbloqueo, Edición y Detalles
    const tablaBody = document.getElementById('cuerpoTablaDirectores');
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            
            //Lógica de Bloqueo/Desbloqueo
            const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
            if (buttonLock) {
                const idUsuario = buttonLock.dataset.idusuario;
                const directorEncontrado = listaDirectoresCompleta.find(dir => dir.idUsuario === idUsuario);
                if (directorEncontrado) {
                    cambiarEstadoUsuario(idUsuario, directorEncontrado.status);
                }
                return;
            }

            //Logica para los botones de editar
            const buttonEdit = e.target.closest('.btn-edit');
            if (buttonEdit) {
                const idDirectorEditar = buttonEdit.dataset.iddirector;
                //Redirige al formulario, pasando el ID del Director como parámetro URL
                window.location.href = `formDirector.html?idDirector=${idDirectorEditar}`;
            }

            //Logica de los botones de detalles
            const buttonView = e.target.closest('.btn-view');
            if (buttonView) {
                const idDirectorVer = buttonView.dataset.iddirector;
                //Redirige a la página de detalle, pasando el ID
                window.location.href = `detalleDirector.html?idDirector=${idDirectorVer}`;
                return;
            }            

        });
    }
}


//Función auxiliar para obtener el mapeo de CRIE
async function obtenerMapeoCRiE() {
    const crieCol = collection(db, 'Crie');
    const snapshotCrie = await getDocs(crieCol);
    
    snapshotCrie.forEach(docCrie => {
        //Almacena solo el nombre del CRIE, usando su ID como clave
        crieMap[docCrie.id] = docCrie.data().nombre;
    });
}


//2. Función que hace la consulta a la base de datos de firebase para recuperar todos los directores
async function obtenerDirectoresConDetalles() {
    console.log("Iniciando obtención de Directores, Usuarios y CRiE...");
    
    const mensajeCarga = document.getElementById('mensajeCarga');
    if (mensajeCarga) mensajeCarga.classList.remove('d-none'); //Muestra mensaje de carga

    try {
        //1. Obtener y mapear CRiE (para resolución rápida)
        await obtenerMapeoCRiE();

        //2. Obtener todos los Directores
        const directoresCol = collection(db, 'Director');
        const snapshotDir = await getDocs(directoresCol);
        
        const usuarioPromises = [];
        const directoresData = [];

        snapshotDir.forEach(docDir => {
            const director = { id: docDir.id, ...docDir.data() }; 
            directoresData.push(director);

            const idUsuario = director.idUsuario;

            //Prepara la promesa para obtener los detalles del Usuario
                if (idUsuario) {
                    const usuarioRef = doc(db, 'Usuario', idUsuario);
                    
                    usuarioPromises.push(
                        getDoc(usuarioRef).then(docUsuario => {
                            if (docUsuario.exists()) {
                                return { idUsuario: idUsuario, ...docUsuario.data() };
                            }
                            //Devolver un objeto básico si la referencia es válida pero 
                            //el documento no existe
                            return { idUsuario: idUsuario, usuario: 'Usuario asociado no existe' };
                        })
                    );
                } else {
                    //Si idUsuario está ausente en el documento Director, agregamos un objeto vacío
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
        const listaFinalDirectores = directoresData.map(director => {
            const usuarioDetalles = usuariosMap[director.idUsuario] || {};
            
            //Lógica de mapeo del CRIE
            const nombreCrie = director.idCrie && crieMap[director.idCrie]
                               ? crieMap[director.idCrie]
                               : 'Pendiente por asignar';
            
            return {
                idDirector: director.id, 
                nombre: director.nombre,
                idCrie: director.idCrie,
                nombreCrie: nombreCrie, 
                usuario: usuarioDetalles.usuario || 'N/A',
                idUsuario: director.idUsuario, 
                status: usuarioDetalles.status 
            };
        });

        //Almacena la lista completa
        listaDirectoresCompleta = listaFinalDirectores;
        
        //Renderiza la lista completa al inicio
        // renderizarTablaDirectores(listaDirectoresCompleta);
        filtrarDirectores();

    } catch (error) {
        console.error("Error al obtener los datos cruzados de Directores:", error);
        renderizarTablaDirectores([]); 
    } finally {
        if (mensajeCarga) mensajeCarga.classList.add('d-none'); // Oculta mensaje de carga
    }
}

//3. La función que renderiza, vaya, la que se encarga de cargar todos las filas en la tabla
function renderizarTablaDirectores(directores) {
    const tablaBody = document.getElementById('cuerpoTablaDirectores');
    if (!tablaBody) return; 

    tablaBody.innerHTML = ''; 

    if (directores.length === 0) {
        //Mensaje para el caso de lista vacía o sin coincidencias
        tablaBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay directores registrados o coincidencias con el término de búsqueda.</td></tr>';
        return;
    }

    directores.forEach(director => {
        const row = document.createElement('tr');
        
        //Los estilos de bloqueo y desbloqueo
        const isActivo = director.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock'; 
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear Usuario' : 'Activar Usuario'; 

        //Inserta las filas
        row.innerHTML = `
            <td>${director.nombre}</td>
            <td>${director.usuario}</td>
            <td>${director.nombreCrie}</td> <td>
                <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idusuario="${director.idUsuario}">
                    <i class="fas ${icon}"></i>
                </button>
                <button class="btn btn-action btn-edit me-2" title="Editar Director" data-iddirector="${director.idDirector}" data-idusuario="${director.idUsuario}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tablaBody.appendChild(row);
    });
}



//*******************De filtrado*******************
//1. Reiniciar la busqueda
function reiniciarBusqueda() {
    //1. Limpiar el campo de búsqueda
    if (inputBusqueda) {
        inputBusqueda.value = '';
    }
    
    //2. Mostrar la lista completa (reiniciar el filtro)
    filtrarDirectores();

    //3. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
}


//2. Para el filtrado
function filtrarDirectores() {
    if (!selectCampo || !inputBusqueda || !btnReiniciar) {
        console.error("Elementos de búsqueda no encontrados.");
        return;
    }

    const campo = selectCampo.value; 
    const termino = inputBusqueda.value.toLowerCase().trim();

    // El filtro ahora tiene dos capas: Estatus y Búsqueda
    const resultadosFiltrados = listaDirectoresCompleta.filter(director => {
        
        // CAPA 1: Seguridad (Si el status es 0, se oculta siempre)
        if (director.status === 0) return false;

        // CAPA 2: Si no hay búsqueda, el director pasa (porque su status es 1)
        if (termino === "") return true;

        // CAPA 3: Si hay búsqueda, filtramos por el campo seleccionado
        let valorCampo;
        if (campo === 'crie') {
            valorCampo = String(director.nombreCrie).toLowerCase(); 
        } else {
            valorCampo = String(director[campo]).toLowerCase();
        }

        return valorCampo.includes(termino);
    });

    // Control del botón reiniciar
    if (termino === "") {
        btnReiniciar.classList.add('d-none');
    } else {
        btnReiniciar.classList.remove('d-none');
    }

    // Renderizamos solo los que pasaron los filtros
    renderizarTablaDirectores(resultadosFiltrados);
}





//------------------------Otras acciones------------------------

//Cambiar el estado de un usuario
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

        //Mostrar notificación de éxito
        mostrarNotificacion(`El director fue ${mensajeAccion} correctamente.`, 'success');
        
        //Recargar la tabla para mostrar el estado actualizado
        await obtenerDirectoresConDetalles();

    } catch (error) {
        console.error("Error al actualizar el estado del usuario:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al director.`, 'danger');
    }
}


//Para el truco del registro:
//Manda a llamar a la notificación para que se muestre después de un registro o edición.
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
    manejarNotificacionPendiente(); 
    inicializarEventos();
});

//Inicia el proceso al cargar la página
obtenerDirectoresConDetalles();