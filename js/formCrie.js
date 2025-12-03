//js/formCrie.js
//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias
import {
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion } from "./toastFlotante.js";

//------------------ Variables e inicialización ------------------

//Campos del formulario
const cctInput = document.getElementById('cct');
const crieNameInput = document.getElementById('crieName');
const locationInput = document.getElementById('location');

//Formulario y título
const crieForm = document.getElementById('crieForm');
const formTitle = document.getElementById('formTitle');
const btnAceptar = document.getElementById('btn-aceptar');

//Director asociado (solo en modo edición)
const directorContainer = document.getElementById('directorContainer');
const selectDirector = document.getElementById('directorAsociado');
const btnQuitarDirector = document.getElementById('btnQuitarDirector');

//Variable global para almacenar los directores disponibles
let listaDirectoresDisponibles = [];
//Variable global para el ID del Director asociado actualmente al CRIE
let idDirectorActualCrie = null;

//Botones
const btnCancelar = document.getElementById('btn-cancelar');

let isProcessing = false;

//----------------- Constantes y Variables globales -----------------

const urlParams = new URLSearchParams(window.location.search);
const idCrie = urlParams.get('idCrie');
const modoEdicion = !!idCrie; //true si idCrie existe, false si es nulo

//Define el margen que debe tener el input-group cuando no hay error
const MARGIN_BOTTOM_VALID = '30px';
//Define el margen cuando hay error
const MARGIN_BOTTOM_INVALID = '0px';


//------------------ Funciones de Utilidad------------------

function toggleBotonAceptar(deshabilitar) {
    if (deshabilitar) {
        btnAceptar.disabled = true;
        btnAceptar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;
    } else {
        btnAceptar.disabled = false;
        //Restaurar el texto original (Guardar o Actualizar)
        btnAceptar.textContent = modoEdicion ? 'Actualizar' : 'Guardar';
    }
}

async function validarStatusDirector(idDirector) {
    if (!idDirector) return true; //Si no se seleccionó director (o se eligió "Pendiente"), es válido.

    try {
        //1. Obtener el idUsuario del Director
        const directorRef = doc(db, 'Director', idDirector);
        const directorSnap = await getDoc(directorRef);

        if (!directorSnap.exists()) {
            //Esto no debería pasar si se cargó correctamente, pero es una protección
            console.warn(`Director con ID ${idDirector} no encontrado.`);
            return false;
        }

        const idUsuario = directorSnap.data().idUsuario;

        //2. Obtener el estatus del Usuario
        const usuarioRef = doc(db, 'Usuario', idUsuario);
        const usuarioSnap = await getDoc(usuarioRef);

        if (usuarioSnap.exists() && usuarioSnap.data().status === 1) {
            return true; //Usuario activo
        } else {
            return false; //Usuario inactivo o no existe (invalida el proceso)
        }

    } catch (error) {
        console.error("Error al validar el estatus del Director:", error);
        mostrarNotificacion("Error de conexión al verificar el Director.", 'danger');
        return false; //Fallo de conexión o error grave
    }
}


