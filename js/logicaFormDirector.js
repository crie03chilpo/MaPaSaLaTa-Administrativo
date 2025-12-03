//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias para el form
import { collection, addDoc, doc, getDoc, updateDoc, runTransaction, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion } from "./toastFlotante.js"; 

//------------------Variables e incialización------------------
//Campos del formulario de Director
const directorNameInput = document.getElementById('directorName');
const crieAsociadoSelect = document.getElementById('crieAsociado');
const btnQuitarCrie = document.getElementById('btnQuitarCrie');
const userNameInput = document.getElementById('userName');
const passwordInput = document.getElementById('password');
//Confirmación
const confirmPasswordInput = document.getElementById('confirmPassword'); 

//Botones generar
const btnGenerateUser = document.getElementById('btnGenerarUsuario');
const btnGeneratePass = document.getElementById('btnGenerarPassword');
const btnCancelar = document.getElementById('btnCancelar');
const btnAcep = document.getElementById('btnAcept');

//-------------Variables globales--------------------
//Almacenar IDs para el modo edición
let idDirectorEdit = null;
let idUsuarioEdit = null;

let isProcessing = false;

//-------------Constantes globales------------------

const urlParams = new URLSearchParams(window.location.search);
const idDirector = urlParams.get('idDirector');
const modoEdicion = !!idDirector; 

const directorForm = document.getElementById('directorForm'); 
const formTitle = document.getElementById('formTitle'); 

//Define el margen que debe tener el input-group cuando NO hay error
const MARGIN_BOTTOM_VALID = '30px'; 
//Define el margen cuando hay error (para que el feedback quepa)
const MARGIN_BOTTOM_INVALID = '0px'; 

const DIRECTOR_ROL_ID = "2"; 

const MAX_INTENTOS_UNICIDAD = 10;
const PREFIJO_DIRECTOR = 'D';

//---------------------Funciones, métodos y toda los eventos o lógica---------------------
function toggleBotonAceptar(deshabilitar) {
    if (deshabilitar) {
        btnAcept.disabled = true;
        //Agregamos el spinner y el texto de procesamiento
        btnAcept.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;
    } else {
        btnAcept.disabled = false;
        //Restaurar el texto original (Guardar o Actualizar)
        btnAcept.textContent = modoEdicion ? 'Actualizar' : 'Guardar';
    }
}

//Función para colocar el select de CRIE en la opción "Dejar pendiente por ahora"
function quitarCrieAsociado() {
    
    crieAsociadoSelect.value = ""; 
    
    const selectedOption = crieAsociadoSelect.options[crieAsociadoSelect.selectedIndex];
    if (selectedOption && selectedOption.value === 'default_invalid') {
        
        for (let i = 0; i < crieAsociadoSelect.options.length; i++) {
            if (crieAsociadoSelect.options[i].value === "") {
                crieAsociadoSelect.selectedIndex = i;
                break;
            }
        }
    }
    
    //Limpiar cualquier feedback de error anterior
    mostrarFeedback(crieAsociadoSelect, true);

    //Mostrar la notificación solicitada
    mostrarNotificacion("El Director quedará sin CRIE por ahora.", 'info');
}


//***********************Lógica de inicialización y carga***********************

//1. Revisa si es modo edición para cargar los datos
if (modoEdicion) {
    idDirectorEdit = idDirector;
    formTitle.textContent = "Editando Director";
    
} else {
    formTitle.textContent = "Agregando Director";
}

//Función auxiliar para obtener los CRIE no relacionados con ningún Director
async function obtenerCrieSinDirector() {
    try {
        //1. Obtener todos los Directores y mapear los idCrie que ya están asociados.
        const directoresSnap = await getDocs(collection(db, 'Director'));
        const crieAsociados = new Set();
        directoresSnap.forEach(docDir => {
            const idCrie = docDir.data().idCrie;
            if (idCrie) {
                crieAsociados.add(idCrie);
            }
        });

        //2. Obtener todos los CRIE ACTIVO (status: 1).
        const crieCol = collection(db, 'Crie');
    
        const qCrieActivos = query(crieCol, where('status', '==', 1));
        const crieSnap = await getDocs(qCrieActivos);
        
        const crieDisponibles = [];
        crieSnap.forEach(docCrie => {
            
            if (!crieAsociados.has(docCrie.id)) {
                crieDisponibles.push({ id: docCrie.id, nombre: docCrie.data().nombre });
            }
        });

        return crieDisponibles;

    } catch (error) {
        console.error("Error al obtener CRIE disponibles:", error);
        mostrarNotificacion("Error al cargar la lista de CRIE.", 'danger');
        return [];
    }
}

