//Importaciones de la instancia de la base de datos (db)
import { db } from "./firebase.js";
import { mostrarNotificacion } from "./toastFlotante.js";

//Importa las funciones específicas de Firestore
import {
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


//Variables globales
let idNinoActual = null;
let idUsuarioActual = null;
//Variable global para almacenar todas las sesiones cargadas
let sesionesCompletas = []; 

//Elementos del DOM HTML
const ninoDetailTitle = document.getElementById('ninoDetailTitle');
const inputNombre = document.getElementById('nombre');
const inputApellidoPaterno = document.getElementById('apellidoPaterno');
const inputApellidoMaterno = document.getElementById('apellidoMaterno');
const inputCurp = document.getElementById('curp');
const inputCrieNombre = document.getElementById('crieNombre');
const inputEscuelaNombre = document.getElementById('escuelaNombre');
const inputGradoNumero = document.getElementById('gradoNumero');
const inputGrupoNombre = document.getElementById('grupoNombre');
const inputUsuario = document.getElementById('usuario');
const inputContrasena = document.getElementById('contrasena');
const btnEditar = document.getElementById('btnEditar');
const inputIdNinoOculto = document.getElementById('idNinoOculto');

//Elementos del DOM HTML - Sección de Informes de Sesiones
const inputFechaInicio = document.getElementById('fechaInicio'); 
//Contenedor para la fecha de fin (necesario para la visibilidad)
const divRangoFinContainer = document.getElementById('divRangoFinContainer'); 
const inputFechaFin = document.getElementById('fechaFin'); 
const checkboxActivarRango = document.getElementById('activarRangoFechas');
const inputNumSesiones = document.getElementById('numSesiones');
const sesionesTablaBody = document.getElementById('sesionesTablaBody');
//Botón Reiniciar con el ID y clase CORRECTOS
const btnReiniciarFiltros = document.getElementById('btn-reiniciar-busca'); 

//----------------Funciones, métodos y eventos------------------

//Función auxiliar para obtener la fecha de hoy en formato YYYY-MM-DD.

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

//----------------nicialización------------------

//1. Función para inciar eventos, botones
function inicializarEventos() {
    //1. Ocultar y deshabilitar inicialmente la fecha de fin
    inputFechaFin.disabled = true;
    if (divRangoFinContainer) {
        
        divRangoFinContainer.classList.add('d-none'); //Hacemos el div contenedor invisible
    }
    
    //2. Botón de Reinicio
    if (btnReiniciarFiltros) {
        
        btnReiniciarFiltros.classList.add('d-none'); 
        btnReiniciarFiltros.addEventListener('click', reiniciarFiltros);
    }
    
    //3. Evento para activar/desactivar el rango de fechas
    if (checkboxActivarRango) {
        checkboxActivarRango.addEventListener('change', () => {
            mensajeUnavez=true;
            const isChecked = checkboxActivarRango.checked;
            inputFechaFin.disabled = !isChecked;
            
            //Oculta o muestra el campo de fecha de fin
            if (divRangoFinContainer) {
                if (isChecked) {
                    
                    divRangoFinContainer.classList.remove('d-none');
                } else {
                    
                    divRangoFinContainer.classList.add('d-none');
                    inputFechaFin.value = '';
                }
            }

            filtrarSesiones(); 
        });
    }

    //4. Evento de cambio en el selector de fecha de inicio
    if (inputFechaInicio) {
        inputFechaInicio.addEventListener('change', () => setTimeout(filtrarSesiones, 50));
    }
    
    //5. Evento de cambio en el selector de fecha de fin
    if (inputFechaFin) {
        inputFechaFin.addEventListener('change', () => {
             if (checkboxActivarRango.checked) {
                setTimeout(filtrarSesiones, 50);
            }
        });
    }

}


//-------------------------------Precarga de datos del niño-------------------------------

//Función auxiliar para obtener datos de una colección por ID y campo
async function getEntityData(collectionName, id, fieldName, fallback = 'No disponible') {
    if (!id) return fallback;
    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data()[fieldName] : fallback;
    } catch (error) {
        return fallback;
    }
}

