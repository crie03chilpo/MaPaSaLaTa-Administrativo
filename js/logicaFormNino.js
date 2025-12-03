// js/logicaFormNino.js

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

import { obtenerSesion } from "./sessionManager.js";


//Variables globales
let listaCries = [];
let listaEscuelas = [];
let listaGrados = [];
let listaGrupos = [];
let modoEdicion = false;
let idNinoActual = null;
let idUsuarioActual = null; // ID del Usuario asociado al Niño


//Para obtener los roles
const DIRECTOR_ROL_ID = '2';
const ASESOR_ROL_ID = '3';
let usuarioActual = obtenerSesion();
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;
let esAsesor = usuarioActual && usuarioActual.idRol === ASESOR_ROL_ID;



// Constantes y Regex para validación
// Solo letras, espacios y acentos
const NOMBRE_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
const CURP_REGEX = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const SIN_ESPACIOS_REGEX = /^\S+$/; // No debe contener espacios en blanco

//Elementos del DOM HTML
const form = document.getElementById('ninoForm');
const formTitle = document.getElementById('formTitle');
const inputNombre = document.getElementById('nombre');
const inputApellidoPaterno = document.getElementById('apellidoPaterno');
const inputApellidoMaterno = document.getElementById('apellidoMaterno');
const inputCurp = document.getElementById('curp');
const selectCrie = document.getElementById('crie');
const selectEscuela = document.getElementById('escuela');
const selectGrado = document.getElementById('grado');
const selectGrupo = document.getElementById('grupo');
const inputUsuario = document.getElementById('usuario');
const inputContrasena = document.getElementById('contrasena');
const inputIdNino = document.getElementById('idNino');
const inputIdUsuario = document.getElementById('idUsuario');

const btnGenerarPassword = document.getElementById('btnGenerarPassword')

//Funciones, métodos y eventos------------------


//**********************Inicialización**********************

//1. Funcion para iniciar eventos
function inicializarEventos() {
    // Evento de cambio para CRIE (carga Escuelas)
    if (selectCrie) {
        selectCrie.addEventListener('change', filtrarEscuelasPorCrie);
    }

    // Evento para sincronizar CURP con Usuario
    // Solo actualiza el valor, no valida en este punto.
    if (inputCurp) {
        inputCurp.addEventListener('input', syncCurpToUser);
    }

    if (btnGenerarPassword) {
        btnGenerarPassword.addEventListener('click', generarContrasena);
    }    

    // Evento principal de envío del formulario
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }
}

// Función auxiliar para renderizar opciones en un <select>
function renderizarSelect(selectElement, dataArray, valueKey, textKey, defaultText = null) {
    selectElement.innerHTML = '';

    // Si se proporciona un texto por defecto (placeholder), se añade
    if (defaultText) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = defaultText;
        defaultOption.selected = true;
        defaultOption.disabled = true;
        selectElement.appendChild(defaultOption);
    }

    dataArray.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        selectElement.appendChild(option);
    });
}

/**
* Carga los datos de las colecciones Grado, Grupo y CRIE y Escuelas (para filtrado)
*/
async function cargarSelectoresIniciales() {
    try {
        // 1. Cargar Grados
        const snapshotGrados = await getDocs(collection(db, 'Grado'));
        listaGrados = snapshotGrados.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.numGrado - b.numGrado);
        renderizarSelect(selectGrado, listaGrados, 'id', 'numGrado', null);

        // 2. Cargar Grupos
        const snapshotGrupos = await getDocs(collection(db, 'Grupo'));
        listaGrupos = snapshotGrupos.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nombreGrupo.localeCompare(b.nombreGrupo));
        renderizarSelect(selectGrupo, listaGrupos, 'id', 'nombreGrupo', null);

        // 3. Cargar CRIE (Solo activos)
        const snapshotCries = await getDocs(collection(db, 'Crie'));
        listaCries = snapshotCries.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(crie => crie.status === 1);
        renderizarSelect(selectCrie, listaCries, 'id', 'nombre', null);

        // 4. Cargar Escuelas (Solo activas)
        const snapshotEscuelas = await getDocs(collection(db, 'Escuela'));
        listaEscuelas = snapshotEscuelas.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(escuela => escuela.status === 1);

        // Inicializar selector de Escuela como deshabilitado
        selectEscuela.innerHTML = '<option value="" selected disabled>Seleccione primero un CRIE</option>';
        selectEscuela.disabled = true;

    } catch (error) {
        console.error("Error al cargar selectores iniciales:", error);
        mostrarNotificacion('Error al cargar opciones de CRIE, Grado o Grupo.', 'danger');
    }
}