//Función para rellenar el SELECT de CRIE
async function poblarCrieSelect(idCrieActual = null) {
    let crieDisponibles = await obtenerCrieSinDirector();
    
    //Limpiar el select actual
    crieAsociadoSelect.innerHTML = '';
    let crieActualData = null;

    //Si estamos en modo edición y hay un CRIE actual, obtener sus datos.
    if (idCrieActual) {
        try {
            const crieRef = doc(db, 'Crie', idCrieActual);
            const crieSnap = await getDoc(crieRef);
            if (crieSnap.exists()) {
                crieActualData = { id: crieSnap.id, nombre: crieSnap.data().nombre };
                //Agregar el CRIE actual al inicio de la lista de disponibles (si no lo está ya)
                if (!crieDisponibles.some(c => c.id === idCrieActual)) {
                    crieDisponibles.unshift(crieActualData);
                }
            }
        } catch (error) {
            console.error("Error al obtener CRIE actual:", error);
        }
    }

    const placeholderOption = document.createElement('option');
    placeholderOption.value = "default_invalid"; 
    placeholderOption.textContent = "Selecciona un CRIE para asignar...";
    placeholderOption.selected = true; 
    placeholderOption.disabled = true;
    crieAsociadoSelect.appendChild(placeholderOption);

    //Agregar la opción "Dejar pendiente por ahora"
    const pendienteOption = document.createElement('option');
    pendienteOption.value = "";
    pendienteOption.textContent = "Dejar pendiente por ahora";
    crieAsociadoSelect.appendChild(pendienteOption);

    //Agregar las opciones disponibles (los que no tienen Director y el actual)
    if (crieDisponibles.length > 0) {
        crieDisponibles.forEach(crie => {
            const option = document.createElement('option');
            option.value = crie.id;
            option.textContent = crie.nombre;
            
            //Si es edición y es el CRIE asignado, seleccionarlo
            if (idCrieActual === crie.id) {
                option.selected = true; 
                //Asegurar que el placeholder no quede seleccionado
                placeholderOption.selected = false;
            }
            crieAsociadoSelect.appendChild(option);
        });
    }

    //Si es modo Edición y el idCrieActual es nulo o vacío
    if (modoEdicion && !idCrieActual) {

        //Seleccionamos la opción "Dejar pendiente por ahora"
        pendienteOption.selected = true;
        placeholderOption.selected = false;
    }
}

//2. Cargar datos si es edición
async function cargarDatosDirector(idDirector) {
    if (!idDirector) return;

    //1: Mostrar estado de "Cargando..."
    const camposCarga = [directorNameInput, crieAsociadoSelect, userNameInput, passwordInput, confirmPasswordInput];
    camposCarga.forEach(input => {
        input.value = "Cargando...";
        input.setAttribute('disabled', 'true');
    });
    //También deshabilitamos el botón de aceptar
    btnAcept.disabled = true;

    try {
        btnAcept.textContent="Actualizar";

        //2: Obtener el Director
        const directorRef = doc(db, 'Director', idDirector);
        const directorSnap = await getDoc(directorRef);

        if (!directorSnap.exists()) {
            mostrarNotificacion("Error: Director no encontrado.", 'danger');
            //Redireccionar o limpiar, pero por ahora solo retornamos
            setTimeout(() => window.location.href = 'gestionDirectores.html', 3000); 
            return;
        }

        const directorData = directorSnap.data();
        idUsuarioEdit = directorData.idUsuario;

        //Rellenar campo nombre del Director
        directorNameInput.value = directorData.nombre || '';
        
        //Rellenar campo CRIE
        await poblarCrieSelect(directorData.idCrie);


        //3: Obtener el Usuario Relacionado
        if (idUsuarioEdit) {
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                userNameInput.value = userData.usuario || '';

                passwordInput.value = ''; 
                confirmPasswordInput.value = '';
            }
        }
        
        //4 Habilitar campos y botón de aceptar
        camposCarga.forEach(input => input.removeAttribute('disabled'));
        btnAcept.disabled = false;


    } catch (error) {
        console.error("Error al cargar datos para edición:", error);
        mostrarNotificacion("Error al cargar los datos del director.", 'danger');
        
        //Asegurar que los campos se desbloqueen si hay un error
        camposCarga.forEach(input => {
            input.value = "";
            input.removeAttribute('disabled');
        });
        btnAcept.disabled = false;
    }
}


