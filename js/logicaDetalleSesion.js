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
let idSesionActual = null;
let idUsuarioActual = null;

//Elementos del DOM HTML - Sección de Detalles de la Sesión
const sesionDetailTitle = document.getElementById('sesionDetailTitle');
const inputNumSesion = document.getElementById('inputNumSesion');
const inputDia = document.getElementById('inputDia');
const inputMes = document.getElementById('inputMes');
const inputAnio = document.getElementById('inputAnio');
const inputDuracion = document.getElementById('inputDuracion');
const inputTasaAciertos = document.getElementById('inputTasaAciertos');
const btnVolverNino = document.getElementById('btnVolverNino');
const btnDescargarInformeSesion = document.getElementById('btnDescargarInformeSesion');

//Elementos del DOM HTML - Sección de Actividades
const actividadesTablaBody = document.getElementById('actividadesTablaBody');


//Funciones auxiliares ----------------------------------------------------

//Función auxiliar para obtener datos de una colección por ID y campo
async function getEntityData(collectionName, id, fieldName, fallback = 'N/A') {
    if (!id) return fallback;
    try {
        const docRef = doc(db, collectionName, String(id)); 
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data()[fieldName] : fallback;
    } catch (error) {
        console.error(`Error al obtener ${collectionName} con ID ${id}:`, error);
        return fallback;
    }
}


//El formateo para mostrar la duración en egundos y minutos
function formatDuration(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        return 'N/A';
    }
    
    const totalSeconds = Math.round(seconds); //Usamos Math.round para asegurar que es entero
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    let parts = [];

    if (minutes > 0) {
        parts.push(`${minutes} min`);
    }

    if (remainingSeconds > 0 || totalSeconds === 0) {
        //Incluir segundos si hay o si el tiempo total es 0
        parts.push(`${remainingSeconds} seg`);
    }
    
    if (parts.length === 0) {
        //Si el tiempo es 0, asegura que devuelve 0 seg
        return '0 seg'; 
    }

    //Unir las partes con un espacio.
    return parts.join(' ');
}

//Función para calcular la tasa de aciertos
function calcularTasaAciertos(informes) {
    if (!informes || informes.length === 0) {
        return '0.0%';
    }

    const sumaAciertos = informes.reduce((total, informe) => total + (informe.numMaxAciertos || 0), 0);
    const sumaErrores = informes.reduce((total, informe) => total + (informe.numErrores || 0), 0);

    const totalIntentos = sumaAciertos + sumaErrores;

    if (totalIntentos === 0) {
        return '0.0%';
    }

    //Tasa = Aciertos / (Aciertos + Errores)
    const tasa = (sumaAciertos / totalIntentos) * 100;
    
    //Formatear a un decimal y añadir el símbolo %
    return `${tasa.toFixed(1)}%`;
}


//------------------Lógica principal de carga de datos----------------------------------------

//1. Carga los datos de la Sesión y sus Informes de Actividad
async function cargarDetalleSesion(idSesion) {
    console.log(`Iniciando carga de detalles para Sesión ID: ${idSesion}...`);
    sesionDetailTitle.textContent = 'Cargando detalles de la sesión...';
    actividadesTablaBody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando actividades...</td></tr>';

    try {
        //Paso 1: Obtener datos de la sesión
        const sesionRef = doc(db, 'Sesion', idSesion);
        const docSesion = await getDoc(sesionRef);

        if (!docSesion.exists()) {
            throw new Error("La sesión no existe en la base de datos.");
        }

        const sesionData = docSesion.data();
        
        //Formateo de fecha y hora
        const [año, mes, dia] = sesionData.fechaSesion.split('-');
        const nombreMes = new Date(`${sesionData.fechaSesion}T00:00:00`).toLocaleString('es-ES', { month: 'long' });

        //Asignación de datos de Sesión
        sesionDetailTitle.textContent = `Detalles de la sesión del ${dia} de ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}`;

        inputNumSesion.value = sesionData.noSesion !== undefined ? sesionData.noSesion : 'N/A';

        inputDia.value = dia || 'N/A';
        inputMes.value = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) || 'N/A';
        inputAnio.value = año || 'N/A';
        inputDuracion.value = formatDuration(sesionData.duracion) || 'N/A';
        
        //Paso 2: Obtener Informes de actividad
        const qInformes = query(collection(db, 'InformeActividad'), where('sesionId', '==', idSesion));
        const snapshotInformes = await getDocs(qInformes);
        
        if (snapshotInformes.empty) {
            inputTasaAciertos.value = '0.0%';
            actividadesTablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se registraron actividades para esta sesión.</td></tr>';
            return;
        }

        const informesCompletos = snapshotInformes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        //Paso 3: Calcular y mostrar tasa de aciertos
        inputTasaAciertos.value = calcularTasaAciertos(informesCompletos);

        //Paso 4: Cargar datos enriquecidos y renderizar tabla
        await renderizarTablaActividades(informesCompletos);


    } catch (error) {
        console.error("Error al cargar detalles de la sesión:", error);
        sesionDetailTitle.textContent = "Error al cargar detalles";
        inputTasaAciertos.value = 'N/A';
        actividadesTablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar las actividades.</td></tr>';
        mostrarNotificacion(`Error al cargar la sesión: ${error.message}`, 'danger');
    }
}