/**
* Filtra y renderiza las escuelas basándose en el CRIE seleccionado.
*/
function filtrarEscuelasPorCrie() {
    const idCrieSeleccionado = selectCrie.value;
    // La lista de escuelas ya está filtrada por status=1
    const escuelasFiltradas = listaEscuelas.filter(escuela => escuela.idCrie === idCrieSeleccionado);

    if (escuelasFiltradas.length > 0) {
        selectEscuela.disabled = false;
        renderizarSelect(selectEscuela, escuelasFiltradas, 'id', 'nombre', 'Seleccione una Escuela');
    } else {
        selectEscuela.disabled = true;
        selectEscuela.innerHTML = '<option value="" selected disabled>No hay escuelas activas para este CRIE</option>';
    }
    selectEscuela.value = ''; // Resetear la escuela
}

//2. Función que hace la consulta a la base de datos de firebase para precargar los datos del niño
//2. Función que hace la consulta a la base de datos de firebase para precargar los datos del niño
async function cargarDatosNino(idNino) {
    console.log(`Iniciando precarga de datos para Niño ID: ${idNino}...`);

    // Lista de campos para desbloquear y limpiar
    const camposCarga = [inputNombre, inputApellidoPaterno, inputApellidoMaterno, inputCurp, selectCrie, selectEscuela, selectGrado, selectGrupo, inputUsuario, inputContrasena];
    const btnAce = document.getElementById('btnAceptar');
    
    try {
        // 1. Obtener datos del Nino
        const ninoRef = doc(db, 'Nino', idNino);
        const docNino = await getDoc(ninoRef);

        if (!docNino.exists()) {
            throw new Error("El niño no existe en la base de datos.");
        }

        const ninoData = { id: docNino.id, ...docNino.data() };
        idUsuarioActual = ninoData.idUsuario;

        // 2. Obtener datos del Usuario
        const usuarioRef = doc(db, 'Usuario', idUsuarioActual);
        const docUsuario = await getDoc(usuarioRef);

        let usuarioData = docUsuario.exists() ? docUsuario.data() : {};

        // 3. Obtener datos ASOCIADOS al Niño (Escuela y CRIE) sin filtrar por status=1
        let escuelaData = null;
        let crieData = null;
        let idCrieAsociado = null;

        const escuelaRef = doc(db, 'Escuela', ninoData.idEscuela);
        const docEscuela = await getDoc(escuelaRef);
        
        if (docEscuela.exists()) {
            escuelaData = docEscuela.data();
            idCrieAsociado = escuelaData.idCrie;

            const crieRef = doc(db, 'Crie', idCrieAsociado);
            const docCrie = await getDoc(crieRef);
            if (docCrie.exists()) {
                crieData = docCrie.data();
            }
        }
        
        // 4. Rellenar los campos del formulario
        formTitle.textContent = `Editando: ${ninoData.nombre} ${ninoData.apellido_paterno}`;

        inputIdNino.value = idNino;
        inputIdUsuario.value = idUsuarioActual;

        inputNombre.value = ninoData.nombre || '';
        inputApellidoPaterno.value = ninoData.apellido_paterno || '';
        inputApellidoMaterno.value = ninoData.apellido_materno || '';
        inputCurp.value = ninoData.curp || '';
        inputUsuario.value = usuarioData.usuario || '';
        inputContrasena.value = ''; // Contraseña para pre-carga

        // 5. Seleccionar CRIE y Escuela con manejo de status
        
        let crieStatusValido = crieData && crieData.status === 1;
        let escuelaStatusValido = escuelaData && escuelaData.status === 1;

        // 5.1. Manejo del CRIE
        if (idCrieAsociado) {
            if (crieStatusValido) {
                // El CRIE está activo, se selecciona normalmente de la lista precargada.
                selectCrie.value = idCrieAsociado;
                
                // Carga la lista de escuelas activas del CRIE seleccionado.
                filtrarEscuelasPorCrie(); 
                
            } else {
                //  CRIE INACTIVO: Insertar la opción inactiva sin borrar las activas.
                
                const optionInactiva = document.createElement('option');
                optionInactiva.value = idCrieAsociado;
                optionInactiva.textContent = `${crieData.nombre} (INACTIVO)`;
                optionInactiva.selected = true; // Seleccionamos
                optionInactiva.disabled = true; // Deshabilitamos la selección
                
                // Limpiamos el valor y añadimos la opción inactiva al inicio
                selectCrie.value = '';
                selectCrie.prepend(optionInactiva); 
                
                selectCrie.disabled = false;
                
                // Forzar el mensaje de CRIE no seleccionado/inválido
                mostrarFeedback(selectCrie, false, 'El CRIE asociado no está activo. Seleccione uno nuevo.');
                
                // También debemos limpiar las escuelas, ya que no son válidas
                selectEscuela.innerHTML = '<option value="" selected disabled>Seleccione primero un CRIE</option>';
                selectEscuela.disabled = true;
            }
        }
        
        // 5.2. Manejo de la Escuela
        if (ninoData.idEscuela) {
            if (crieStatusValido) {
                // Si el CRIE está activo, ya se cargaron las opciones activas en el paso 5.1.
                if (escuelaStatusValido) {
                    // La escuela está activa, simplemente la seleccionamos de la lista.
                    selectEscuela.value = ninoData.idEscuela;
                } else {
                    //  ESCUELA INACTIVA (pero CRIE activo): 
                    selectEscuela.disabled = false;
                    
                    // Insertamos la opción inactiva al inicio del select y la seleccionamos.
                    const optionInactiva = document.createElement('option');
                    optionInactiva.value = ninoData.idEscuela;
                    optionInactiva.textContent = `${escuelaData.nombre} (INACTIVA)`;
                    optionInactiva.selected = true; // Seleccionamos
                    optionInactiva.disabled = true; // Deshabilitamos la selección
                    
                    // Aseguramos que el select no tiene valor por si la opción inactiva no se agrega bien
                    selectEscuela.value = ''; 
                    
                    // Añadimos la opción inactiva al inicio de la lista del select
                    selectEscuela.prepend(optionInactiva); 
                    
                    // Forzar el mensaje de Escuela no seleccionada/inválida
                    mostrarFeedback(selectEscuela, false, 'La Escuela asociada no está activa. Seleccione una nueva.');
                }
            } else {
                //  CRIE INACTIVO: La escuela no puede seleccionarse, mostrar mensaje de CRIE
                // Esta parte ya está cubierta arriba, pero se mantiene como redundancia de seguridad.
                selectEscuela.innerHTML = '<option value="" selected disabled>Seleccione primero un CRIE</option>';
                selectEscuela.disabled = true;
            }
        }


        // 6. Seleccionar Grado y Grupo (Estos se cargan de listas completas)
        selectGrado.value = ninoData.idGrado || '';
        selectGrupo.value = ninoData.idGrupo || '';
        
        // 7. Desbloqueo y Habilitación final (ÉXITO)
        camposCarga.forEach(input => input.removeAttribute('disabled'));
        if (btnAce) {
            btnAce.disabled = false;
            btnAce.textContent = "Actualizar datos"; 
        }

        if (esDirector) {
            // Director: Bloquear solo el CRIE
            selectCrie.setAttribute('disabled', 'true');
            // Las escuelas quedan editables (solo las de su CRIE)
            selectEscuela.removeAttribute('disabled');
            // No se debe permitir seleccionar un CRIE inactivo si es Director, por lo que se asume que si el CRIE del niño está inactivo, el Director debe notificarlo y solo puede editar la Escuela, Grado o Grupo.
            // Si el CRIE está inactivo, se debe asegurar que el input de CRIE tiene la opción inactiva seleccionada.
            if (!crieStatusValido) {
                 // Si el CRIE está inactivo, mantenemos la opción inactiva seleccionada y deshabilitada (lo que hace el paso 5.1).
                 // El Director solo puede ver el CRIE al que está asociado el niño, no puede cambiarlo.
                 selectCrie.setAttribute('disabled', 'true'); 
            }

        } else if (esAsesor) {
            // Asesor: Bloquear CRIE y Escuela
            selectCrie.setAttribute('disabled', 'true');
            selectEscuela.setAttribute('disabled', 'true');
            
            // Si la Escuela está inactiva, la opción inactiva ya fue preseleccionada y deshabilitada en el paso 5.2.
            // Si el CRIE está inactivo, la opción inactiva ya fue preseleccionada y deshabilitada en el paso 5.1.

        } else {
             // Administrador: Todos los campos editables
             selectCrie.removeAttribute('disabled');
             selectEscuela.removeAttribute('disabled');
        }


    } catch (error) {
        console.error("Error al cargar datos del niño:", error);
        formTitle.textContent = "Error al cargar datos";
        mostrarNotificacion(`Error al cargar datos: ${error.message}`, 'danger');
        
        // Desbloqueo y Limpieza (FALLO)
        camposCarga.forEach(input => {
             if (input.tagName === 'INPUT') input.value = ""; // Limpiar el "Cargando..."
             input.removeAttribute('disabled');
        });
        if (btnAce) {
            btnAce.disabled = false;
            btnAce.textContent = "Reintentar";
        }
    }
}