//***********************Lógica de envío y manejo de bd***********************
//3. Logica del envío del formulario para saber si es guardado o edición
if (directorForm) {
    directorForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        if (isProcessing) {
            return; 
        }
        isProcessing = true; 
        toggleBotonAceptar(true); 

        //Ejecutar Todas las validaciones
        const esFormularioValido = await validarTodoAlSubmit(modoEdicion);
        
        if (!esFormularioValido) {
            isProcessing = false;
            toggleBotonAceptar(false);
            return;
        }
        
        //3. Ejecución Final
        try {
            if (modoEdicion) {
                await actualizarDirector();
            } else {
                await registrarNuevoDirector();
            }
        } catch (error) {
            //Si falla la operación de la BD
            isProcessing = false;
            toggleBotonAceptar(false);
            throw error;
        }
    });
}

//4. Función para el guardado
async function registrarNuevoDirector() {
    //Capturar valores del formulario
    const nombre = directorNameInput.value.trim();
    const idCrie = crieAsociadoSelect.value || null;
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value; 
    
    //El formulario ya valida que estos no estén vacíos, pero se mantiene la precaución.
    if (!nombre || !usuario || !contrasena) {
        mostrarNotificacion('Por favor, complete todos los campos requeridos.', 'warning');
        return;
    }

    const esCrieValido = await validarCrieFinal(idCrie, null);
    if (!esCrieValido) {
        mostrarFeedback(crieAsociadoSelect, false, "CRIE no disponible.");
        isProcessing = false;         //AJUSTE CLAVE: Desactivar el flag de procesamiento.
        toggleBotonAceptar(false);
        return;
    }
    mostrarFeedback(crieAsociadoSelect, true);

    
    try {
        await runTransaction(db, async (transaction) => {
            
            // Caso A: Crear un nuevo documento en la colección Usuario
            const nuevoUsuarioData = {
                usuario: usuario,
                contrasena: contrasena,
                idRol: DIRECTOR_ROL_ID,
                status: 1 
            };

            const nuevoUsuarioRef = doc(collection(db, 'Usuario'));
            transaction.set(nuevoUsuarioRef, nuevoUsuarioData);
            const idNuevoUsuario = nuevoUsuarioRef.id;

            //Caso B: Crear el documento en la colección Director
            const nuevoDirectorData = {
                nombre: nombre,
                idCrie: idCrie,
                idUsuario: idNuevoUsuario 
            };

            const nuevoDirectorRef = doc(collection(db, 'Director'));
            transaction.set(nuevoDirectorRef, nuevoDirectorData);
        });

        //5. Notificación y redirección
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `Director ${nombre} agregado exitosamente.`,
            tipo: 'success'
        }));
        
        directorForm.reset(); 
        window.location.href = 'gestionDirectores.html'; //Redirigir a la lista de Directores

    } catch (error) {
        console.error("Error en la transacción al agregar director:", error);
        mostrarNotificacion(`Error: No se pudo registrar al director.`, 'danger');
        isProcessing = false;
        toggleBotonAceptar(false);
    }
}

//5. Función para la EDICION DIRECTOR:
async function actualizarDirector() {
    //1. Validación de IDs
    if (!idDirectorEdit || !idUsuarioEdit) {
        mostrarNotificacion('Error: No se encontró el ID de edición necesario.', 'danger');
        return;
    }

    //2. Capturar valores
    const nombre = directorNameInput.value.trim();
    const idCrie = crieAsociadoSelect.value || null;
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value; 

    if (!nombre || !usuario) {
        mostrarNotificacion('El nombre y el usuario no pueden estar vacíos.', 'warning');
        return;
    }

    const esCrieValido = await validarCrieFinal(idCrie, idDirectorEdit); 
    if (!esCrieValido) {
        mostrarFeedback(crieAsociadoSelect, false, "CRIE no disponible o no activo.");
        isProcessing = false;         //AJUSTE CLAVE: Desactivar el flag de procesamiento.
        toggleBotonAceptar(false);
        return;
    }
    mostrarFeedback(crieAsociadoSelect, true);    

    try {
        await runTransaction(db, async (transaction) => {
            
            //Caso A: Actualizar el documento en la colección Director
            const directorRef = doc(db, 'Director', idDirectorEdit);
            
            //Actualizamos nombre e idCrie
            transaction.update(directorRef, {
                nombre: nombre,
                idCrie: idCrie 
            });

            //Caso B: Preparar la actualización del documento 'Usuario'
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const updatesUsuario = {
                usuario: usuario 
            };

            if (contrasena && contrasena.length > 0) {
                updatesUsuario.contrasena = contrasena;
            }

            //Actualiza el documento Usuario
            transaction.update(userRef, updatesUsuario);
        });

        //3. Éxito
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `Director ${nombre} actualizado exitosamente.`,
            tipo: 'success'
        }));
        
        //4. Redirigir
        window.location.href = 'gestionDirectores.html';
    } catch (error) {
        console.error("Error en la transacción al actualizar director:", error);
        mostrarNotificacion(`Error: No se pudo actualizar al director.`, 'danger');
    }
}

