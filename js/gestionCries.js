//js/gestionCries.js

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
    query, // Se necesita para futuras consultas con filtros
    where // Se necesita para la consulta del Director por idCrie
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


//Variables globales
let listaCriesCompleta = []; 

//Elementos del DOM HTML

const selectCampo = document.getElementById('campoBusqueda'); 


// Si no quieres añadir un ID, esta es la forma correcta de buscarlo:
const inputBusqueda = document.getElementById('terminoBusqueda');


const btnReiniciar = document.getElementById('btn-reiniciar-busca'); 



//Funciones, métodos y eventos------------------


//**********************Inicialización**********************
//1. Funcion para iniciar eventos
function inicializarEventos() {
    //Evento de búsqueda 
    const btnBuscar = document.getElementById('btn-empezar-busca');
    
    if (btnBuscar) {
        btnBuscar.addEventListener('click', (e) => {
            e.preventDefault();
            filtrarCries();
        });
        if (inputBusqueda) {
            inputBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    filtrarCries();
                }
            });
        }
    } 
    
    //Evento para el botón reiniciar
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarBusqueda);
    }

    //Evento para Bloqueo/Desbloqueo y Edición (Delegación de eventos)
    const tablaBody = document.getElementById('criesTableBody'); // Usamos 'criesTableBody' del nuevo HTML
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            
            //Lógica de Bloqueo/Desbloqueo
            //Los CRIE se bloquean/desbloquean directamente, su status es el de la cuenta (CRIE)
            const buttonLock = e.target.closest('.btn-lock, .btn-unlock');
            if (buttonLock) {
                const idCrie = buttonLock.dataset.idcrie;
                const crieEncontrado = listaCriesCompleta.find(crie => crie.idCrie === idCrie);
                if (crieEncontrado) {
                    //El status a actualizar es el del CRIE, que representa el estado de su cuenta
                    cambiarEstadoCrie(idCrie, crieEncontrado.status); 
                }
                return; 
            }

            //Logica para los botones de editar
            const buttonEdit = e.target.closest('.btn-edit');
            if (buttonEdit) {
                const idCrieEditar = buttonEdit.dataset.idcrie; 
                //Redirige al formulario, pasando el ID del CRIE como parámetro URL
                window.location.href = `formCries.html?idCrie=${idCrieEditar}`;
                return;
            }
        });
    }
}


//2. Función que hace la consulta a la base de datos de firebase para 
//recuperar todos los CRIE con sus directores
async function obtenerCriesConDirector() {
    console.log("Iniciando obtención de CRIE y sus Directores...");
    
    
    const criesCol = collection(db, 'Crie'); 
    const directoresCol = collection(db, 'Director');

    try {
        const snapshotCrie = await getDocs(criesCol);
        
        if (snapshotCrie.empty) {
            console.warn("La colección 'Crie' está vacía. No hay CRIE para mostrar.");
            mostrarNotificacion("No hay Centros CRIE registrados.", 'warning');
            renderizarTablaCries([]);
            return; 
        }
        
        const criePromises = [];

        //1. Obtener todos los CRIE
        snapshotCrie.forEach(docCrie => {
            const crie = { idCrie: docCrie.id, ...docCrie.data() }; 
            
            //2. Por cada CRIE, buscar su Director asociado.
            //La búsqueda se basa en el campo 'idCrie' dentro de la colección 'Director'.
            const q = query(directoresCol, where("idCrie", "==", crie.idCrie));
            
            const directorPromise = getDocs(q).then(snapshotDirector => {
                let directorNombre = 'No Asignado'; 
                let directorId = null;

                if (!snapshotDirector.empty) {
                    const directorDoc = snapshotDirector.docs[0];
                    const directorData = directorDoc.data();
                    directorNombre = directorData.nombre || 'Nombre no disponible';
                    directorId = directorDoc.id;
                    console.log(`Director encontrado para CRIE ${crie.nombre}: ${directorNombre}`);
                } else {
                    
                     console.warn(` Director no encontrado para CRIE ID: ${crie.idCrie}. Usando "No Asignado".`);
                }
                
                //3. Combinar los datos del CRIE y el Director
                return {
                    idCrie: crie.idCrie,
                    cct: crie.cct || 'N/A',
                    nombre: crie.nombre || 'N/A', 
                    ubicacion: crie.ubicacion || 'N/A',
                    status: crie.status || 0,
                    directorNombre: directorNombre, //"No Asignado" si no se encontró
                    directorId: directorId
                };
            });
            criePromises.push(directorPromise);
        });

        //Esperar a que todas las consultas de director terminen
        const listaFinalCries = await Promise.all(criePromises);
        
        listaCriesCompleta = listaFinalCries;
        
        //Renderiza la lista, incluso si solo son CRIE sin director
        renderizarTablaCries(listaCriesCompleta);

    } catch (error) {
        console.error("Error FATAL al obtener los datos de CRIE y Director:", error);
        mostrarNotificacion("Error al cargar la lista de CRIE. Verifique su conexión.", 'danger');
        renderizarTablaCries([]); 
    }
}