// Función que revisa si estamos en modo edición (si hay ID en la URL)
function checkFormMode() {
    const params = new URLSearchParams(window.location.search);
    idNinoActual = params.get('idNino');

    if (idNinoActual) {
        modoEdicion = true;
    } else {
        // En este contexto, el modo "agregar" se ignora según las instrucciones
        modoEdicion = false;
        formTitle.textContent = 'Formulario de Edición de Niño';
        // Deshabilitar el formulario si no hay ID (o redirigir)
        // form.querySelector('button[type="submit"]').disabled = true;
    }
}


//******************* De Validación *******************

/**
* Limpia todos los estados de validación del formulario (is-invalid y is-valid).
 * ESTA FUNCIÓN ES CLAVE PARA LA VALIDACIÓN EN SUBMIT.
*/
function limpiarFeedback() {
    const inputs = [
        inputNombre, inputApellidoPaterno, inputApellidoMaterno,
        inputCurp, selectCrie, selectEscuela, selectGrado, selectGrupo,
        inputUsuario, inputContrasena
    ];

    inputs.forEach(input => {

        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');

        // Manejo del div de feedback
        const parent = input.closest('.input-group-detalle') || input.closest('div');
        const feedbackDiv = parent ? parent.querySelector('.invalid-feedback') : null;

        if (feedbackDiv) {
            feedbackDiv.textContent = '';
        }
    });
}