//2. Función que hace la consulta a la base de datos de firebase para precargar los datos del niño
async function cargarDatosNino(idNino) {
    console.log(`Iniciando precarga de datos para Niño ID: ${idNino}...`);
    ninoDetailTitle.textContent = 'Cargando detalles...';
    
    try {
        const ninoRef = doc(db, 'Nino', idNino);
        const docNino = await getDoc(ninoRef);

        if (!docNino.exists()) {
            throw new Error("El niño no existe en la base de datos.");
        }

        const ninoData = { id: docNino.id, ...docNino.data() };
        idUsuarioActual = ninoData.idUsuario;
        
        //Asignación al campo oculto
        if (inputIdNinoOculto) {
            inputIdNinoOculto.value = idNino; 
        }

        const usuarioRef = doc(db, 'Usuario', idUsuarioActual);
        const docUsuario = await getDoc(usuarioRef);
        let usuarioData = docUsuario.exists() ? docUsuario.data() : {};

        const [
            nombreCrie,
            nombreEscuela,
            numGrado,
            nombreGrupo
        ] = await Promise.all([
            getEntityData('Escuela', ninoData.idEscuela, 'idCrie').then(idCrie => 
                getEntityData('Crie', idCrie, 'nombre')
            ),
            getEntityData('Escuela', ninoData.idEscuela, 'nombre'),
            getEntityData('Grado', ninoData.idGrado, 'numGrado'),
            getEntityData('Grupo', ninoData.idGrupo, 'nombreGrupo')
        ]);
        
        //4. Rellenar los campos del detalle (solo lectura)
        ninoDetailTitle.textContent = `Detalles de ${ninoData.nombre || 'el niño'}`;
        inputNombre.value = ninoData.nombre || '';
        inputApellidoPaterno.value = ninoData.apellido_paterno || '';
        inputApellidoMaterno.value = ninoData.apellido_materno || '';
        inputCurp.value = ninoData.curp || '';
        inputCrieNombre.value = nombreCrie;
        inputEscuelaNombre.value = nombreEscuela;
        inputGradoNumero.value = numGrado;
        inputGrupoNombre.value = nombreGrupo;
        inputUsuario.value = usuarioData.usuario || 'N/A';
        inputContrasena.value = '********'; 
        btnEditar.href = `registroNino.html?idNino=${idNino}`;

    } catch (error) {
        console.error("Error al cargar datos del niño:", error);
        ninoDetailTitle.textContent = "Error al cargar datos";
        mostrarNotificacion(`Error al cargar datos del niño: ${error.message}`, 'danger');
    }
}


//**********************Lógica de Sesiones y Reportes**********************

