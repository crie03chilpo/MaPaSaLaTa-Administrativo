//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias
import { doc, getDoc, updateDoc, collection, getDocs, query, where, runTransaction } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion, mostrarNotificacionPendiente } from "./toastFlotante.js"; 

//------------------ Elementos del DOM ------------------
const asesorNameTitle = document.querySelector('h4'); 
const escuelasTableBody = document.getElementById('escuelasTableBody');
const btnVolver = document.querySelector('.btn-cancel'); // Botón 'Volver'
const btnAceptar = document.querySelector('.btn-accept'); // Botón 'Aceptar' (lo usaremos para volver)

const buscarEscuelaPorSelect = document.getElementById('buscarEscuelaPor');
const busquedaInput = document.querySelector('input[placeholder="Buscar. . ."]');
const btnBuscar = document.getElementById('btn-empezar-busca');
const btnReiniciar = document.getElementById('btn-reiniciar-busca');
const radioTurnos = document.querySelectorAll('input[name="turno"]');

//------------------ Variables Globales ------------------
const urlParams = new URLSearchParams(window.location.search);
const idAsesor = urlParams.get('idAsesor');
const navigationOrigin = urlParams.get('from');

//Almacena TODAS las escuelas cargadas inicialmente
let escuelasOriginales = [];

// ------------------ Funciones de Utilidad ------------------

//Cargar el nombre del asesor
async function cargarNombreAsesor() {
    if (!idAsesor) {
        asesorNameTitle.textContent = "Error: ID de Asesor no encontrado";
        mostrarNotificacion("ID de Asesor es requerido.", 'danger');
        return null;
    }
    
    try {
        const asesorRef = doc(db, 'Asesor', idAsesor);
        const asesorSnap = await getDoc(asesorRef);

        if (asesorSnap.exists()) {
            const data = asesorSnap.data();
            const nombreAsesor = data.nombre || 'Asesor Desconocido';
            const idCrieAsesor = data.idCrie || null;

            asesorNameTitle.innerHTML = `Asigna las escuelas a ${nombreAsesor}`;
            
            //Si no tiene CRIE
            if (!idCrieAsesor) {
                 mostrarNotificacion("Error: El asesor no tiene un CRIE asignado.", 'warning');
                 return null;
            }
            return idCrieAsesor;
        } else {
            asesorNameTitle.textContent = "Asesor no encontrado";
            mostrarNotificacion("El asesor con ese ID no existe.", 'danger');
            return null;
        }

    } catch (error) {
        console.error("Error al cargar el nombre del asesor:", error);
        mostrarNotificacion("Error al obtener el nombre del asesor.", 'danger');
        return null;
    }
}

//Obtiene las escuelas
async function obtenerEscuelas(idCrie) {
    if (!idCrie) return [];

    try {
        const escuelasCol = collection(db, 'Escuela');
        
        //La consulta clave: solo escuelas activas Y que pertenezcan a este CRIE
        const q = query(
            escuelasCol, 
            where('status', '==', 1),
            where('idCrie', '==', idCrie)
        );
        const escuelasSnap = await getDocs(q);
        
        const escuelas = [];
        escuelasSnap.forEach(docEscuela => {
            const data = docEscuela.data();
            const escuela = {
                id: docEscuela.id,
                cct: data.cct || '',
                nombre: data.nombre || '',
                turno: data.turno || '',
                direccion: data.direccion || '',
                idAsesorAsignado: data.idAsesor || null,
                
                asignadaAEsteAsesor: data.idAsesor === idAsesor 
            };
            
            //Solo incluimos escuelas que no tienen asesor o que sí están asignadas a este asesor
            if (escuela.idAsesorAsignado === null || escuela.idAsesorAsignado === idAsesor) {
                escuelas.push(escuela);
            }
        });

        //Almacenar la lista original para futuras búsquedas/filtros
        escuelasOriginales = escuelas; 
        return escuelas;

    } catch (error) {
        console.error("Error al obtener las escuelas:", error);
        mostrarNotificacion("Error al cargar la lista de escuelas.", 'danger');
        return [];
    }
}