/**
* Muestra el feedback de validación (verde/rojo) de forma consistente.
*/
function mostrarFeedback(inputElement, valido, mensaje = '') {
    // 1. Encontrar el contenedor principal (.input-group-detalle)
    const parentContainer = inputElement.closest('.input-group-detalle');

    // La lógica de búsqueda del feedbackDiv se adapta a tu HTML
    const feedbackDiv = parentContainer ?
        parentContainer.querySelector('.invalid-feedback') :
        inputElement.nextElementSibling;

    if (valido) {
        inputElement.classList.remove('is-invalid');
        
        // >>> NUEVA LÓGICA: Quitar el margen si es válido o vacío <<<
        if (parentContainer) {
            parentContainer.classList.remove('mb-0'); 
        }
        // ---------------------------------------------------------
        
        // Solo agrega 'is-valid' si tiene valor O si es un SELECT 
        if (inputElement.value.trim() !== '' || inputElement.tagName === 'SELECT') {
            inputElement.classList.add('is-valid');
        } else {
            inputElement.classList.remove('is-valid');
        }

        if (feedbackDiv) {
            feedbackDiv.textContent = '';
        }

    } else {
        inputElement.classList.remove('is-valid'); // QUITAR EL VERDE
        inputElement.classList.add('is-invalid');

        // >>> NUEVA LÓGICA: Poner el margen a 0 si es inválido <<<
        if (parentContainer) {
            parentContainer.classList.add('mb-0');
        }
        // ----------------------------------------------------

        if (feedbackDiv) {
            feedbackDiv.textContent = mensaje;
        }
    }
}