//Renderiza la tabla de actividades completadas para la sesión
async function renderizarTablaActividades(informes) {
    if (!informes || informes.length === 0) {
        actividadesTablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se registraron actividades para esta sesión.</td></tr>';
        return;
    }
    
    const fragment = document.createDocumentFragment();

    //Cache para evitar peticiones repetidas a Nivel y Plantilla
    const nivelCache = {};
    const plantillaCache = {};

    for (const informe of informes) {
        const row = document.createElement('tr');
        
        //1. Obtener Nombre del Nivel (usando caché)
        const nivelId = informe.nivelId;
        if (!nivelCache[nivelId]) {
            nivelCache[nivelId] = await getEntityData('Nivel', nivelId, 'nombreNivel', `Nivel ${nivelId}`);
        }
        const nombreNivel = nivelCache[nivelId];

        //2. Obtener Plantilla/Vocal (usando caché)
        const plantillaId = informe.plantillaId;
        if (!plantillaCache[plantillaId]) {
            plantillaCache[plantillaId] = await getEntityData('Plantilla', plantillaId, 'vocal', `Plantilla ${plantillaId}`);
        }
        const vocalPlantilla = plantillaCache[plantillaId];

        //3. Determinar la sección
        let seccion = 'N/A';
        
        //Asegurarse de que nivelId sea un número para la comparación
        const nivel = parseInt(nivelId); 
        
        if (!isNaN(nivel)) {
            if (nivel >= 1 && nivel <= 4) {
                seccion = 'Previo a plantillas';
            } else if (nivel >= 5 && nivel <= 7) {
                seccion = 'Trabajo con plantillas';
            }
        }

        row.innerHTML = `
            <td class="text-center">${informe.nivelId || 'N/A'}</td>
            <td class="text-center">${nombreNivel}</td>
            <td class="text-center">${vocalPlantilla}</td>
            <td class="text-center">${informe.numErrores || 0}</td>
            <td class="text-center">${formatDuration(informe.tiempo)}</td>
            <td class="text-center">${seccion}</td>
        `;
        fragment.appendChild(row);
    }
    
    actividadesTablaBody.innerHTML = ''; 
    actividadesTablaBody.appendChild(fragment);
}


//-------------------Inicialización y Eventos-------------------------------------------------

//Función que revisa si estamos en modo detalle (si hay ID en la URL) e inicializa eventos
function checkSessionId() {
    const params = new URLSearchParams(window.location.search);
    idNinoActual = params.get('idNino');
    idSesionActual = params.get('idSesion');

    //Inicializa el botón "Volver a Niño"
    if (btnVolverNino && idNinoActual) {
        
        btnVolverNino.addEventListener('click', () => {
            window.location.href = `detalleNino.html?idNino=${idNinoActual}`;
        });
    } else {
        //En caso de error o falta de ID, desactivar el botón o darle un enlace genérico
        if (btnVolverNino) {
            btnVolverNino.disabled = true;
        }
    }
    
    //Evento para el botón de Descargar
    if (btnDescargarInformeSesion) {
        btnDescargarInformeSesion.addEventListener('click', () => {
            mostrarNotificacion('Funcionalidad de descarga de informe aún no implementada.', 'info');
            //Aquí iría la lógica de generación y descarga de PDF/CSV
        });
    }

    if (idSesionActual && idNinoActual) {
        cargarDetalleSesion(idSesionActual);
    } else {
        sesionDetailTitle.textContent = 'Error: Sesión o Niño no encontrado';
        actividadesTablaBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Necesita un ID de sesión y de niño válidos.</td></tr>';
        mostrarNotificacion('Error: ID de sesión o de niño faltante en la URL.', 'danger');
    }
}


//Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    checkSessionId();
});