//Función para limpiar todos los estados de validación
function limpiarFeedback() {
    [cctInput, crieNameInput, locationInput].forEach(input => {

        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');

        const parent = input.closest('.mb-4, .mb-5');
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

//Función para mostrar el Feedback en los divs correspondientes
function mostrarFeedback(inputElement, valido, mensaje = '') {
    const parent = inputElement.closest('.mb-4, .mb-5');
    const inputGroupDiv = parent ? parent.querySelector('.input-group') : null;
    const feedbackDiv = parent ? parent.querySelector('.invalid-feedback') : null;

    if (valido) {
        //Limpieza del feedbacbk
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

//Valida un solo CCT
async function validarUnicidadCCT(cct, idCrieActual = null) {
    if (!cct) return false;

    try {
        const criesRef = collection(db, 'Crie');

        //la consulta: buscar documentos donde el campo 'cct' sea igual al valor
        let q = query(criesRef, where('cct', '==', cct));

        const snapshot = await getDocs(q);

        if (snapshot.size > 0) {
            //Caso 1: Modo Edición, y el único resultado es el documento que estamos editando
            if (idCrieActual && snapshot.size === 1 && snapshot.docs[0].id === idCrieActual) {
                return true;
            }
            //Caso 2: Nuevo registro O el resultado es otro documento
            return false;
        }

        // Si no se encontró ningún documento, es único. -> VÁLIDO
        return true;

    } catch (error) {
        console.error("Error al validar unicidad del CCT:", error);
        mostrarNotificacion("Error de conexión al validar CCT.", 'danger');
        return false;
    }
}

async function validarTodoAlSubmit(modoEdicion) {
    let esValido = true;

    //1. Limpiamos todos los estados de validación anteriores
    limpiarFeedback();

    const cct = cctInput.value.trim();
    const nombre = crieNameInput.value.trim();
    const ubicacion = locationInput.value.trim();

    //1. Validación de CCT (Siempre requerido, tanto en registro como en edición)
    if (!cct) {
        mostrarFeedback(cctInput, false, 'El CCT es obligatorio.');
        esValido = false;
    } else {
        mostrarFeedback(cctInput, true);
    }

    //2. Validación de Nombre
    if (!nombre || nombre.length < 3) {
        mostrarFeedback(crieNameInput, false, 'El nombre debe tener al menos 3 caracteres.');
        esValido = false;
    } else {
        mostrarFeedback(crieNameInput, true);
    }

    //3. Validación de Ubicación
    if (!ubicacion) {
        mostrarFeedback(locationInput, false, 'La ubicación no puede estar vacía.');
        esValido = false;
    } else {
        mostrarFeedback(locationInput, true);
    }

    const idDirectorSeleccionado = selectDirector.value;

    if (idDirectorSeleccionado === 'default_invalid') {
        //Si el valor es el placeholder, forzamos un error
        mostrarFeedback(selectDirector, false, 'Debes elegir un director o seleccionar "pendiente por ahora".');
        esValido = false;
    } else {
        //Si se eligió un ID válido O el valor vacío ('') de "Dejar pendiente", es válido.
        mostrarFeedback(selectDirector, true);
    }

    if (idDirectorSeleccionado !== '' && idDirectorSeleccionado !== 'default_invalid') {
        //Solo si se seleccionó un director real (no el placeholder ni 'Pendiente')
        const esDirectorActivo = await validarStatusDirector(idDirectorSeleccionado);

        if (!esDirectorActivo) {
            mostrarFeedback(selectDirector, false, 'El director seleccionado ya no existe o fue desactivado.');
            esValido = false;
        } else {
            mostrarFeedback(selectDirector, true);
        }
    }

    //Solo validamos unicidad si el campo de CCT no está vacío.
    if (cct) {
        //En modo edición pasamos el ID del CRIE para que se auto-ignore
        const idActual = modoEdicion ? idCrie : null;
        const esCCTUnico = await validarUnicidadCCT(cct, idActual);

        if (!esCCTUnico) {
            mostrarFeedback(cctInput, false, `El CCT "${cct}" ya está registrado.`);
            esValido = false;
        } else {
            //Si pasó la unicidad
            mostrarFeedback(cctInput, true);
        }
    }


    //Si hay algún error, mostrar notificación general.
    if (!esValido) {
        mostrarNotificacion("Revise los errores marcados en el formulario.", 'warning');
    }

    return esValido;
}

//Funciones de carga
async function cargarDirectoresDisponibles() {
    try {
        //1. Obtener todos los Directores y los Usuarios activos (status: 1) de manera concurrente
        const [directoresSnap, usuariosSnap] = await Promise.all([
            getDocs(collection(db, 'Director')),
            getDocs(query(collection(db, 'Usuario'), where('status', '==', 1)))
        ]);

        const usuariosActivosIds = new Set(usuariosSnap.docs.map(doc => doc.id));

        //2. Mapear y filtrar Directores: solo incluimos aquellos cuyo 'idUsuario' esté activo
        const todosDirectores = directoresSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(d => usuariosActivosIds.has(d.idUsuario));

        listaDirectoresDisponibles = [];

        //3. Determinar quién es el director asociado a ESTE CRIE (si existe)
        const directorAsociado = todosDirectores.find(d => d.idCrie === idCrie);

        if (directorAsociado) {
            idDirectorActualCrie = directorAsociado.id;
            listaDirectoresDisponibles.push(directorAsociado);
        } else {
            idDirectorActualCrie = null;
        }

        //4. Añadir a los directores libres y activos (que no tienen idCrie)
        const directoresLibres = todosDirectores.filter(d => !d.idCrie);

        //Fusionar la lista del asociado y los libres, asegurando unicidad
        directoresLibres.forEach(d => {
            if (!listaDirectoresDisponibles.some(item => item.id === d.id)) {
                listaDirectoresDisponibles.push(d);
            }
        });

        //5. Ordenar por nombre
        listaDirectoresDisponibles.sort((a, b) => a.nombre.localeCompare(b.nombre));

    } catch (error) {
        console.error("Error al cargar directores disponibles:", error);
        mostrarNotificacion("Error al cargar la lista de directores, revise la conexión.", 'danger');
    }
}

function renderizarSelectDirector(idDirectorSeleccionado = null) {
    selectDirector.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = 'default_invalid';
    placeholderOption.textContent = 'Selecciona un director...';
    placeholderOption.disabled = true;

    //Si no hay director seleccionado, seleccionamos el placeholder por defecto
    if (!idDirectorSeleccionado) {
        placeholderOption.selected = true;
    }

    selectDirector.appendChild(placeholderOption);


    //2. Opciones de Directores
    listaDirectoresDisponibles.forEach(director => {
        const option = document.createElement('option');
        option.value = director.id;
        option.textContent = director.nombre;
        selectDirector.appendChild(option);
    });

    //3. Opción "Dejar pendiente por ahora"
    const pendienteOption = document.createElement('option');
    pendienteOption.value = '';
    pendienteOption.textContent = 'Dejar pendiente por ahora';
    selectDirector.appendChild(pendienteOption);


    //4. Seleccionar el valor correcto
    if (idDirectorSeleccionado) {
        
        selectDirector.value = idDirectorSeleccionado;
    } else if (selectDirector.value === '') {
        selectDirector.value = '';
    } else {
        //Si no hay director asociado, se seleccionará automáticamente el placeholder por su 'selected=true'
    }
}

//Funciones de CRUD
async function cargarDatosCrie() {
    if (!idCrie) return;

    const camposCarga = [cctInput, crieNameInput, locationInput];
    camposCarga.forEach(input => {
        input.value = "Cargando...";
        input.setAttribute('disabled', 'true');
    });
    btnAceptar.disabled = true;

    try {
        const crieRef = doc(db, 'Crie', idCrie);
        const crieSnap = await getDoc(crieRef);

        if (!crieSnap.exists()) {
            mostrarNotificacion("Error: CRIE no encontrado.", 'danger');
            setTimeout(() => window.location.href = 'gestionCries.html', 3000);
            return;
        }

        const crieData = crieSnap.data();

        //1. Cargar la lista de directores disponibles
        await cargarDirectoresDisponibles();

        //2. Renderizar el select y establecer la selección actual
        renderizarSelectDirector(idDirectorActualCrie);


        //3. Rellenar campos del formulario
        cctInput.value = crieData.cct || '';
        crieNameInput.value = crieData.nombre || '';
        locationInput.value = crieData.ubicacion || '';

        //4. Habilitar campos y botón de aceptar
        camposCarga.forEach(input => input.removeAttribute('disabled'));
        btnAceptar.textContent = 'Actualizar';
        btnAceptar.disabled = false;

    } catch (error) {
        console.error("Error al cargar datos para edición:", error);
        mostrarNotificacion("Error al cargar los datos del CRIE.", 'danger');
    }
}


//Registro de nuevo CRIE
async function registrarNuevoCrie() {
    const crieData = {
        cct: cctInput.value.trim(),
        nombre: crieNameInput.value.trim(),
        ubicacion: locationInput.value.trim(),
        status: 1
    };

    //Obtener el director seleccionado
    const idDirectorSeleccionado = selectDirector.value;

    try {
        //1. Crear el nuevo documento CRIE
        const newCrieRef = await addDoc(collection(db, 'Crie'), crieData);
        const idNuevoCrie = newCrieRef.id;

        //2. Asociar el Director al nuevo CRIE (SOLO si se seleccionó uno válido)
        if (idDirectorSeleccionado && idDirectorSeleccionado !== 'default_invalid') {
            const dirRef = doc(db, 'Director', idDirectorSeleccionado);

            await updateDoc(dirRef, { idCrie: idNuevoCrie });
            console.log(`Director (${idDirectorSeleccionado}) asociado al nuevo CRIE: ${idNuevoCrie}.`);
        }

        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `${crieData.nombre} registrado exitosamente.`,
            tipo: 'success'
        }));

        //Redirigir a la página de listado
        window.location.href = 'gestionCries.html';

    } catch (error) {
        console.error("Error al registrar CRIE:", error);
        mostrarNotificacion(`Error: No se pudo registrar el CRIE.`, 'danger');
    }
}

//Actualizar
async function actualizarCrie() {
    if (!idCrie) {
        mostrarNotificacion('Error: No se encontró el ID del CRIE para actualizar.', 'danger');
        return;
    }

    const cct = cctInput.value.trim();
    const nombre = crieNameInput.value.trim();
    const ubicacion = locationInput.value.trim();
    const idDirectorSeleccionado = selectDirector.value;

    if (!cct || !nombre || !ubicacion) {
        mostrarNotificacion('Todos los campos son obligatorios.', 'warning');
        return;
    }

    try {
        //a) Desasociar al Director anterior (si hay un cambio)
        if (idDirectorActualCrie && idDirectorActualCrie !== idDirectorSeleccionado) {
            const dirAntiguoRef = doc(db, 'Director', idDirectorActualCrie);
            await updateDoc(dirAntiguoRef, { idCrie: null });
            console.log(`Director anterior (${idDirectorActualCrie}) desasociado.`);
        }

        //b) Asociar al nuevo Director
        if (idDirectorSeleccionado && idDirectorSeleccionado !== 'default_invalid') {
            if (idDirectorSeleccionado !== idDirectorActualCrie) {
                const dirNuevoRef = doc(db, 'Director', idDirectorSeleccionado);
                await updateDoc(dirNuevoRef, { idCrie: idCrie });
                console.log(`Director nuevo (${idDirectorSeleccionado}) asociado al CRIE actual.`);
            }
        }

        //Paso 2: Actualizar el CRIE
        const crieRef = doc(db, 'Crie', idCrie);
        await updateDoc(crieRef, {
            cct: cct,
            nombre: nombre,
            ubicacion: ubicacion
        });

        //3. Éxito y Redirección
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `${nombre} actualizado exitosamente.`,
            tipo: 'success'
        }));

        window.location.href = 'gestionCries.html';

    } catch (error) {
        console.error("Error al actualizar CRIE y/o Director:", error);
        mostrarNotificacion(`Error: No se pudo actualizar el CRIE.`, 'danger');
    }
}