// function mostrarFeedback(inputElement, valido, mensaje = '') {
//     // La lógica de búsqueda del feedbackDiv se adapta a tu HTML
//     const feedbackDiv = inputElement.closest('.input-group-detalle') ?
//         inputElement.closest('.input-group-detalle').querySelector('.invalid-feedback') :
//         inputElement.nextElementSibling;

//     if (valido) {
//         inputElement.classList.remove('is-invalid');
//         // Solo agrega 'is-valid' si tiene valor O si es un SELECT 
//         if (inputElement.value.trim() !== '' || inputElement.tagName === 'SELECT') {
//             inputElement.classList.add('is-valid');
//         } else {
//             inputElement.classList.remove('is-valid');
//         }

//         if (feedbackDiv) {
//             feedbackDiv.textContent = '';
//         }

//     } else {
//         inputElement.classList.remove('is-valid'); // QUITAR EL VERDE
//         inputElement.classList.add('is-invalid');

//         if (feedbackDiv) {
//             feedbackDiv.textContent = mensaje;
//         }
//     }
// }


/**
* Valida un campo de texto con un regex específico.
*/
function validarCampoRegex(input, regex, errorMessage) {
    const value = input.value.trim();

    // 1. Campo Obligatorio Vacío
    if (value === '') {
        if (input.id !== 'apellidoMaterno') {
            mostrarFeedback(input, false, 'Este campo es obligatorio.');
            return false;
        } else {
            // Apellido materno opcional y vacío: limpiar explícitamente ambos estados
            input.classList.remove('is-invalid', 'is-valid');
            return true;
        }
    }

    // 2. Campo NO Vacio pero NO cumple el REGEX (Falla)
    if (!regex.test(value)) {
        mostrarFeedback(input, false, errorMessage); // Marca como rojo (false)
        return false;
    }

    // 3. Campo NO Vacio y SÍ cumple el REGEX (Éxito)
    mostrarFeedback(input, true); // Marca como verde (true)
    return true;
}

/**
* Valida un campo de selección (select).
*/
function validarSelect(select, errorMessage) {
    // 🛑 CAMBIO CLAVE: Si el select está deshabilitado, lo consideramos automáticamente válido.
    // Esto es necesario para la lógica de roles (Director/Asesor) donde el campo está fijo.
    if (select.disabled) {
        mostrarFeedback(select, true); // Marcar como válido (o al menos no inválido)
        return true; 
    }

    // Lógica original: Si no está deshabilitado, debe tener un valor.
    if (select.value === '') {
        mostrarFeedback(select, false, errorMessage);
        return false;
    }
    
    mostrarFeedback(select, true);
    return true;
}


async function validarStatusCrieEscuela(idCrie, idEscuela) {
    let crieActivo = true;
    let escuelaActiva = true;

    try {
        // 1. Verificar CRIE
        const crieRef = doc(db, 'Crie', idCrie);
        const docCrie = await getDoc(crieRef);
        
        if (!docCrie.exists() || docCrie.data().status !== 1) {
            crieActivo = false;
        }

        // 2. Verificar Escuela
        const escuelaRef = doc(db, 'Escuela', idEscuela);
        const docEscuela = await getDoc(escuelaRef);

        if (!docEscuela.exists() || docEscuela.data().status !== 1) {
            escuelaActiva = false;
        }

    } catch (error) {
        console.error("Error al verificar status de CRIE/Escuela:", error);
        // Si hay un error de conexión, asumimos temporalmente que están inactivos para prevenir la edición.
        mostrarNotificacion("Error de conexión al verificar estatus de CRIE/Escuela.", 'danger');
        crieActivo = false;
        escuelaActiva = false;
    }

    return { crieActivo, escuelaActiva };
}
/**
* Realiza todas las validaciones personalizadas.
* Se llama solo en el submit.
*/