//La lista de las escuelas
function renderizarEscuelas(escuelas) {
    escuelasTableBody.innerHTML = ''; 

    //1. Separar por asignación
    const asignadas = escuelas.filter(e => e.asignadaAEsteAsesor);
    const noAsignadas = escuelas.filter(e => !e.asignadaAEsteAsesor);

    //2. Prioridad: No asignadas primero, luego las asignadas a este asesor
    const escuelasOrdenadas = [...noAsignadas, ...asignadas];

    if (escuelasOrdenadas.length === 0) {
        escuelasTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No hay escuelas disponibles para asignar o que ya estén asignadas a este asesor según su filtro.</td></tr>`;
        return;
    }

    escuelasOrdenadas.forEach(escuela => {
        const isAssignedToMe = escuela.asignadaAEsteAsesor;
        const buttonText = isAssignedToMe ? 'Quitar' : 'Asignar';
        const buttonClass = isAssignedToMe ? 'btn-cancel' : 'btn-accept';
        
        const row = document.createElement('tr');
        //Usar data attributes para manejar la lógica de acción en el listener
        row.innerHTML = `
            <td>${escuela.cct}</td>
            <td>${escuela.nombre}</td>
            <td>${escuela.turno.charAt(0).toUpperCase() + escuela.turno.slice(1)}</td>
            <td>${escuela.direccion}</td>
            <td>
                <button class="btn btn-action ${buttonClass}" data-escuela-id="${escuela.id}" data-action="${isAssignedToMe ? 'quitar' : 'asignar'}">
                    ${buttonText}
                </button>
            </td>
        `;
        escuelasTableBody.appendChild(row);
    });
}

//Pequeño filtro de las escuelas
function filtrarEscuelas() {
    const termino = busquedaInput.value.trim().toLowerCase();
    const campo = buscarEscuelaPorSelect.value;
    let turnoSeleccionado = Array.from(radioTurnos).find(r => r.checked).value;

    const escuelasFiltradas = escuelasOriginales.filter(escuela => {
        
        //1. Filtro por Turno
        const cumpleTurno = turnoSeleccionado === 'ambos' || escuela.turno.toLowerCase() === turnoSeleccionado;

        if (!cumpleTurno) return false;

        //2. Filtro por Búsqueda
        if (termino === '') return true; 

        let valorCampo = '';

        //Determinar qué campo de la escuela usar para la búsqueda
        switch (campo) {
            case 'cct':
                valorCampo = escuela.cct;
                break;
            case 'nombre':
                valorCampo = escuela.nombre;
                break;
            case 'direccion':
                valorCampo = escuela.direccion;
                break;
            default:
                return false;
        }

        return valorCampo && valorCampo.toLowerCase().includes(termino);
    });

    //Cambiar la visibilidad del botón de Reiniciar
    if (termino.length > 0 || turnoSeleccionado !== 'ambos') {
        btnReiniciar.classList.remove('d-none');
    } else {
        btnReiniciar.classList.add('d-none');
    }

    renderizarEscuelas(escuelasFiltradas);
}

// ------------------Lógica de Acción (Asignar/Quitar)------------------

//Modifica la asignación
//Modifica la asignación
async function modificarAsignacion(escuelaId, nuevoIdAsesor, accion) {
    if (!escuelaId || !idAsesor) {
        mostrarNotificacion("Error de ID. Asegúrese de que el asesor y la escuela tengan un ID válido.", 'danger');
        return;
    }
    
    const escuelaRef = doc(db, 'Escuela', escuelaId);
    const nombreAccion = accion === 'asignar' ? 'Asignar' : 'Quitar';

    try {
        await runTransaction(db, async (transaction) => {
            
            //Doble verificación
            if (accion === 'asignar') {
                const escuelaSnap = await transaction.get(escuelaRef);
                const idAsesorActual = escuelaSnap.data().idAsesor || null;
                
                if (idAsesorActual !== null) {
                    //Si ya tiene un asesor asignado que no sea el actual 
                    if (idAsesorActual !== idAsesor) {
                        throw new Error(`La escuela ya fue asignada a otro asesor, recargue la página`);
                    }
                }
            }
            
            //Actualiza
            transaction.update(escuelaRef, { idAsesor: nuevoIdAsesor });
        });

        if(nombreAccion==='Asignar'){
            mostrarNotificacion(`Escuela asignada`, 'success');
        }else{
            mostrarNotificacion(`Escuela quitada`, 'success');
        }

        
        // 1. Actualizar la variable global 'escuelasOriginales' en memoria
        const escuelaIndex = escuelasOriginales.findIndex(e => e.id === escuelaId);
        if (escuelaIndex !== -1) {
            // Modificar el objeto en la lista original
            escuelasOriginales[escuelaIndex].idAsesorAsignado = nuevoIdAsesor;
            escuelasOriginales[escuelaIndex].asignadaAEsteAsesor = (nuevoIdAsesor === idAsesor);
        }
        
        // 2. Aquí NO SE LLAMA A filtrarEscuelas() ni renderizarEscuelas().
        // La actualización visual se hará en handleTableClick.

    } catch (error) {
        console.error(`Error en la transacción al ${accion} escuela:`, error);
        mostrarNotificacion(`Error: No se pudo ${nombreAccion.toLowerCase()} la escuela. ${error.message}`, 'danger');
        // Si hay un error, devolvemos 'false' para que el botón no se actualice
        return false; 
    }
    return true;
}


//Clic en los botones de asignar o quitar
//Clic en los botones de asignar o quitar
async function handleTableClick(e) {
    const button = e.target.closest('button');
    if (!button || !button.dataset.escuelaId) return;

    const escuelaId = button.dataset.escuelaId;
    const action = button.dataset.action;
    let success = false;

    if (action === 'asignar') {
        // Asignar: Pasar el ID del asesor actual
        success = await modificarAsignacion(escuelaId, idAsesor, 'asignar');
    } else if (action === 'quitar') {
        // Quitar: Pasar null (o undefined) como ID de asesor
        success = await modificarAsignacion(escuelaId, null, 'quitar');
    }

    // 🛑 LÓGICA CLAVE: Actualización del botón en el DOM solo si la transacción fue exitosa
    if (success) {
        if (action === 'asignar') {
            // Se acaba de ASIGNAR, cambiar a estado QUITAR
            button.textContent = 'Quitar';
            button.classList.remove('btn-accept');
            button.classList.add('btn-cancel');
            button.dataset.action = 'quitar';
        } else if (action === 'quitar') {
            // Se acaba de QUITAR, cambiar a estado ASIGNAR
            button.textContent = 'Asignar';
            button.classList.remove('btn-cancel');
            button.classList.add('btn-accept');
            button.dataset.action = 'asignar';
        }
    }
}

// ------------------ Inicialización y Eventos ------------------

//Datos iniciales
async function inicializarCargaDatos() {
    const idCrie = await cargarNombreAsesor(); // <--- Ahora devuelve el idCrie

    if (idCrie) {
        const escuelas = await obtenerEscuelas(idCrie); 
        renderizarEscuelas(escuelas);
    } else {
        renderizarEscuelas([]);
    }
}

function inicializarEventos() {
    //1. Eventos de la Tabla (Asignar/Quitar)
    escuelasTableBody.addEventListener('click', handleTableClick);
    
    //2. Eventos de Búsqueda
    btnBuscar.addEventListener('click', filtrarEscuelas);
    busquedaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filtrarEscuelas();
        }
    });

    //3. Evento de Reinicio de Búsqueda
    btnReiniciar.addEventListener('click', () => {
        busquedaInput.value = '';
        document.getElementById('turnoAmbos').checked = true;
        btnReiniciar.classList.add('d-none');
        filtrarEscuelas(); 
    });
    
    //4. Evento de Filtro por Turno
    radioTurnos.forEach(radio => {
        radio.addEventListener('change', filtrarEscuelas);
    });

    //5. Botón 'Volver' y 'Aceptar'
    const handleVolverNavigation = () => {
        if (navigationOrigin === 'gestion') { 
            window.location.href = 'gestionAsesores.html';
            return;
        }

        if (idAsesor) {
             //Redirigir al formulario de edición del asesor (comportamiento por defecto)
             window.location.href = `formAsesor.html?idAsesor=${idAsesor}`;
        } else {
             //Si por alguna razón no hay ID, volvemos a la lista general
             window.location.href = 'gestionAsesores.html'; 
        }
    };

    //Lógica para el botón 'Aceptar' (btnAceptar)l
    const handleAceptarNavigation = () => {
        if (idAsesor) {
            //Redirigir al listado, por eso es aceptar
            window.location.href = `gestionAsesores.html`;
        } else {
            //Si por alguna razón no hay ID, volvemos a la lista general
            window.location.href = 'gestionAsesores.html'; 
        }
    };
    
    if (btnVolver) btnVolver.addEventListener('click', handleVolverNavigation);
    
    //Asignar el nuevo manejador de navegación al botón Aceptar
    if (btnAceptar) btnAceptar.addEventListener('click', handleAceptarNavigation);
}


//Inicialización general del DOM
document.addEventListener('DOMContentLoaded', async () => {
    //Mostrar notificaciones pendientes de formAsesor.js
    mostrarNotificacionPendiente();
    
    if (idAsesor) {
        inicializarEventos(); 
        await inicializarCargaDatos(); 
    } else {
        mostrarNotificacion("Página no válida. Se requiere el ID de Asesor.", 'danger');
        //Redirigir por seguridad si no hay ID de asesor
        setTimeout(() => window.location.href = 'gestionAsesores.html', 3000);
    }
});