//------------------ Inicialización y Eventos------------------
//1. Manejador de envío del formulario
if (crieForm) {
    crieForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isProcessing) {
            return;
        }
        isProcessing = true; 
        toggleBotonAceptar(true);

        //2. Ejecutar TODAS las validaciones
        const esFormularioValido = await validarTodoAlSubmit(modoEdicion);

        if (!esFormularioValido) {
            isProcessing = false; 
            toggleBotonAceptar(false);
            return;
        }

        //3. Ejecución Final
        try {
            if (modoEdicion) {
                await actualizarCrie();
            } else {
                await registrarNuevoCrie();
            }
        } catch (error) {
            isProcessing = false;
            toggleBotonAceptar(false);

            throw error;
        }

    });
}

//2. Manejador del botón Cancelar
if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
        //Redirigir a la lista de CRIE
        window.location.href = 'gestionCries.html';
    });
}

//3. Manejador del botón Quitar Director
if (btnQuitarDirector) {
    btnQuitarDirector.addEventListener('click', () => {
        //Seleccionar la opción "Dejar pendiente por ahora" (que tiene value='')
        selectDirector.value = '';
        mostrarNotificacion("El CRIE quedará sin director por ahora", 'info');
    });
}

//3. Inicialización general
document.addEventListener('DOMContentLoaded', async () => {

    if (modoEdicion) {
        formTitle.textContent = "Editando CRIE";
        await cargarDatosCrie();
    } else {
        formTitle.textContent = "Agregando CRIE";

        await cargarDirectoresDisponibles();
        renderizarSelectDirector(null);
    }
});