async function validarTodo() {
    let isValid = true;

    // CLAVE: LIMPIAR TODO ANTES DE REVALIDAR
    limpiarFeedback();

    // --- LÓGICA DE VALIDACIÓN SÍNCRONA ---

    // 1. Nombre y Apellidos 
    if (!validarCampoRegex(inputNombre, NOMBRE_REGEX, 'Solo letras, espacios y acentos. Sin números/especiales.')) isValid = false;
    if (!validarCampoRegex(inputApellidoPaterno, NOMBRE_REGEX, 'Solo letras, espacios y acentos. Sin números/especiales.')) isValid = false;

    // La lógica de Apellido Materno ahora se simplifica ya que validarCampoRegex lo maneja internamente.
    // Solo actualizamos isValid si el campo realmente falla (no es vacío y no pasa el regex).
    if (!validarCampoRegex(inputApellidoMaterno, NOMBRE_REGEX, 'Solo letras, espacios y acentos. Sin números/especiales.') && inputApellidoMaterno.value.trim() !== '') {
        isValid = false;
    }

    // 2. CURP
    if (!validarCampoRegex(inputCurp, CURP_REGEX, 'Formato de CURP incorrecto. Asegúrese de que esté en mayúsculas.')) isValid = false;

    // 3. Selectores
    if (!validarSelect(selectCrie, 'Debe seleccionar un CRIE.')) isValid = false;
    if (!validarSelect(selectEscuela, 'Debe seleccionar una Escuela.')) isValid = false;
    if (!validarSelect(selectGrado, 'Debe seleccionar un Grado.')) isValid = false;
    if (!validarSelect(selectGrupo, 'Debe seleccionar un Grupo.')) isValid = false;

    // 4. Usuario (sin espacios)
    const usuario = inputUsuario.value.trim();
    if (!validarCampoRegex(inputUsuario, SIN_ESPACIOS_REGEX, 'El nombre de usuario es obligatorio y no debe contener espacios.')) isValid = false;

    // 5. Contraseña (sin espacios)
    if (!validarCampoRegex(inputContrasena, SIN_ESPACIOS_REGEX, 'La contraseña es obligatoria y no debe contener espacios.')) isValid = false;


    // --- LÓGICA DE VALIDACIÓN ASÍNCRONA 1: Unicidad del Usuario ---
    // Solo validamos unicidad si el campo *pasó* su validación síncrona de regex.
    if (inputUsuario.classList.contains('is-valid')) { 
        const esUsuarioUnico = await validarUnicidadUsuario(usuario, idUsuarioActual);

        if (!esUsuarioUnico) {
            mostrarFeedback(inputUsuario, false, `El usuario/CURP "${usuario}" ya existe. Por favor, modifique la CURP.`);
            isValid = false;
        }
        // No se necesita un 'else' aquí, ya que la validación síncrona anterior ya marcó 'is-valid' si aplica.
    }
    
    // --- LÓGICA DE VALIDACIÓN ASÍNCRONA 2: Status de CRIE y Escuela (Nueva) ---
    const idCrie = selectCrie.value;
    const idEscuela = selectEscuela.value;

    if (idCrie && idEscuela && isValid) { // Solo si los selects pasaron la validación obligatoria (y el formulario es válido hasta ahora)
        const estatusValidos = await validarStatusCrieEscuela(idCrie, idEscuela);

        if (!estatusValidos.crieActivo) {
            mostrarFeedback(selectCrie, false, 'El CRIE seleccionado ya no está activo.');
            isValid = false;
        }
        
        if (!estatusValidos.escuelaActiva) {
            mostrarFeedback(selectEscuela, false, 'La Escuela seleccionada ya no está activa.');
            isValid = false;
        }
    }


    return isValid;
}
//Validar el usuario
async function validarUnicidadUsuario(usuario, idUsuarioActual = null) {
    if (!usuario) return false;

    try {
        const usersRef = collection(db, 'Usuario');

        let q = query(usersRef, where('usuario', '==', usuario));

        const snapshot = await getDocs(q);

        if (snapshot.size > 0) {
            // Si estamos en EDICIÓN y el ÚNICO resultado es nuestro propio ID, es válido.
            if (idUsuarioActual && snapshot.size === 1 && snapshot.docs[0].id === idUsuarioActual) {
                return true;
            }
            // Si no, es INVÁLIDO.
            return false;
        }
        // Si no hay resultados, es único.
        return true;

    } catch (error) {
        console.error("Error al validar unicidad del usuario:", error);
        mostrarNotificacion("Error de conexión al validar usuario.", 'danger');
        return false;
    }
}

