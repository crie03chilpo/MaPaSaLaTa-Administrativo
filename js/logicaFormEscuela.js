//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias para el form
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion } from "./toastFlotante.js";

import { obtenerSesion } from "./sessionManager.js";

//------------------Variables e incialización------------------
//Campos del formulario de Escuela (actualizados según el HTML)
const escuelaCCTInput = document.getElementById('escuelaCCT');
const escuelaNombreInput = document.getElementById('escuelaNombre');
const escuelaDireccionInput = document.getElementById('escuelaDireccion');
const escuelaTurnoSelect = document.getElementById('escuelaTurno');
const crieAsociadoSelect = document.getElementById('crieAsociado');
const asesorACargoSelect = document.getElementById('asesorACargo');
const btnCancelar = document.getElementById('btnCancelar');
const btnAceptar = document.getElementById('btnAceptar');
const btnQuitarAsesor = document.getElementById('btnQuitarAsesor');


//-------------Variables globales y Constantes------------------
//Almacenar el ID de la Escuela para el modo edición
let idEscuelaEdit = null;
let originalBtnText = btnAceptar.textContent;


const urlParams = new URLSearchParams(window.location.search);
const idEscuela = urlParams.get('idEscuela');
const modoEdicion = !!idEscuela; //true si idEscuela existe, false si es nulo

const escuelaForm = document.getElementById('escuelaForm');
const formTitle = document.getElementById('formTitle');

//Constantes de diseño para el feedback (copiadas del código base de Director)
const MARGIN_BOTTOM_VALID = '30px';
const MARGIN_BOTTOM_INVALID = '0px';

//Cache para almacenar los asesores (Docentes) cargados
let listaAsesores = [];

let noWarn = false;

//Variables de permisos y roles
const DIRECTOR_ROL_ID = '2'; 
let usuarioActual = obtenerSesion();
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;
let directorEntidadId = esDirector ? usuarioActual.entidadId : null;
let idCrieDirector = null; // Se cargará asíncronamente



//---------------------Funciones, métodos y toda los eventos o lógica---------------------

//---------------------Lógica de inicialización y carga---------------------

//1. Revisa si es modo edición para cargar los datos
if (modoEdicion) {
    idEscuelaEdit = idEscuela;
    formTitle.textContent = "Editando Escuela";
    btnAceptar.textContent = "Actualizar"
    originalBtnText = "Actualizar";
} else {
    formTitle.textContent = "Agregando Escuela";
    originalBtnText = "Guardar";
}


//Función auxiliar para obtener todos los CRIE activos (status = 1)
async function obtenerCrieActivos() {
    try {
        const crieCol = collection(db, 'Crie');
        //Filtra por CRIE con status = 1
        const q = query(crieCol, where('status', '==', 1));
        const crieSnap = await getDocs(q);

        const crieActivos = [];
        crieSnap.forEach(docCrie => {
            crieActivos.push({ id: docCrie.id, nombre: docCrie.data().nombre });
        });

        return crieActivos;

    } catch (error) {
        console.error("Error al obtener CRIE activos:", error);
        mostrarNotificacion("Error al cargar la lista de CRIE.", 'danger');
        return [];
    }
}