//******************Generación automática de credenciales*******************

//1. Función para generar las iniciales (Reutilizada del Admin, funciona igual)
function generarIniciales(nombreCompleto) {
    if (!nombreCompleto) return "";
    
    const palabras = nombreCompleto.trim().split(/\s+/);
    const iniciales = palabras.map(palabra => palabra.charAt(0).toUpperCase()).join('');
    
    return iniciales;
}

//La clave autonumérica
async function generarClaveAutonumericaUnica(iniciales) {
    const directorCollectionRef = collection(db, 'Director');
    
    try {
        // 1.Obtener el número base de la colección Director.
        const snapshot = await getDocs(directorCollectionRef);
        const count = snapshot.size; 
        
        let numeroBase = count;

        for (let intento = 1; intento <= MAX_INTENTOS_UNICIDAD; intento++) {
            
            const siguienteNumero = numeroBase + intento;
            const numeroFormateado = String(siguienteNumero).padStart(3, '0');
            
            //Formato de usuario: [INICIALES][PREFIJO][NUMERO] (ej: JPRD004)
            const usuarioPropuesto = `${iniciales}${PREFIJO_DIRECTOR}${numeroFormateado}`; 
            
            
            const esUnico = await validarUnicidadUsuario(usuarioPropuesto, null);
            
            if (esUnico) {
               
                return usuarioPropuesto;
            }
            
            console.warn(`Usuario propuesto "${usuarioPropuesto}" ya existe. Intentando +1...`);
        }
        
        //Fallo: Máximo de intentos alcanzado.
        console.error(`Fallo al generar un usuario único después de ${MAX_INTENTOS_UNICIDAD} intentos.`);
        return null;

    } catch (error) {
        console.error("Error al contar/validar directores para clave autonumérica:", error);
        mostrarNotificacion("Error al obtener el contador de la base de datos.", 'danger');
        return null; 
    }
}


//3.Función para generar ahora sí las credenciales con las funciones
async function generarCredenciales(debeActualizarUsuario = true) {
    const nombre = directorNameInput.value.trim();

    if (!nombre) {
        mostrarNotificacion("Por favor, ingrese el nombre del director primero.", 'warning');
        directorNameInput.focus();
        return;
    }
    
    //Deshabilitar botones para evitar clics múltiples
    if (btnGenerateUser) btnGenerateUser.disabled = true;
    if (btnGeneratePass) btnGeneratePass.disabled = true;

    const iniciales = generarIniciales(nombre); 
    
    //1 Generar un usuario ÚNICO con reintento
    const usuarioCalculado = await generarClaveAutonumericaUnica(iniciales);

    if (usuarioCalculado === null) {
        //Manejo del error si no se encontró un usuario único después de los reintentos.
        mostrarNotificacion(`Error al generar usuario de forma automática, cree uno manualmente.`, 'danger');
        userNameInput.value = '';
        mostrarFeedback(userNameInput, false, 'Error al generar usuario único. Intente manualmente.');
        
        if (btnGenerateUser) btnGenerateUser.disabled = false;
        if (btnGeneratePass) btnGeneratePass.disabled = false;
        return;
    }

    let usuarioBaseParaContrasena = '';

    //2 Lógica para el campo de Usuario (userNameInput)
    if (debeActualizarUsuario) {
        userNameInput.value = usuarioCalculado;
        mostrarFeedback(userNameInput, true);
        usuarioBaseParaContrasena = usuarioCalculado;
    } else {
        const usuarioExistente = userNameInput.value.trim();
        
        usuarioBaseParaContrasena = usuarioExistente || usuarioCalculado;
        
        if (!usuarioExistente) {
             userNameInput.value = usuarioCalculado;
             mostrarFeedback(userNameInput, true);
        }
    }

    
    //3 Generar y Rellenar Contraseña
    if (usuarioBaseParaContrasena) {
        const contrasenaGenerada = `${usuarioBaseParaContrasena}P`; 
        
        passwordInput.value = contrasenaGenerada;
        confirmPasswordInput.value = contrasenaGenerada; 
        
        mostrarFeedback(passwordInput, true);
        mostrarFeedback(confirmPasswordInput, true);
        
        mostrarNotificacion("Usuario y contraseña generados con éxito, guarde la contraseña por favor.", 'success');

    } else {
         mostrarNotificacion("No se pudo generar la contraseña: la base de usuario está vacía.", 'danger');
    }

    //Habilitar de nuevo
    if (btnGenerateUser) btnGenerateUser.disabled = false;
    if (btnGeneratePass) btnGeneratePass.disabled = false;
}