//3. La función que renderiza, la que se encarga de cargar todas las filas en la tabla
function renderizarTablaCries(cries) {
    const tablaBody = document.getElementById('criesTableBody');
    if (!tablaBody) return; 

    tablaBody.innerHTML = ''; 

    if (cries.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay CRIE registrados o coincidencias con el término de búsqueda.</td></tr>';
        return;
    }

    cries.forEach(crie => {
        const row = document.createElement('tr');
        
        //Estilos de bloqueo y desbloqueo
        const isActivo = crie.status === 1;
        const buttonClass = isActivo ? 'btn-unlock' : 'btn-lock'; 
        const icon = isActivo ? 'fa-unlock' : 'fa-lock';
        const title = isActivo ? 'Bloquear CRIE' : 'Activar CRIE'; 

        //Inserta las filas
        row.innerHTML = `
            <td>${crie.cct}</td>
            <td>${crie.nombre}</td>
            <td>${crie.ubicacion}</td>
            <td>${crie.directorNombre}</td>
            <td class="text-center">
                <button class="btn btn-action ${buttonClass} me-2" title="${title}" data-idcrie="${crie.idCrie}">
                    <i class="fas ${icon}"></i>
                </button>
                <button class="btn btn-action btn-edit" title="Editar CRIE" data-idcrie="${crie.idCrie}">
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
    renderizarTablaCries(listaCriesCompleta);

    //3. Ocultar el botón Reiniciar
    if (btnReiniciar) {
        btnReiniciar.classList.add('d-none');
    }
}


//2. Para el filtrado
function filtrarCries() {
    if (!selectCampo || !inputBusqueda || !btnReiniciar) {
        console.error("Elementos de búsqueda no encontrados.");
        return;
    }

    const campo = selectCampo.value; 
    const termino = inputBusqueda.value.toLowerCase().trim();

    //Lógica para mostrar/ocultar el botón
    if (termino === "") {
        renderizarTablaCries(listaCriesCompleta);
        btnReiniciar.classList.add('d-none');
        return;
    }

    btnReiniciar.classList.remove('d-none');

    //Aplicamos el filtro
    const resultadosFiltrados = listaCriesCompleta.filter(crie => {
        let valorCampo;
        
        //Manejo especial para el campo 'directorNombre'
        if (campo === 'director') {
            valorCampo = String(crie.directorNombre).toLowerCase();
        } else {
            valorCampo = String(crie[campo]).toLowerCase(); 
        }

        return valorCampo.includes(termino);
    });

    //Renderizamos los resultados
    renderizarTablaCries(resultadosFiltrados);
}


//------------------Otras acciones------------------

//Cambiar el estado de un CRIE
async function cambiarEstadoCrie(idCrie, currentStatus) {
    if (!idCrie) {
        mostrarNotificacion('Error: ID de CRIE no proporcionado.', 'danger');
        return;
    }

    //El CRIE solo tiene status (1=activo, 0=bloqueado)
    const nuevoStatus = currentStatus === 1 ? 0 : 1; 
    const mensajeAccion = nuevoStatus === 0 ? "bloqueado" : "activado";

    try {
        const crieRef = doc(db, 'Crie', idCrie);
        
        await updateDoc(crieRef, {
            status: nuevoStatus
        });

        //4. Mostrar notificación de éxito
        mostrarNotificacion(`El CRIE fue ${mensajeAccion} correctamente.`, 'success');
        
        //5. Recargar la tabla para mostrar el estado actualizado
        await obtenerCriesConDirector();

    } catch (error) {
        console.error("Error al actualizar el estado del CRIE:", error);
        mostrarNotificacion(`Error al intentar ${mensajeAccion} el CRIE.`, 'danger');
    }
}


//Manejar la notificación de sessionStorage (la misma función que admin)
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
obtenerCriesConDirector();