//**************************
async function obtenerIdCrieDirector(entidadId) {
    if (!entidadId) return null;

    try {
        const directorRef = doc(db, 'Director', entidadId);
        const docSnap = await getDoc(directorRef);

        if (docSnap.exists()) {
            const directorData = docSnap.data();
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

function aplicarRestriccionDirector() {
    if (esDirector) {
        // En tu HTML, la estructura es:
        // <div class="col-12 col-lg-5"> -> contiene el div del CRIE
        
        // Buscamos el div padre que contiene el select de CRIE para ocultarlo
        const crieContainer = crieAsociadoSelect.closest('.col-lg-5'); 
        if (crieContainer) {
            crieContainer.classList.add('d-none'); // Ocultar el campo CRIE
        }
        
        // Aseguramos que el campo esté deshabilitado para evitar manipulaciones
        crieAsociadoSelect.disabled = true;
    }
}


//Función auxiliar para obtener todos los Asesores activos (status = 1)
async function obtenerAsesoresActivos() {
    try {
        const asesorCol = collection(db, 'Asesor');
        //1. Consulta inicial: Filtra por Asesor con status = 1 y trae todos los campos
        //incluyendo idUsuario
        const qAsesorActivo = query(asesorCol, where('status', '==', 1));
        const asesorSnap = await getDocs(qAsesorActivo);

        const asesoresProcesados = [];
        const promesasUsuarios = [];

        //2. Recopilar id de Usuario y crear promesas para verificar su status
        asesorSnap.forEach(docAsesor => {
            const data = docAsesor.data();
            const idUsuario = data.idUsuario;

            if (idUsuario) {
                const userRef = doc(db, 'Usuario', idUsuario);

                promesasUsuarios.push(getDoc(userRef).then(userSnap => {
                    const usuarioActivo = userSnap.exists() && userSnap.data().status === 1;

                    if (usuarioActivo) {
                        //Si el Usuario está activo, agregamos el Asesor a la lista
                        return {
                            id: docAsesor.id,
                            nombre: data.nombre,
                            idCrie: data.idCrie || null,
                            idUsuario: idUsuario
                        };
                    }
                    return null;
                }));
            }
        });

        //3. Esperar a que todas las promesas de Usuario se resuelvan y filtrar los nulos
        const resultados = await Promise.all(promesasUsuarios);
        const asesoresFinales = resultados.filter(asesor => asesor !== null);

        listaAsesores = asesoresFinales;
        return asesoresFinales;

    } catch (error) {
        console.error("Error al obtener Asesores activos y con Usuario activo:", error);
        mostrarNotificacion("Error al cargar la lista de Asesores.", 'danger');
        return [];
    }
}

//Establece el estado inicial de los selects (antes de la carga asíncrona)
function establecerEstadoInicialSelects() {
    //1. Select CRIE:
    crieAsociadoSelect.innerHTML = '<option value="" selected disabled>Selecciona un CRIE</option>';

    //2. Select Asesor:
    asesorACargoSelect.innerHTML = '<option value="" selected disabled>Primero selecciona un CRIE</option>';
    asesorACargoSelect.disabled = true;

    if (btnQuitarAsesor && esDirector != true) {
        btnQuitarAsesor.disabled = true;
    }
}

// Función para rellenar el SELECT de CRIE
async function poblarCrieSelect(idCrieActual = null) {

    // 💡 Lógica para DIRECTOR: Fija el valor y termina
    if (esDirector) {
        const crieRef = doc(db, 'Crie', idCrieDirector);
        const crieSnap = await getDoc(crieRef);
        let crieNombre = 'CRIE asociado (Error)';
        
        if (crieSnap.exists()) {
            crieNombre = crieSnap.data().nombre || crieNombre;
        }
        
        // El select debe tener la opción del CRIE del director para el proceso de guardado
        crieAsociadoSelect.innerHTML = '';
        const optionDirector = document.createElement('option');
        optionDirector.value = idCrieDirector;
        optionDirector.textContent = `Fijo: ${crieNombre}`;
        optionDirector.selected = true;
        crieAsociadoSelect.appendChild(optionDirector);

        // Devolvemos el ID fijo para que poblarAsesorSelect pueda trabajar.
        return idCrieDirector;
    }
    
    //-------------------------------


    const crieActivos = await obtenerCrieActivos();

    //Restaurar el select (limpiar y poner placeholder)
    crieAsociadoSelect.innerHTML = '<option value="" selected disabled>Selecciona un CRIE</option>';

    let crieActualData = null;
    let crieInactivo = false;

    if (idCrieActual) {
        //1. Verificar si el CRIE actual está INACTIVO
        const crieRef = doc(db, 'Crie', idCrieActual);
        const crieSnap = await getDoc(crieRef);

        if (crieSnap.exists()) {
            crieActualData = crieSnap.data();
            if (crieActualData.status !== 1) {
                
                crieInactivo = true;
            }
        }
    }

    //2. Insertar la opción INACTIVA (si aplica)
    if (crieInactivo) {
        const optionInactiva = document.createElement('option');
        optionInactiva.value = idCrieActual;
        optionInactiva.textContent = `${crieActualData.nombre} (INACTIVO)`;
        optionInactiva.selected = true;
        optionInactiva.disabled = true; // No permite volver a seleccionarlo si se cambia

        //Insertamos después del placeholder
        crieAsociadoSelect.appendChild(optionInactiva);
    }

    //3. Insertar las opciones activas
    if (crieActivos.length === 0 && !crieInactivo) {
        //Bloquear el select de Asesor si no hay CRIE disponibles
        asesorACargoSelect.innerHTML = '<option value="" selected disabled>No hay CRIE activos</option>';
        asesorACargoSelect.disabled = true;
        return null;
    }

    crieActivos.forEach(crie => {
        const option = document.createElement('option');
        option.value = crie.id;
        option.textContent = crie.nombre;

        if (idCrieActual === crie.id && !crieInactivo) {
            option.selected = true;
        }

        crieAsociadoSelect.appendChild(option);
    });

    //4. Lógica de selección final y Asesor

    //Devolver el ID seleccionado
    const idCrieSeleccionado = (idCrieActual && (crieActivos.some(c => c.id === idCrieActual) || crieInactivo)) ? idCrieActual : null;

    if (crieInactivo) {
        asesorACargoSelect.innerHTML = '<option value="" selected disabled>CRIE Inactivo. Selecciona un CRIE activo primero.</option>';
        asesorACargoSelect.disabled = true;
    } else if (idCrieSeleccionado || !modoEdicion) {
        asesorACargoSelect.disabled = false;
        asesorACargoSelect.innerHTML = '<option value="" selected disabled>Selecciona un asesor</option>';
    }

    return idCrieSeleccionado;
}

// Función para rellenar el SELECT de Asesores basado en el CRIE seleccionado
async function poblarAsesorSelect(idCrieSeleccionado, idAsesorActual) {

    //1. Si no hay un CRIE seleccionado bloquear y salir.
    if (!idCrieSeleccionado) {
        asesorACargoSelect.innerHTML = '<option value="" selected disabled>Primero selecciona un CRIE</option>';
        asesorACargoSelect.disabled = true;
        return;
    }

    //2. Desbloquear y limpiar para empezar la carga (¡ESTO ES CLAVE!)
    asesorACargoSelect.disabled = false;
    asesorACargoSelect.innerHTML = '';

    //3. Añadir el placeholder inicial
    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = "Selecciona un asesor";
    placeholderOption.selected = true;
    placeholderOption.disabled = true;
    asesorACargoSelect.appendChild(placeholderOption);

    //4. Filtrar asesores ACTIVOS por el CRIE seleccionado
    const asesoresFiltrados = listaAsesores.filter(asesor =>
        asesor.idCrie === idCrieSeleccionado
    );

    let isCurrentAsesorAvailable = false;
    let isCurrentAsesorInactivo = false;
    let asesorActualData = null;


    //5. Verificar si el Asesor actual está disponible/activo o debe insertarse
    if (idAsesorActual && idAsesorActual !== "Pendiente") {
        asesorActualData = listaAsesores.find(a => a.id === idAsesorActual);

        if (asesorActualData) {
            //El Asesor está activo (fue cargado en listaAsesores)
            if (asesorActualData.idCrie === idCrieSeleccionado) {
                //El Asesor activo pertenece al CRIE, se seleccionará del forEach.
                isCurrentAsesorAvailable = true;
            } else {
                //El Asesor activo NO pertenece al CRIE. Se marca como 'INCORRECTO'.
                isCurrentAsesorInactivo = true;
            }
        } else {
            try {
                const asesorRef = doc(db, 'Asesor', idAsesorActual);
                const asesorSnap = await getDoc(asesorRef);

                if (asesorSnap.exists()) {
                    asesorActualData = asesorSnap.data();
                }
            } catch (error) {
                console.error("Error al obtener datos de Asesor inactivo:", error);

            }

            isCurrentAsesorInactivo = true;
        }
    }

    //6. Insertar la opción INACTIVA / INCORRECTA (si aplica)
    if (isCurrentAsesorInactivo) {
        const optionInactiva = document.createElement('option');
        optionInactiva.value = idAsesorActual;

        let nombreAsesor = "Asesor Desconocido";

        if (asesorActualData && asesorActualData.nombre) {
            nombreAsesor = asesorActualData.nombre;
        } else if (idAsesorActual) {
            nombreAsesor = `Asesor ID: ${idAsesorActual}`;
        }

        //Determinar la etiqueta correcta
        let etiqueta = ` (INACTIVO)`;
        if (asesorActualData && asesorActualData.idCrie !== idCrieSeleccionado) {
            etiqueta = ` (NO PERTENECE A ESTE CRIE)`;
        } else if (asesorActualData && asesorActualData.status === 1 && asesorActualData.idCrie === idCrieSeleccionado) {
            //Si llegamos aquí y es activo y del mismo CRIE, no debería ser inactivo (isCurrentAsesorInactivo debe ser false),
            //pero como fallback, lo marcamos como 'INACTIVO' si no se encontró en listaAsesores (problema de status de Usuario).
            etiqueta = ` (INACTIVO)`;
        }

        optionInactiva.textContent = `${nombreAsesor}${etiqueta}`;
        optionInactiva.selected = true;
        optionInactiva.disabled = true;

        asesorACargoSelect.appendChild(optionInactiva);
        placeholderOption.selected = false;

        //El Asesor Inactivo/Incorrecto está seleccionado, no marcamos los activos.
        isCurrentAsesorAvailable = false;
    }

    //7. Agregar los asesores ACTIVOS y FILTRADOS
    asesoresFiltrados.forEach(asesor => {
        const option = document.createElement('option');
        option.value = asesor.id;
        option.textContent = asesor.nombre;

        // Marcar el asesor actual si es el caso (Modo Edición y ACTIVO)
        if (idAsesorActual === asesor.id && isCurrentAsesorAvailable) {
            option.selected = true;
            placeholderOption.selected = false; // Asegurar que el placeholder se desmarque
        }

        asesorACargoSelect.appendChild(option);
    });

    //8. Opción "Dejar pendiente por ahora"
    const pendienteOption = document.createElement('option');
    pendienteOption.value = "Pendiente";
    pendienteOption.textContent = "Dejar pendiente por ahora";
    asesorACargoSelect.appendChild(pendienteOption);

    //9. Lógica de selección de "Pendiente"
    if (!isCurrentAsesorAvailable && !isCurrentAsesorInactivo && idAsesorActual === "Pendiente") {
        pendienteOption.selected = true;
        placeholderOption.selected = false;
    }
}

//Cargar datos si es edición---------------------------------------
async function cargarDatosEscuela(idEscuela) {
    if (!idEscuela) return;

    // Obtener la lista de campos para desbloquear en caso de error o éxito
    const camposCarga = [escuelaCCTInput, escuelaNombreInput, escuelaDireccionInput, escuelaTurnoSelect, crieAsociadoSelect, asesorACargoSelect];

    try {
        const escuelaRef = doc(db, 'Escuela', idEscuela);
        const escuelaSnap = await getDoc(escuelaRef);

        if (!escuelaSnap.exists()) {
            mostrarNotificacion("Error: Escuela no encontrada.", 'danger');

            //Si falla, desbloqueamos y limpiamos el 'cargando'
            camposCarga.forEach(input => {
                if (input.tagName === 'INPUT') input.value = "";
                input.removeAttribute('disabled');
            });
            btnAceptar.disabled = false;
            return;
        }

        const escuelaData = escuelaSnap.data();
        const idCrieActual = escuelaData.idCrie || null;
        const idAsesorActual = escuelaData.idAsesor || 'Pendiente';

        //Rellenar campos de la Escuela
        escuelaCCTInput.value = escuelaData.cct || '';
        escuelaNombreInput.value = escuelaData.nombre || '';
        escuelaDireccionInput.value = escuelaData.direccion || '';
        escuelaTurnoSelect.value = escuelaData.turno || 'Matutino';

        // 1. Poblar CRIE y determinar si está inactivo
        const idCrieSeleccionado = await poblarCrieSelect(idCrieActual);

        //Control para saber si el CRIE actualmente asociado está inactivo
        const opcionCrieSeleccionada = crieAsociadoSelect.options[crieAsociadoSelect.selectedIndex];
        let crieEstaInactivo = false;

        if (opcionCrieSeleccionada && opcionCrieSeleccionada.textContent.includes('(INACTIVO)')) {
            mostrarFeedback(crieAsociadoSelect, false, 'El CRIE asociado fue desactivado. Seleccione uno activo.');
            mostrarNotificacion('El CRIE de la escuela está inactivo, debe seleccionar uno nuevo.', 'warning');
            crieEstaInactivo = true;
        } else {
            //Si el CRIE es activo, se marca como válido
            if (idCrieSeleccionado) mostrarFeedback(crieAsociadoSelect, true);
        }

        //2. Poblar Asesores SOLO si el CRIE NO está inactivo
        if (!crieEstaInactivo) {
            await poblarAsesorSelect(idCrieActual, idAsesorActual);

            //Verificar si el Asesor se cargó como INACTIVO/INCORRECTO y forzar feedback
            const opcionAsesorSeleccionada = asesorACargoSelect.options[asesorACargoSelect.selectedIndex];

            if (opcionAsesorSeleccionada && (opcionAsesorSeleccionada.textContent.includes('(INACTIVO)') || opcionAsesorSeleccionada.textContent.includes('(NO PERTENECE A ESTE CRIE)'))) {
                const mensaje = opcionAsesorSeleccionada.textContent.includes('(INACTIVO)')
                    ? 'El Asesor asociado está inactivo. Seleccione uno nuevo o "Pendiente".'
                    : 'El Asesor ya no pertenece al CRIE seleccionado. Seleccione uno nuevo.';

                mostrarFeedback(asesorACargoSelect, false, mensaje);
                mostrarNotificacion('El Asesor asociado ya no es válido, debe seleccionar uno nuevo.', 'warning');
            } else {
                // Si el Asesor es válido (activo o Pendiente), se marca como válido
                if (idAsesorActual) mostrarFeedback(asesorACargoSelect, true);
            }
        } else {
            //Si el CRIE está inactivo, el select de Asesor ya está bloqueado por poblarCrieSelect
            //y no necesita más validación aquí. Simplemente limpiamos el feedback visual por si acaso
            mostrarFeedback(asesorACargoSelect, true);
        }

        // Habilitar campos y botón de aceptar
        camposCarga.forEach(input => input.removeAttribute('disabled'));
        btnAceptar.disabled = false;

        if (btnQuitarAsesor) {
            btnQuitarAsesor.disabled = false;
        }

    } catch (error) {
        console.error("Error al cargar datos para edición:", error);
        mostrarNotificacion("Error al cargar los datos de la escuela.", 'danger');

        //Asegurar que los campos se desbloqueen si hay un error de conexión
        camposCarga.forEach(input => {
            if (input.tagName === 'INPUT') input.value = "Error.";
            input.removeAttribute('disabled');
        });
        btnAceptar.disabled = false;

        if (btnQuitarAsesor) {
            btnQuitarAsesor.disabled = true;
        }
    }
}

//Evento para actualizar el select de Asesores cuando cambie el CRIE
if (crieAsociadoSelect) {
    crieAsociadoSelect.addEventListener('change', (e) => {
        const nuevoIdCrie = e.target.value;
        poblarAsesorSelect(nuevoIdCrie, null);

        if (btnQuitarAsesor) {
            //Se habilita si hay un CRIE seleccionado (es decir, no es "")
            btnQuitarAsesor.disabled = !nuevoIdCrie;
        }
    });
}


//---------------------------Lógica de envío y manejo de bd---------------------------

//Logica del envío del formulario para saber si es guardado o edición
if (escuelaForm) {
    escuelaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        //Deshabilitar botón para evitar doble clic
        btnAceptar.disabled = true;
        btnAceptar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;


        //1. Ejecutar TODAS las validaciones
        const esFormularioValido = await validarTodoAlSubmit(modoEdicion);

        if (!esFormularioValido) {
            btnAceptar.disabled = false;
            btnAceptar.textContent = originalBtnText;
            return;
        }

        //2. Ejecución Final (Solo si todas las validaciones pasaron)
        if (modoEdicion) {
            await actualizarEscuela();
        } else {
            await registrarNuevaEscuela();
        }

        btnAceptar.disabled = false;
    });
}

//Función para el guardado
async function registrarNuevaEscuela() {
    //Capturar valores del formulario
    const cct = escuelaCCTInput.value.trim();
    const nombre = escuelaNombreInput.value.trim();
    const direccion = escuelaDireccionInput.value.trim();
    const turno = escuelaTurnoSelect.value;
    
    // 💡 LÓGICA CLAVE: Determinar el ID del CRIE a guardar
    const idCrie = esDirector ? idCrieDirector : (crieAsociadoSelect.value || null);
    const idAsesor = asesorACargoSelect.value;

    if (!cct || !nombre || !direccion || !turno || !idCrie) {
        // Mejoramos el mensaje para el director
        const msg = esDirector 
            ? 'Por favor, complete todos los campos (CCT, Nombre, Dirección y Turno).'
            : 'Por favor, complete todos los campos requeridos (incluyendo el CRIE).';
        
        mostrarNotificacion(msg, 'warning');
        return;
    }

    //Aseguramos que el valor guardado en Firebase sea vacío ("") si es "Pendiente"
    const idAsesorFinal = idAsesor === "Pendiente" ? "" : idAsesor;

    try {
        const nuevaEscuelaData = {
            cct: cct,
            nombre: nombre,
            direccion: direccion,
            turno: turno,
            // 💡 Usamos el valor determinado en la lógica clave
            idCrie: idCrie, 
            idAsesor: idAsesorFinal,
            status: 1
        };

        await addDoc(collection(db, 'Escuela'), nuevaEscuelaData);

        //Notificación y redirección
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `${nombre} agregada exitosamente.`,
            tipo: 'success'
        }));

        escuelaForm.reset();
        window.location.href = 'gestionEscuelas.html'; // Redirigir a la lista de Escuelas

    } catch (error) {
        console.error("Error al agregar escuela:", error);
        mostrarNotificacion(`Error: No se pudo registrar la escuela.`, 'danger');
        btnAceptar.disabled = false;
        btnAceptar.textContent = originalBtnText;
    }
}