//Generar
async function generarClaveAutonumericaNino() {
    const ninoCollectionRef = collection(db, 'Nino'); // Referencia a la colección de niños
    
    try {
        // Obtenemos todos los documentos en la colección 'Nino'
        const snapshot = await getDocs(ninoCollectionRef);
        const count = snapshot.size; // Obtenemos la cantidad de niños registrados
        
        const nuevoValor = count + 1; // El siguiente ID es la cuenta actual + 1
        
        // Formatear a 3 dígitos (ej: 1 -> 001, 13 -> 013, 123 -> 123)
        return nuevoValor.toString().padStart(3, '0');

    } catch (error) {
        console.error("Error al obtener el contador de Nino:", error);
        mostrarNotificacion("Error al generar la clave autonumérica.", 'danger');
        return '999'; // Fallback
    }
}
async function generarContrasena() {
    // 1. Validar campos obligatorios
    const nombre = inputNombre.value.trim();
    const apellidoPaterno = inputApellidoPaterno.value.trim();
    const apellidoMaterno = inputApellidoMaterno.value.trim();

    if (!nombre || !apellidoPaterno) {
        mostrarNotificacion("Debe ingresar el Nombre y el Apellido Paterno primero.", 'warning');
        if (!nombre) inputNombre.classList.add('is-invalid');
        if (!apellidoPaterno) inputApellidoPaterno.classList.add('is-invalid');
        return;
    }

    // Deshabilitar botón temporalmente
    btnGenerarPassword.disabled = true;

    try {
        // 2. Obtener Iniciales
        const inicialNombre = nombre.charAt(0).toUpperCase();
        const inicialAP = apellidoPaterno.charAt(0).toUpperCase();
        // Solo usa la inicial del materno si existe, sino es una cadena vacía
        const inicialAM = apellidoMaterno ? apellidoMaterno.charAt(0).toUpperCase() : '';

        // 3. Obtener Clave Autonumérica
        const claveAutonumerica = await generarClaveAutonumericaNino();

        // 4. Construir Contraseña Final
        const contrasenaGenerada = `${inicialNombre}${inicialAP}${inicialAM}N${claveAutonumerica}`;

        // 5. Rellenar el campo
        inputContrasena.value = contrasenaGenerada;
        mostrarFeedback(inputContrasena, true); // Marcar como válido
        mostrarNotificacion("Contraseña generada con éxito.", 'success');

    } catch (error) {
        console.error("Error al generar la contraseña:", error);
        mostrarNotificacion("Error al generar la contraseña.", 'danger');
    } finally {
        // Habilitar botón
        btnGenerarPassword.disabled = false;
    }
}

//******************* De Envío y Actualización *******************

/**
* Sincroniza la CURP con el campo de Usuario, haciéndolo mayúsculas y eliminando espacios.
 * NO aplica ninguna lógica de validación aquí.
*/
function syncCurpToUser() {
    const curpValue = inputCurp.value.trim().toUpperCase().replace(/\s/g, '');
    inputCurp.value = curpValue;
    inputUsuario.value = curpValue;

    // IMPORTANTE: No limpiar ni aplicar clases de validación aquí.
    // La limpieza total se hará al inicio de validarTodo() en el submit.
}

