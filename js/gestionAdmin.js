//Importaciones de  la instancia de la base de datos (db)
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore
import { collection, getDocs, doc, getDoc, updateDoc  } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


//Variables globales
let listaAdministradoresCompleta = []; 

//Elementos del DOM HTML
const selectCampo = document.getElementById('buscarPor');
const inputBusqueda = document.querySelector('.search-bar input[type="text"]'); 
const btnReiniciar = document.getElementById('btn-reiniciar-busca');

//Funciones, métodos y eventos------------------


//**********************Inicialización**********************
//1. Funcion para iniciar eventos
function inicializarEventos() {
    // Evento de búsqueda (se mantiene igual)
    const btnBuscar = document.getElementById('btn-empezar-busca'); // Usar ID es más directo
    
    if (btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            filtrarAdministradores();
        });
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filtrarAdministradores();
                }
             });
        }
    } 
    
    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarBusqueda);
    }

    //Bloqueo y desbloqueo
    //Al usar delegación de eventos, solo necesitamos un listener en el contenedor de la tabla (el body)
    const tablaBody = document.querySelector('.custom-table tbody');
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            
            //Lógica de Bloqueo/Desbloqueo
            const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
            if (buttonLock) {
                const idUsuario = buttonLock.dataset.idusuario;
                const adminEncontrado = listaAdministradoresCompleta.find(admin => admin.idUsuario === idUsuario);
                if (adminEncontrado) {
                    cambiarEstadoUsuario(idUsuario, adminEncontrado.status);
                }
                return; //Salir después de manejar el evento de bloqueo
            }

            //Logica para los botones de editar
            const buttonEdit = e.target.closest('.btn-edit');
            if (buttonEdit) {
                const idAdminEditar = buttonEdit.dataset.idadmin; 
                //Redirige al formulario, pasando el ID del Administrador como parámetro URL
                window.location.href = `formAdministradores.html?idAdmin=${idAdminEditar}`;
            }

            //Logica de los botones de detalles
            const buttonView = e.target.closest('.btn-view');
            if (buttonView) {
                const idAdminVer = buttonView.dataset.idadmin; 
                //Redirige a la página de detalle, pasando el ID
                window.location.href = `detalleAdministradores.html?idAdmin=${idAdminVer}`;
                return;
            }            

        });
    }
}



//2. Función que hace la consulta a la base de datos de firebase para recuperar todos los administradores
async function obtenerAdministradoresConDetalles() {
    console.log("Iniciando obtención de Administradores y sus detalles de Usuario...");
    
    const administradoresCol = collection(db, 'Administrador');
    
    try {
        const snapshotAdmin = await getDocs(administradoresCol);
        const usuarioPromises = [];
        const administradoresData = [];

        snapshotAdmin.forEach(docAdmin => {
            const admin = { id: docAdmin.id, ...docAdmin.data() }; 
            administradoresData.push(admin);

            const idUsuario = admin.idUsuario;
            const usuarioRef = doc(db, 'Usuario', idUsuario);
            
            usuarioPromises.push(
                getDoc(usuarioRef).then(docUsuario => {
                    if (docUsuario.exists()) {
                        return { idUsuario: idUsuario, ...docUsuario.data() };
                    }
                    return { idUsuario: idUsuario, usuario: 'Usuario no encontrado' };
                })
            );
        });

        const usuariosData = await Promise.all(usuarioPromises);
        
        const usuariosMap = usuariosData.reduce((map, usuario) => {
            map[usuario.idUsuario] = usuario;
            return map;
        }, {});
        
        const listaFinalAdministradores = administradoresData.map(admin => {
            const usuarioDetalles = usuariosMap[admin.idUsuario] || {};
            
            return {
                idAdmin: admin.id, 
                nombre: admin.nombre,
                usuario: usuarioDetalles.usuario || 'N/A', // El username real
                idUsuario: admin.idUsuario, 
                status: usuarioDetalles.status 
            };
        });

        //Almacena la lista completa
        listaAdministradoresCompleta = listaFinalAdministradores;
        
        // Renderiza la lista completa al inicio
        filtrarAdministradores();

    } catch (error) {
        console.error("Error al obtener los datos cruzados:", error);
        renderizarTablaAdministradores([]); 
    }
}