//Función para la EDICION
async function actualizarEscuela() {
    if (!idEscuelaEdit) {
        mostrarNotificacion('Error: No se encontró el ID de edición necesario.', 'danger');
        return;
    }

    //2. Capturar valores
    const cct = escuelaCCTInput.value.trim();
    const nombre = escuelaNombreInput.value.trim();
    const direccion = escuelaDireccionInput.value.trim();
    const turno = escuelaTurnoSelect.value;
    
    // 💡 LÓGICA CLAVE: Determinar el ID del CRIE a guardar
    const idCrie = esDirector ? idCrieDirector : (crieAsociadoSelect.value || null);
    const idAsesor = asesorACargoSelect.value;

    if (!cct || !nombre || !direccion || !turno || !idCrie) {
        const msg = esDirector 
            ? 'El CCT, nombre, dirección y turno son obligatorios.'
            : 'El CCT, nombre, dirección, turno y CRIE son obligatorios.';
        
        mostrarNotificacion(msg, 'warning');
        return;
    }

    //Aseguramos que el valor guardado en Firebase sea vacío ("") si es "Pendiente"
    const idAsesorFinal = idAsesor === "Pendiente" ? "" : idAsesor;

    try {
        const escuelaRef = doc(db, 'Escuela', idEscuelaEdit);

        const updatesEscuela = {
            cct: cct,
            nombre: nombre,
            direccion: direccion,
            turno: turno,
            // 💡 Usamos el valor determinado en la lógica clave
            idCrie: idCrie, 
            idAsesor: idAsesorFinal
        };

        await updateDoc(escuelaRef, updatesEscuela);

        //3. Éxito
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `Escuela ${nombre} actualizada exitosamente.`,
            tipo: 'success'
        }));

        //4. Redirigir
        window.location.href = 'gestionEscuelas.html';

    } catch (error) {
        console.error("Error al actualizar escuela:", error);
        mostrarNotificacion(`Error: No se pudo actualizar la escuela.`, 'danger');
        btnAceptar.disabled = false;
        btnAceptar.textContent = originalBtnText;
    }
}