//**********************Funciones de validación**********************

//1. Limpiar el feedback
function limpiarFeedback() {
    [directorNameInput, crieAsociadoSelect, userNameInput, passwordInput, confirmPasswordInput].forEach(input => {
        
        input.classList.remove('is-invalid');
        input.classList.remove('is-valid');
        
        //Manejo del div que contiene el feedback
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

//2. Validar usuario único
async function validarUnicidadUsuario(usuario, idUsuarioActual = null) {
    if (!usuario) return false;

    try {
        const usersRef = collection(db, 'Usuario');
        
        let q = query(usersRef, where('usuario', '==', usuario));
        
        const snapshot = await getDocs(q);

        if (snapshot.size > 0) {
            if (idUsuarioActual && snapshot.size === 1 && snapshot.docs[0].id === idUsuarioActual) {
                return true; 
            }
            return false; 
        }
        return true;

    } catch (error) {
        console.error("Error al validar unicidad del usuario:", error);
        mostrarNotificacion("Error de conexión al validar usuario.", 'danger');
        return false; 
    }
}


async function validarCrieFinal(idCrie, idDirectorActual) {
    //Si no se seleccionó CRIE, es válido (es la opción "Dejar pendiente").
    if (!idCrie) return true; 

    try {
        //1. Verificar Status del CRIE
        const crieRef = doc(db, 'Crie', idCrie);
        const crieSnap = await getDoc(crieRef);

        if (!crieSnap.exists() || crieSnap.data().status !== 1) {
            mostrarNotificacion('El CRIE seleccionado ya no existe o fue desactivado', 'danger');
            return false;
        }

        //2. Verificar si el CRIE tiene otro Director asignado
        const directoresRef = collection(db, 'Director');
        //Buscar Directores que tengan este idCrie
        let q = query(directoresRef, where('idCrie', '==', idCrie));
        const directoresSnap = await getDocs(q);

        if (directoresSnap.size > 0) {
            //Si tiene resultados, revisamos si es el Director actual (en modo edición)
            if (idDirectorActual && directoresSnap.docs.length === 1 && directoresSnap.docs[0].id === idDirectorActual) {
                // Es el mismo Director que ya lo tenía, es válido.
                return true;
            }
            //Si es un Director nuevo o si el actual ya tenía otro CRIE asignado:
            mostrarNotificacion('El CRIE seleccionado ya está asociado a otro director.', 'danger');
            return false;
        }

        return true;

    } catch (error) {
        console.error("Error en validación final del CRIE:", error);
        mostrarNotificacion('Error de conexión al validar el CRIE. Intente de nuevo.', 'danger');
        return false;
    }
}

//3. Función para mostrar el Feedback en los divs correspondientes (Reutilizada, funciona igual)
function mostrarFeedback(inputElement, valido, mensaje = '') {
    const parent = inputElement.closest('.mb-4, .mb-5');
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


//4. Función ahora sí para validar todo (Adaptada para Director)
async function validarTodoAlSubmit(modoEdicion) {
    let esValido = true;
    
    //1. Limpiamos todos los estados de validación anteriores
    limpiarFeedback(); 

    const nombre = directorNameInput.value.trim();
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value;
    const confirmContrasena = confirmPasswordInput.value;
    const nombreRegex = /^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/;
    const usuarioPassRegex = /^\S+$/; // No debe tener espacios
    
    //1. Validación de Nombre (No vacío y Formato)
    if (!nombre) {
        mostrarFeedback(directorNameInput, false, 'El nombre no puede estar vacío.');
        esValido = false;
    } else if (!nombreRegex.test(nombre)) {
        mostrarFeedback(directorNameInput, false, 'El nombre solo acepta letras, espacios y acentos.');
        esValido = false;
    } else {
        mostrarFeedback(directorNameInput, true); 
    }
    
    //2. Validación de CRIE (Ahora sí es requerida si no se selecciona "Pendiente")
    const idCrieSeleccionado = crieAsociadoSelect.value;
    
    if (idCrieSeleccionado === 'default_invalid') {
        mostrarFeedback(crieAsociadoSelect, false, 'Selecciona un CRIE o elige "Dejar pendiente por ahora".');
        esValido = false;
    } else {
        mostrarFeedback(crieAsociadoSelect, true);
    }
    
    //3. Validación de Usuario (No vacío y sin espacios)
    if (!usuario) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede estar vacío.');
        esValido = false;
    } else if (!usuarioPassRegex.test(usuario)) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede contener espacios.');
        esValido = false;
    } else {
        mostrarFeedback(userNameInput, true); 
    }

    //4. Validación de Contraseñas
    let contrasenaRequerida = modoEdicion ? (contrasena || confirmContrasena) : true;
    let passValido = true; 

    if (contrasenaRequerida) {
        if (!contrasena) {
            mostrarFeedback(passwordInput, false, 'La contraseña no puede estar vacía.');
            passValido = false;
        } else if (!usuarioPassRegex.test(contrasena)) {
            mostrarFeedback(passwordInput, false, 'La contraseña no puede contener espacios.');
            passValido = false;
        } else {
            mostrarFeedback(passwordInput, true); 
        }

        if (!confirmContrasena) {
             mostrarFeedback(confirmPasswordInput, false, 'Debe confirmar la contraseña.');
             passValido = false;
        } else if (contrasena !== confirmContrasena) {
            mostrarFeedback(confirmPasswordInput, false, 'Las contraseñas no coinciden.');
            passValido = false;
        } else {
             mostrarFeedback(confirmPasswordInput, true);
        }
        
        if (!passValido) {
            esValido = false;
        }
    } else {
        //Modo Edición y no se quieren cambiar, se marcan como válidos
        mostrarFeedback(passwordInput, true);
        mostrarFeedback(confirmPasswordInput, true);
    }
    
    if (usuario && usuarioPassRegex.test(usuario)) {
        const esUsuarioUnico = await validarUnicidadUsuario(usuario, idUsuarioEdit);
        
        if (!esUsuarioUnico) {
            mostrarFeedback(userNameInput, false, `El usuario "${usuario}" ya existe. Por favor, elija otro.`);
            esValido = false;
        } 
    }
    
    //Si hay algún error (síncrono o asíncrono), mostrar notificación general.
    if (!esValido) {
        mostrarNotificacion("Revise los errores marcados en el formulario.", 'warning');
    }
    
    return esValido;
}


//------------------------------------Funciones para inicializar------------------------------------
//1. Inicia los eventos para los botones de generar y cancelar
function inicializarEventos() {
    // Generadores
    if (btnGenerateUser) {
        btnGenerateUser.addEventListener('click', () => generarCredenciales(true)); 
    }

    if (btnGeneratePass) {
        btnGeneratePass.addEventListener('click', () => generarCredenciales(false)); 
    }

    if (btnQuitarCrie) {
        btnQuitarCrie.addEventListener('click', quitarCrieAsociado);
    }

    // Cancelar
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            window.location.href = 'gestionDirectores.html';
        });
    }
}


//La inicialización general del DOM
document.addEventListener('DOMContentLoaded', async () => {
    //1. Inicializar Eventos
    inicializarEventos(); 

    //2. Ejecutar la carga o la población de CRIE
    if (modoEdicion) {
        //Si es edición, cargarDatosDirector llama a poblarCrieSelect con el CRIE actual
        await cargarDatosDirector(idDirector);
    } else {
        //Si es nuevo, solo poblar con los CRIE disponibles
        await poblarCrieSelect();
    }
});