//3. La función que renderiza, vaya, la que se encarga de cargar todos las filas en la tabla
function renderizarTablaAdministradores(administradores) {
    const tablaBody = document.querySelector('.custom-table tbody');
    if (!tablaBody) return; 

    tablaBody.innerHTML = ''; 

    if (administradores.length === 0) {
        // Mensaje modificado para incluir el caso de lista vacía también
        tablaBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay administradores registrados o coincidencias con el término de búsqueda.</td></tr>';
        return;
    }

    administradores.forEach(admin => {
        const row = document.createElement('tr');
        
        //Los estilos de bloqueo y desbloqueo
        const isActivo = admin.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock'; 
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear Usuario' : 'Activar Usuario'; 

        //Inserta las filas
        row.innerHTML = `
            <td>${admin.nombre}</td>
            <td>${admin.usuario}</td>
            <td>
                <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idusuario="${admin.idUsuario}">
                    <i class="fas ${icon}"></i>
                </button>
                <button class="btn btn-action btn-edit me-2" title="Editar Administrador" data-idadmin="${admin.idAdmin}" data-idusuario="${admin.idUsuario}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tablaBody.appendChild(row);
    });
}



//******************* De filtrado *******************
//1. Reiniciar la busqueda
function reiniciarBusqueda() {
    //1. Limpiar el campo de búsqueda
    if (inputBusqueda) {
        inputBusqueda.value = '';
    }
    
    //2. Mostrar la lista completa (reiniciar el filtro)
    filtrarAdministradores();

    //3. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
}


//2. Para el filtrado
function filtrarAdministradores() {
    if (!selectCampo || !inputBusqueda || !btnReiniciar) {
        console.error("Elementos de búsqueda no encontrados.");
        return;
    }

    const campo = selectCampo.value; 
    const termino = inputBusqueda.value.toLowerCase().trim();

    //Siempre status !== 0 Y luego el término de búsqueda
    const resultadosFiltrados = listaAdministradoresCompleta.filter(admin => {
        
        //1.Si está bloqueado (0), no pasa el filtro
        if (admin.status === 0) return false;

        //2. Si el buscador está vacío, ya pasó el filtro (porque el status no es 0)
        if (termino === "") return true;

        //3. Si hay búsqueda, aplicamos el filtro por campo
        const valorCampo = String(admin[campo]).toLowerCase(); 
        return valorCampo.includes(termino);
    });

    //Lógica para mostrar/ocultar el botón Reiniciar
    if (termino === "") {
        btnReiniciar.classList.add('d-none');
    } else {
        btnReiniciar.classList.remove('d-none');
    }

    //Renderizamos los resultados que pasaron AMBOS filtros
    renderizarTablaAdministradores(resultadosFiltrados);
}




//************* Otras acciones ********+++++++++++++++++++++

//Cambiar el estado de un usuario
async function cambiarEstadoUsuario(idUsuario, currentStatus) {
    if (!idUsuario) {
        mostrarNotificacion('Error: ID de usuario no proporcionado.', 'danger');
        return;
    }

    const nuevoStatus = currentStatus === 1 ? 0 : 1; // 1 -> 0 (Bloquear) o 0 -> 1 (Desbloquear)
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";

    try {
        const usuarioRef = doc(db, 'Usuario', idUsuario);
        
        await updateDoc(usuarioRef, {
            status: nuevoStatus
        });

        //4. Mostrar notificación de éxito
        mostrarNotificacion(`El administrador fue ${mensajeAccion} correctamente.`, 'success');
        
        //5. Recargar la tabla para mostrar el estado actualizado
        await obtenerAdministradoresConDetalles();

    } catch (error) {
        console.error("Error al actualizar el estado del usuario:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} al administrador.`, 'danger');
    }
}



//Para el truco del registro:
//Manda a llamar a la notificación para que se muestre después de un registro o edición.
//o ante cualquier notificación pendiente según se requiera.
function manejarNotificacionPendiente() {
    const notificacionData = sessionStorage.getItem('notificacionPendiente');
    
    if (notificacionData) {
        try {
            //Parseamos el objeto que guardamos
            const notificacion = JSON.parse(notificacionData);
            
            //Mostramos la notificación
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
obtenerAdministradoresConDetalles();