//---------------Fnciones de validación------------------

//Validar unicidad de CCT
async function validarUnicidadCCT(cct, idEscuelaActual = null) {
    if (!cct) return false;

    try {
        const escuelasRef = collection(db, 'Escuela');
        let q = query(escuelasRef, where('cct', '==', cct));

        const snapshot = await getDocs(q);

        if (snapshot.size > 0) {
            if (idEscuelaActual && snapshot.size === 1 && snapshot.docs[0].id === idEscuelaActual) {
                return true;
            }
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error al validar unicidad del CCT:", error);
        mostrarNotificacion("Error de conexión al validar CCT.", 'danger');
        return false;
    }
}

//Función para mostrar el Feedback en los divs correspondientes 
function mostrarFeedback(inputElement, valido, mensaje = '') {
    const parent = inputElement.closest('.mb-4, .mb-5, .menosabajoform');
    const inputGroupDiv = parent ? parent.querySelector('.input-group') : null;
    const feedbackDiv = parent ? parent.querySelector('.invalid-feedback') : null;

    if (valido) {
        inputElement.classList.remove('is-invalid');
        inputElement.classList.add('is-valid');

        if (inputGroupDiv) {
            inputGroupDiv.style.marginBottom = MARGIN_BOTTOM_VALID;
        }

        if (feedbackDiv) {
            feedbackDiv.textContent = '';
        }

    } else {
        inputElement.classList.remove('is-valid');
        inputElement.classList.add('is-invalid');

        if (inputGroupDiv) {
            inputGroupDiv.style.marginBottom = MARGIN_BOTTOM_INVALID;
        }

        if (feedbackDiv) {
            feedbackDiv.textContent = mensaje;
        }
    }
}

//Limpiar el feedback 
function limpiarFeedback() {
    [escuelaCCTInput, escuelaNombreInput, escuelaDireccionInput, escuelaTurnoSelect, crieAsociadoSelect, asesorACargoSelect].forEach(input => {

        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');

        const parent = input.closest('.mb-4, .mb-5, .menosabajoform');
        const feedbackDiv = parent ? parent.querySelector('.invalid-feedback') : null;
        const inputGroupDiv = parent ? parent.querySelector('.input-group') : null;

        if (inputGroupDiv) {
            inputGroupDiv.style.marginBottom = MARGIN_BOTTOM_VALID;
        }

        if (feedbackDiv) {
            feedbackDiv.textContent = '';
        }
    });
}


async function validarStatusFinal(idCrie, idAsesor) {
    let esValido = true;

    //1. Validar Status del CRIE (Obligatorio)
    if (idCrie) {
        try {
            const crieRef = doc(db, 'Crie', idCrie);
            const crieSnap = await getDoc(crieRef);

            if (!crieSnap.exists() || crieSnap.data().status !== 1) {
                mostrarNotificacion("El CRIE seleccionado fue desactivado.", 'danger');
                mostrarFeedback(crieAsociadoSelect, false, 'El CRIE seleccionado ya no está activo o fue eliminado.');
                esValido = false;
                noWarn = true;
            }
        } catch (error) {
            console.error("Error al verificar CRIE:", error);
            mostrarFeedback(crieAsociadoSelect, false, 'Error de conexión al verificar el CRIE.');
            esValido = false;
        }
    }

    //2. Validar Status del Asesor (Solo si no es "Pendiente")

    if (idAsesor && idAsesor !== "Pendiente") {
        try {
            const asesorRef = doc(db, 'Asesor', idAsesor);
            const asesorSnap = await getDoc(asesorRef);
            let idUsuarioAsesor = null;

            //a) Validar existencia y status del documento Asesor
            if (!asesorSnap.exists() || asesorSnap.data().status !== 1) {
                mostrarNotificacion("El asesor seleccionado fue desactivado.", 'danger');
                mostrarFeedback(asesorACargoSelect, false, 'El Asesor seleccionado ya no está activo o fue eliminado.');
                esValido = false;
                noWarn = true;
            } else {
                idUsuarioAsesor = asesorSnap.data().idUsuario;
            }

            //b) Confirmar que el Asesor sigue asociado al CRIE seleccionado.
            if (esValido && asesorSnap.exists() && asesorSnap.data().idCrie !== idCrie) {
                mostrarNotificacion("El Asesor ya no pertenece a ese CRIE", 'danger');
                mostrarFeedback(asesorACargoSelect, false, 'El Asesor ya no pertenece al CRIE seleccionado.');
                esValido = false;
                noWarn = true;
            }

            //c) Validar Status del Usuario asociado al Asesor 
            if (esValido && idUsuarioAsesor) {
                const userRef = doc(db, 'Usuario', idUsuarioAsesor);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists() || userSnap.data().status !== 1) {
                    mostrarNotificacion("El asesor seleccionado fue desactivado.", 'danger');
                    mostrarFeedback(asesorACargoSelect, false, 'El Asesor está desactivado');
                    esValido = false;
                    noWarn = true;
                }
            }

        } catch (error) {
            console.error("Error al verificar Asesor o Usuario asociado:", error);
            mostrarFeedback(asesorACargoSelect, false, 'Error de conexión al verificar el Asesor.');
            esValido = false;
        }
    }

    //Si no se detectaron errores, marcamos los selects como válidos (si no lo están ya).
    //Esto se hace solo si esValido sigue siendo True.
    if (esValido) {
        mostrarFeedback(crieAsociadoSelect, true);
        mostrarFeedback(asesorACargoSelect, true);
    }

    return esValido;
}