function formatDuration(seconds) {
    
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        return 'N/A';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} seg`;
}

//Casrga la sesiones del niño
async function cargarSesionesNino(idNino) {
    if (!idNino) return;
    console.log(`Cargando TODAS las sesiones para Niño ID: ${idNino}...`);
    //Mostrar mensaje de carga inicial
    sesionesTablaBody.innerHTML = '<tr><td colspan="8" class="text-center">Buscando sesiones...</td></tr>';

    try {
        const q = query(collection(db, 'Sesion'), where('idNino', '==', idNino));
        const snapshotSesiones = await getDocs(q);
        
        if (snapshotSesiones.empty) {
            //Si no hay sesiones en la BD, se muestra el mensaje genérico y se termina
            sesionesTablaBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No se encontraron sesiones registradas para este niño.</td></tr>';
            inputNumSesiones.value = 0;
            return;
        }

        sesionesCompletas = snapshotSesiones.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        //Ordenar sesiones por fecha (de más reciente a más antigua)
        sesionesCompletas.sort((a, b) => {
            const dateA = new Date(`${a.fechaSesion}T${a.horaSesion}`);
            const dateB = new Date(`${b.fechaSesion}T${b.horaSesion}`);
            return dateB - dateA; // Orden descendente
        });
        
        renderizarSelectoresFechas(sesionesCompletas);

    } catch (error) {
        console.error("Error al cargar sesiones del niño:", error);
        sesionesTablaBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error al cargar las sesiones.</td></tr>';
        mostrarNotificacion('Error al cargar la lista de sesiones.', 'danger');
    }
}

//3. Filtra las sesiones mostradas en la tabla basándose en la fecha única o el rango seleccionado
let mensajeUnavez=true;
function filtrarSesiones(esReinicio = false) {
    const fechaInicioStr = inputFechaInicio.value;
    const fechaFinStr = inputFechaFin.value;
    const isRangoActivo = checkboxActivarRango.checked;
    
    //Paso 1: Mostrar el mensaje de carga
    sesionesTablaBody.innerHTML = '<tr><td colspan="8" class="text-center">Buscando sesiones...</td></tr>';
    
    let sesionesPreFiltradas = []; //Lista temporal antes de la consolidación
    let filtroAplicado = false; 

    
    //Caso 1: Rango de Fechas Activo
    if (isRangoActivo) {
        if (!fechaInicioStr || !fechaFinStr) {
            if(mensajeUnavez==true){
                mensajeUnavez=false;
                mostrarNotificacion('Por favor, seleccione ambas fechas para el rango.', 'warning');
                
            }
            
            renderizarTablaSesiones([], true, 'Por favor, complete el rango de fechas.'); // Mensaje de advertencia
            filtroAplicado = true;
            return; 
        }
        
        //Validación de Rango
        if (fechaInicioStr > fechaFinStr) {
            inputFechaFin.value = ''; 
            mostrarNotificacion('Error: La fecha de fin no puede ser anterior a la fecha de inicio.', 'danger');
            filtrarSesiones(true); // Vuelve al estado inicial (filtrar por hoy)
            return; 
        }

        //Filtrado por Rango (Usa sesionesCompletas, la lista larga y no consolidada)
        sesionesPreFiltradas = sesionesCompletas.filter(sesion => {
            const fechaSesion = sesion.fechaSesion;
            return fechaSesion >= fechaInicioStr && fechaSesion <= fechaFinStr;
        });
        filtroAplicado = true;
    } 
    //Caso 2: Búsqueda por Fecha Única (Rango inactivo y fecha de inicio seleccionada)
    else if (fechaInicioStr) {
        sesionesPreFiltradas = sesionesCompletas.filter(sesion => sesion.fechaSesion === fechaInicioStr);
        //Si la fecha es la de hoy, no consideramos que se haya aplicado un filtro externo (es el estado por defecto)
        filtroAplicado = fechaInicioStr !== getTodayDateString();
    } 

    //Caso 3: Sin fecha de inicio seleccionada (solo ocurre si se borra el campo)
    else {
        // En este punto, si no hay fecha, volvemos a filtrar por hoy
        inputFechaInicio.value = getTodayDateString();
        sesionesPreFiltradas = sesionesCompletas.filter(sesion => sesion.fechaSesion === getTodayDateString());
        filtroAplicado = false;
    }

    //Consolidación y priorización (aplicada al filtro actual)
    //1. Clonar y ordenar la lista filtrada por hora/fecha
    const sesionesOrdenadas = [...sesionesPreFiltradas].sort((a, b) => {
        const dateA = new Date(`${a.fechaSesion}T${a.horaSesion}`);
        const dateB = new Date(`${b.fechaSesion}T${b.horaSesion}`);
        return dateB - dateA; //Orden descendente (más reciente primero)
    });

    const sesionesConsolidadasMap = new Map();
    const sesionesSinNoSesion = [];
    const promesasActividades = [];

    //Pre-cálculo asíncrono del número de actividades para cada sesión
    for (const sesion of sesionesOrdenadas) {
        const promesa = (async () => {
            const qActividades = query(collection(db, 'InformeActividad'), where('sesionId', '==', sesion.id));
            const snapshotActividades = await getDocs(qActividades);
            
            sesion.numActividadesCompletadas = snapshotActividades.docs.length; 
        })();
        promesasActividades.push(promesa);
    }
    
    //Esperamos a que todas las actividades se cuenten
    Promise.all(promesasActividades).then(() => {
        
        //Aplicamos la lógica de priorización sobre la lista pre-ordenada
        for (const sesion of sesionesOrdenadas) {
            const noSesion = sesion.noSesion;

            //Si no tiene noSesion, la guardamos aparte y continuamos
            if (!noSesion) {
                sesionesSinNoSesion.push(sesion);
                continue; 
            }
            
            const numActividades = sesion.numActividadesCompletadas || 0;
            const tieneActividad = numActividades >= 1;

            if (!sesionesConsolidadasMap.has(noSesion)) {
                //Si es la primera vez que vemos este noSesion, la guardamos
                sesionesConsolidadasMap.set(noSesion, sesion);
            } else {
                const sesionExistente = sesionesConsolidadasMap.get(noSesion);
                const existenteTieneActividad = sesionExistente.numActividadesCompletadas >= 1;

                //La nueva sesión reemplaza a la existente SÍ Y SOLO SÍ:
                //a) La nueva tiene actividades (>=1) y la existente no las tiene (0).
                if (tieneActividad && !existenteTieneActividad) {
                    sesionesConsolidadasMap.set(noSesion, sesion);
                }
            }
        }
        
        //Combinamos las sesiones consolidadas y las sesiones sin noSesion
        let sesionesFiltradas = Array.from(sesionesConsolidadasMap.values()).concat(sesionesSinNoSesion);

        //Re-ordenamos la lista final completa por fecha descendente antes de renderizar
        sesionesFiltradas.sort((a, b) => {
            const dateA = new Date(`${a.fechaSesion}T${a.horaSesion}`);
            const dateB = new Date(`${b.fechaSesion}T${b.horaSesion}`);
            return dateB - dateA; 
        });

        //Paso 2: Mostrar el botón de Reinicio
        if (btnReiniciarFiltros) {
            //Mostrar el botón si hay un filtro aplicado o
            //si estamos en el modo de una sola fecha diferente a hoy
            if (filtroAplicado || (fechaInicioStr && fechaInicioStr !== getTodayDateString())) {
                btnReiniciarFiltros.classList.remove('d-none'); //Mostrar botón
            } else {
                btnReiniciarFiltros.classList.add('d-none'); //Ocultar botón
            }
        }
        
        //Paso 3: Renderizar los resultados
        let mensajeVacio = "No se encontraron sesiones para los criterios de búsqueda.";
        if (sesionesFiltradas.length === 0 && !filtroAplicado) {
            mensajeVacio = "El niño no ha realizado ninguna sesión hoy.";
        }

        if (sesionesFiltradas.length > 0) {
            //Llamada directa a renderizar después de que la promesa se resuelve
            renderizarTablaSesiones(sesionesFiltradas, false); 
        } else {
            renderizarTablaSesiones([], true, mensajeVacio);
        }

    }).catch(error => {
        console.error("Error al consolidar sesiones:", error);
        renderizarTablaSesiones([], true, "Error al procesar los datos de las sesiones.");
        mostrarNotificacion('Error al procesar la lista de sesiones.', 'danger');
    });
}

//Función para reiniciar la barra de búsqueda y mostrar las sesiones de hoy (dia actual).
function reiniciarFiltros() {
    console.log("Reiniciando filtros al estado 'Hoy'...");

    mensajeUnavez=true;
    
    //1. Limpiar campos y deshabilitar/ocultar fecha de fin
    inputFechaFin.value = '';
    checkboxActivarRango.checked = false;
    inputFechaFin.disabled = true;

    if (divRangoFinContainer) { 
        divRangoFinContainer.classList.add('d-none');
    }

    //2. Establecer el valor por defecto en fechaInicio (HOY)
    inputFechaInicio.value = getTodayDateString();
    
    //3. Ocultar el botón de Reinicio
    if (btnReiniciarFiltros) btnReiniciarFiltros.classList.add('d-none');

    //4. Mostrar sesiones de hoy
    setTimeout(() => filtrarSesiones(true), 50);
    mostrarNotificacion('Filtros reiniciados. Mostrando sesiones de hoy.', 'info');
}


//Renderiza los selectores de inicio y fin de fecha y establece el valor inicial (hoy o dia actual)
function renderizarSelectoresFechas(sesiones) {
    if (sesiones.length === 0) {
        //Si no hay sesiones, limpiamos los campos y establecemos la fecha de hoy
        inputFechaInicio.value = getTodayDateString();
        inputFechaInicio.min = '';
        inputFechaInicio.max = '';
        inputFechaFin.min = '';
        inputFechaFin.max = '';
        filtrarSesiones();
        return;
    }
    
    //Obtener todas las fechas únicas
    const fechasUnicas = [...new Set(sesiones.map(s => s.fechaSesion))].sort(); 

    const fechaMinima = fechasUnicas[0];
    const fechaMaxima = fechasUnicas[fechasUnicas.length - 1];

    //Establecer los límites
    inputFechaInicio.min = fechaMinima;
    inputFechaInicio.max = fechaMaxima;
    inputFechaFin.min = fechaMinima;
    inputFechaFin.max = fechaMaxima;
    
    //Por defecto, establecer la fecha de HOY en el date picker de inicio
    inputFechaInicio.value = getTodayDateString();
    
    //Filtrar para mostrar las sesiones de la fecha inicial (HOY)
    filtrarSesiones();
}

//4. Renderiza las filas de la tabla con los datos de las sesiones.
async function renderizarTablaSesiones(sesiones, isEmpty = false, message = "No se encontraron sesiones.") {
    if (isEmpty || sesiones.length === 0) {
        sesionesTablaBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">${message}</td></tr>`;
        inputNumSesiones.value = 0;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    //let contador = 1;
    
    for (const sesion of sesiones) {
        const row = document.createElement('tr');
        
        //NO se consulta Firestore aquí. 
        //Se usa la propiedad 'numActividadesCompletadas' que fue pre-calculada en filtrarSesiones.
        const numActividadesCompletadas = sesion.numActividadesCompletadas || 0; 
        
        //Formateo de fecha y hora
        const [año, mes, dia] = sesion.fechaSesion.split('-');
        const hora = sesion.horaSesion.substring(0, 5); 
        const nombreMes = new Date(`${sesion.fechaSesion}T00:00:00`).toLocaleString('es-ES', { month: 'long' });

        row.innerHTML = `
            <td class="text-center">${sesion.noSesion || 'N/A'}</td>
            <td class="text-center">${dia}</td>
            <td class="text-center">${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}</td>
            <td class="text-center">${año}</td>
            <td class="text-center">${hora}</td>
            <td class="text-center">${formatDuration(sesion.duracion)}</td>
            <td class="text-center">${numActividadesCompletadas}</td>
            <td class="text-center">
                <button class="btn btn-action btn-view" 
                        title="Ver Detalle de Sesión" 
                        data-sesion-id="${sesion.id}" 
                        onclick="verDetalleSesion('${sesion.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        fragment.appendChild(row);
    }
    
    sesionesTablaBody.innerHTML = ''; 
    sesionesTablaBody.appendChild(fragment);
    inputNumSesiones.value = sesiones.length;
}

//Función para ver el detalle de una sesión específica (a desarrollar en otra vista)
window.verDetalleSesion = (sesionId) => {
    // 1. Guardar el estado de los filtros en sessionStorage
    const estadoFiltros = {
        fechaInicio: inputFechaInicio.value,
        fechaFin: inputFechaFin.value,
        isRangoActivo: checkboxActivarRango.checked
    };
    sessionStorage.setItem('filtroNinoSesion', JSON.stringify(estadoFiltros));

    // 2. Redirigir a la página de detalle de sesión, pasando los IDs necesarios
    window.location.href = `detalleSesion.html?idNino=${idNinoActual}&idSesion=${sesionId}`;
};
//**********************Función Principal de Ejecución**********************

//Función que revisa si estamos en modo detalle (si hay ID en la URL)
async function checkNinoId() { // Convertir a async
    const params = new URLSearchParams(window.location.search);
    idNinoActual = params.get('idNino');

    if (idNinoActual) {
        try {
            await Promise.all([
                cargarDatosNino(idNinoActual),
                cargarSesionesNino(idNinoActual) // Esperamos a que la carga de sesiones termine
            ]);

            // Solo después de cargar las sesiones, intentamos aplicar el filtro guardado.
            const filtroAplicado = aplicarFiltroGuardado();

            // Si no se aplicó un filtro guardado, se mantendrá el filtro por defecto (HOY)
            // que se dispara al final de renderizarSelectoresFechas, llamado por cargarSesionesNino.

        } catch (error) {
            // Manejo de errores si alguna de las promesas falla
            console.error("Error en carga inicial de datos o sesiones:", error);
        }
    } else {
        ninoDetailTitle.textContent = 'ID de Niño no encontrado';
        sesionesTablaBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Necesita un ID de niño válido para ver los detalles.</td></tr>';
        mostrarNotificacion('Error: ID de niño faltante en la URL.', 'danger');
    }
}


function aplicarFiltroGuardado() {
    const estadoGuardadoStr = sessionStorage.getItem('filtroNinoSesion');
    sessionStorage.removeItem('filtroNinoSesion'); // Limpiar después de leer

    if (estadoGuardadoStr) {
        console.log("Aplicando filtros guardados...");
        const estadoGuardado = JSON.parse(estadoGuardadoStr);

        // 1. Configurar Checkbox de Rango
        checkboxActivarRango.checked = estadoGuardado.isRangoActivo;

        // 2. Configurar Fechas
        inputFechaInicio.value = estadoGuardado.fechaInicio;
        inputFechaFin.value = estadoGuardado.fechaFin;
        
        // 3. Mostrar/Ocultar el div de fecha de fin si es necesario
        if (divRangoFinContainer) {
            if (estadoGuardado.isRangoActivo) {
                divRangoFinContainer.classList.remove('d-none');
                inputFechaFin.disabled = false;
            } else {
                divRangoFinContainer.classList.add('d-none');
                inputFechaFin.disabled = true;
            }
        }
        
        // 4. Ejecutar el filtro con el estado recuperado
        filtrarSesiones();
        mostrarNotificacion('Filtros restaurados de la sesión anterior.', 'info');
        return true; // Se aplicó un filtro
    }
    return false; // No había filtro guardado
}

//Punto de entrada: ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    //El orden importa: Primero eventos, luego carga de datos que dispara el filtro.
    inicializarEventos();
    checkNinoId();
});