/**
* Maneja el envío del formulario.
*/
async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    // 1. Ejecutar validación
    const esFormularioValido = await validarTodo();

    if (!esFormularioValido) {
        // Solo se agrega la clase was-validated después del fallo

        mostrarNotificacion('Por favor, revise y corrija los campos marcados en rojo.', 'warning');
        return;
    }
    // Si es válido, se quita la clase was-validated (aunque no es estrictamente necesario aquí)


    if (!modoEdicion) {
        mostrarNotificacion('Esta funcionalidad solo permite la EDICIÓN de niños.', 'info');
        return;
    }

    // 2. Obtener datos limpios
    const datosNino = {
        nombre: inputNombre.value.trim(),
        apellido_paterno: inputApellidoPaterno.value.trim(),
        apellido_materno: inputApellidoMaterno.value.trim(),
        curp: inputCurp.value.trim().toUpperCase(),
        idEscuela: selectEscuela.value,
        idGrado: selectGrado.value,
        idGrupo: selectGrupo.value,
    };

    const datosUsuario = {
        usuario: inputUsuario.value.trim(),
        contrasena: inputContrasena.value.trim(),
    };

    try {
        await actualizarNino(datosNino, datosUsuario);
    } catch (error) {
        console.error("Error general al editar el niño:", error);
        mostrarNotificacion('Ocurrió un error al intentar editar los datos.', 'danger');
    }
}


/**
* Actualiza el documento Nino y su Usuario asociado en Firebase.
*/
async function actualizarNino(ninoData, userData) {
    if (!idNinoActual || !idUsuarioActual) {
        throw new Error("IDs de Nino o Usuario faltantes para la edición.");
    }

    // 1. Actualizar Usuario
    const usuarioRef = doc(db, 'Usuario', idUsuarioActual);
    await updateDoc(usuarioRef, {
        usuario: userData.usuario,
        contrasena: userData.contrasena
        // status y idRol no se modifican en la edición de datos personales
    });

    // 2. Actualizar Nino
    const ninoRef = doc(db, 'Nino', idNinoActual);
    await updateDoc(ninoRef, {
        nombre: ninoData.nombre,
        apellido_paterno: ninoData.apellido_paterno,
        apellido_materno: ninoData.apellido_materno,
        curp: ninoData.curp,
        idEscuela: ninoData.idEscuela,
        idGrado: ninoData.idGrado,
        idGrupo: ninoData.idGrupo,
    });

    // 3. Notificación y redirección
    sessionStorage.setItem('notificacionPendiente', JSON.stringify({
        mensaje: `Los datos del niño/a ${ninoData.nombre} ${ninoData.apellido_paterno} se han actualizado correctamente.`,
        tipo: 'success'
    }));

    // Redirigir a la vista de gestión o lista
    window.location.href = 'gestionNinos.html';
}


//************* Otras acciones ********+++++++++++++++++++++

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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar modo y obtener el ID del niño (si aplica)
    checkFormMode(); // Esto establece 'modoEdicion' e 'idNinoActual' de forma síncrona
    
    //  PASO 1: Bloqueo y estado "Cargando..." ejecutado de inmediato (si es edición)
    if (modoEdicion && idNinoActual) {
        
        const camposCarga = [inputNombre, inputApellidoPaterno, inputApellidoMaterno, inputCurp, selectCrie, selectEscuela, selectGrado, selectGrupo, inputUsuario, inputContrasena];
        const btnAce = document.getElementById('btnAceptar'); 
        
        camposCarga.forEach(input => {
            input.setAttribute('disabled', 'true');
            if (input.tagName === 'INPUT') { 
                input.value = "Cargando...";
            }
        });

        formTitle.textContent = "Cargando datos del Niño...";
        
        if (btnAce) {
            btnAce.disabled = true;
            btnAce.textContent = "Cargando..."; 
        }
        
    }

    // 2. Cargar selectores necesarios
    // La carga debe ocurrir AHORA, después del bloqueo visual
    await cargarSelectoresIniciales();

    // 3. Si estamos en modo edición, precargar los datos
    if (modoEdicion && idNinoActual) {
        // Ejecutamos la carga asíncrona, que rellenará y desbloqueará
        await cargarDatosNino(idNinoActual);
        
    } else {
        // Si no es edición, solo manejar notificaciones pendientes
        manejarNotificacionPendiente();
    }

    // 4. Inicializar listeners
    inicializarEventos();
});