//Función ahora sí para validar todo
async function validarTodoAlSubmit(modoEdicion) {
    let esValido = true;

    //1. Limpiamos todos los estados de validación anteriores
    limpiarFeedback();

    const cct = escuelaCCTInput.value.trim();
    const nombre = escuelaNombreInput.value.trim();
    const direccion = escuelaDireccionInput.value.trim();
    const turno = escuelaTurnoSelect.value;
    const idCrie = crieAsociadoSelect.value;
    const idAsesor = asesorACargoSelect.value;

    //A. Validaciones síncronas

    //1. Validación de CCT (Obligatorio)
    if (!cct) {
        mostrarFeedback(escuelaCCTInput, false, 'El CCT no puede estar vacío.');
        esValido = false;
    } else {
        mostrarFeedback(escuelaCCTInput, true);
    }

    //2. Validación de Nombre (Obligatorio)
    if (!nombre) {
        mostrarFeedback(escuelaNombreInput, false, 'El nombre no puede estar vacío.');
        esValido = false;
    } else {
        mostrarFeedback(escuelaNombreInput, true);
    }

    //3. Validación de Dirección (Obligatorio)
    if (!direccion) {
        mostrarFeedback(escuelaDireccionInput, false, 'La dirección no puede estar vacía.');
        esValido = false;
    } else {
        mostrarFeedback(escuelaDireccionInput, true);
    }

    //4. Validación de Turno (Obligatorio)
    if (!turno) {
        mostrarFeedback(escuelaTurnoSelect, false, 'Debe seleccionar un turno.');
        esValido = false;
    } else {
        mostrarFeedback(escuelaTurnoSelect, true);
    }

    //5. Validación de CRIE (Obligatorio)
    if (!idCrie) { // idCrie será "" (vacío) si se deja el placeholder
        mostrarFeedback(crieAsociadoSelect, false, 'Elige un CRIE por favor.'); // <<< Nuevo mensaje
        esValido = false;
    } else {
        mostrarFeedback(crieAsociadoSelect, true);
    }

    //6. Validación de Asesor a Cargo
    //idAsesor será "" (vacío) si se deja el placeholder "Selecciona un asesor"
    if (!idAsesor) {
        mostrarFeedback(asesorACargoSelect, false, 'Selecciona un asesor o "Dejar pendiente por ahora".'); // <<< Nuevo error
        esValido = false;
    } else {
        mostrarFeedback(asesorACargoSelect, true);
    }

    //B. Validación asíncrona (unicidad del cct)
    if (cct) {
        const esCCTUnico = await validarUnicidadCCT(cct, idEscuelaEdit);

        if (!esCCTUnico) {
            mostrarFeedback(escuelaCCTInput, false, `El CCT "${cct}" ya está registrado en otra escuela.`);
            esValido = false;
        }
    }

    //C. Validación asíncrona final (status y existencia de crie/asesor/usuario)
    if (esValido && idCrie) {
        const esStatusValido = await validarStatusFinal(idCrie, idAsesor);
        if (!esStatusValido) {
            esValido = false;
        }
    }


    //Si hay algún error (síncrono o asíncrono), mostrar notificación general.
    if (!esValido) {
        if (noWarn == false) {
            mostrarNotificacion("Revise los errores marcados en el formulario.", 'warning');
        } else {
            noWarn = false;
        }
    }

    return esValido;
}

//------------------------------------Funciones para inicializar------------------------------------
//Inicia los eventos
function inicializarEventos() {
    //Cancelar
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            window.location.href = 'gestionEscuelas.html';
        });
    }

    if (btnQuitarAsesor) {
        btnQuitarAsesor.addEventListener('click', () => {
            //Establecer el valor a "Pendiente"
            asesorACargoSelect.value = "Pendiente";

            //Opcional: Mostrar un feedback visual o una notificación rápida
            mostrarNotificacion("Asesor establecido como pendiente.", 'info');
        });
    }
}




//La inicialización general del DOM
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Inicialización básica y eventos.
    establecerEstadoInicialSelects();
    inicializarEventos();

    // 2. Manejo del Director: Cargar ID de CRIE y aplicar restricciones.
    if (esDirector) {
        // Obtenemos el ID del CRIE del director logueado.
        idCrieDirector = await obtenerIdCrieDirector(directorEntidadId);
        aplicarRestriccionDirector(); // Oculta el campo CRIE

        if (!idCrieDirector) {
            // Caso de error: Director sin CRIE asociado. Detenemos la carga del formulario.
            mostrarNotificacion("Error: Su cuenta de Director no está vinculada a un CRIE. No puede agregar/editar escuelas.", 'danger');
            escuelaForm.innerHTML = '<p class="text-center text-danger">Acceso restringido. Por favor, contacte a su Administrador.</p>';
            return;
        }
    }

    // 3. Carga de Asesores (Necesario antes de cargar CRIE/Asesor)
    await obtenerAsesoresActivos();
    
    // Variables para determinar el estado inicial del CRIE y Asesor.
    let idCrieInicial = esDirector ? idCrieDirector : null; 
    let idAsesorInicial = null; // Solo se usará en modo edición

    // 4. Lógica de MODO EDICIÓN
    if (modoEdicion) {
        // Bloqueo y estado "Cargando..."
        const camposCarga = [escuelaCCTInput, escuelaNombreInput, escuelaDireccionInput, escuelaTurnoSelect, crieAsociadoSelect, asesorACargoSelect];

        camposCarga.forEach(input => {
            input.setAttribute('disabled', 'true');
            if (input.tagName === 'INPUT') {
                input.value = "Cargando...";
            }
        });
        btnAceptar.disabled = true;
        btnAceptar.textContent = originalBtnText;

        // Cargar datos de la Escuela a editar
        const dataEscuela = await cargarDatosEscuela(idEscuela); // Esta función debe rellenar los campos INFERIORES.
        
        if (dataEscuela) {
            // Sobrescribir el idCrie inicial con el valor de la escuela (incluso si es director, 
            // aunque el campo CRIE esté oculto, el valor debe ser el de la escuela).
            idCrieInicial = dataEscuela.idCrie;
            idAsesorInicial = dataEscuela.idAsesor;
        }

        // Desbloqueo de campos (se hace dentro de cargarDatosEscuela para ser más preciso, 
        // pero aseguramos al menos el botón aquí)
        btnAceptar.disabled = false;
        btnAceptar.textContent = originalBtnText;

    } 

    // 5. Poblar Selects de CRIE y Asesor (aplica a Modo Edición y Modo Agregar)
    
    // Si es Director: se usa idCrieDirector. 
    // Si es Admin/Asesor (Modo Agregar): idCrieInicial es null, se cargan todos los CRIE.
    // Si es Admin/Asesor (Modo Edición): idCrieInicial es el de la escuela.
    
    // Poblar CRIE, y obtener el CRIE que finalmente queda seleccionado/fijo.
    console.log(esDirector);
    let idCrieSeleccionado=null;
    if (esDirector || modoEdicion==false) {
        console.log(esDirector);
        idCrieSeleccionado = await poblarCrieSelect(idCrieInicial);
    }
    // Poblar Asesores: usa el CRIE final para filtrar y selecciona el Asesor inicial (si existe).
    if (modoEdicion==false){
    poblarAsesorSelect(idCrieSeleccionado, idAsesorInicial);
    }
});