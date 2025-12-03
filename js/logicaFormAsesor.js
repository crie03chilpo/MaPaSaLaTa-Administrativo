//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias para el form
import { collection, addDoc, doc, getDoc, updateDoc, runTransaction, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion } from "./toastFlotante.js"; 


import { obtenerSesion } from "./sessionManager.js";

//------------------Variables e incialización------------------
//Campos del formulario de Asesor
const asesorNameInput = document.getElementById('asesorName');
const crieAsociadoSelect = document.getElementById('crieAsociado');
const userNameInput = document.getElementById('userName');
const passwordInput = document.getElementById('password');
//Confirmación
const confirmPasswordInput = document.getElementById('confirmPassword'); 

//Botones generar y cancelar
const btnGenerateUser = document.getElementById('btnGenerarUsuario');
const btnGeneratePass = document.getElementById('btnGenerarPassword');
const btnCancelar = document.getElementById('btnCancelar');
const btnAce = document.getElementById('btnAceptar');

//-------------Variables globales--------------------
//Almacenar IDs para el modo edición
let idAsesorEdit = null;
let idUsuarioEdit = null;

let originalBtnText = "";

//-------------Constantes globales------------------

const urlParams = new URLSearchParams(window.location.search);
const idAsesor = urlParams.get('idAsesor'); // ID de Asesor para edición
const modoEdicion = !!idAsesor; // true si idAsesor existe, false si es nulo

const asesorForm = document.getElementById('asesorForm'); 
const formTitle = document.getElementById('formTitle'); 

//Define el margen que debe tener el input-group cuando NO hay error
const MARGIN_BOTTOM_VALID = '30px'; 
//Define el margen cuando hay error (para que el feedback quepa)
const MARGIN_BOTTOM_INVALID = '0px'; 

const ASESOR_ROL_ID = "3"; // ID de Rol que se asume para Asesores (Debería ser validado en base a tu colección 'Rol')


//Usuario único
const MAX_INTENTOS_UNICIDAD = 5; //Número máximo de intentos para encontrar un usuario único
const PREFIJO_ASESOR = "AS";


// Nuevas variables de control de Director
const DIRECTOR_ROL_ID = '2';
let usuarioActual = obtenerSesion();
let esDirector = usuarioActual && usuarioActual.idRol === DIRECTOR_ROL_ID;
let idCrieDirector = null; // Se cargará asíncronamente
let nombreCrieDirector = null; // Se cargará asíncronamente


//---------------------Funciones, métodos y toda los eventos o lógica---------------------

// Funcián para obtener el ID y Nombre del CRIE del Director
async function obtenerDatosCrieDirector() {
    if (!usuarioActual || !usuarioActual.entidadId) return;

    try {
        const directorRef = doc(db, 'Director', usuarioActual.entidadId);
        const directorSnap = await getDoc(directorRef);

        if (directorSnap.exists()) {
            const idCrie = directorSnap.data().idCrie;
            
            if (idCrie) {
                const crieRef = doc(db, 'Crie', idCrie);
                const crieSnap = await getDoc(crieRef);

                if (crieSnap.exists()) {
                    idCrieDirector = idCrie;
                    nombreCrieDirector = crieSnap.data().nombre;
                }
            }
        }
    } catch (error) {
        console.error("Error al obtener el CRIE del Director:", error);
        mostrarNotificacion("Error de seguridad: No se pudo verificar la entidad CRIE asociada.", 'danger');
    }
}


//---------lógica de inicialización y carga-------------------

//1. Revisa si es modo edición para cargar los datos
if (modoEdicion) {
    idAsesorEdit = idAsesor;
    formTitle.textContent = "Editando Asesor";
    originalBtnText = "Actualizar y continuar";
} else {
    formTitle.textContent = "Agregando Asesor";
    originalBtnText = "Guardar y continuar";
}

//Función auxiliar para obtener TODOS los CRIE activos (status = 1)
async function obtenerCrieActivos() {
    // Si es Director, solo devolvemos su propio CRIE (si está activo)
    if (esDirector && idCrieDirector) {
        try {
            const crieRef = doc(db, 'Crie', idCrieDirector);
            const crieSnap = await getDoc(crieRef);
            if (crieSnap.exists() && crieSnap.data().status === 1) {
                return [{ id: idCrieDirector, nombre: crieSnap.data().nombre }];
            }
            return []; // El CRIE del Director está bloqueado o no existe.
        } catch (error) {
            console.error("Error al obtener CRIE del Director:", error);
            return [];
        }
    }

    // Si es Administrador, obtenemos todos los CRIE activos
    try {
        const crieCol = collection(db, 'Crie');
        //Filtra por CRIE con status igual a 1 (activos/desbloqueados)
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

//Función para rellenar el SELECT de CRIE
async function poblarCrieSelect(idCrieActual = null) {
    let crieDisponibles = await obtenerCrieActivos();

    crieAsociadoSelect.innerHTML = '';
    
    // Si es Director y se cargó su CRIE, se forza la selección y se bloquea
    if (esDirector && idCrieDirector) {
        const option = document.createElement('option');
        option.value = idCrieDirector;
        option.textContent = nombreCrieDirector;
        option.selected = true;
        crieAsociadoSelect.appendChild(option);
        crieAsociadoSelect.setAttribute('disabled', 'true'); // << BLOQUEAR EL SELECT
        crieAsociadoSelect.classList.add('is-valid'); // Opcional: Para indicar que el campo está "correcto"
        return;
    }

    // Lógica para Administrador (select editable)
    
    //Agregar el placeholder por defecto (value="" para fallar la validación)
    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = "Selecciona el CRIE al que pertenece";
    placeholderOption.selected = true;
    placeholderOption.disabled = true;
    crieAsociadoSelect.appendChild(placeholderOption);


    //Si no hay CRIE disponibles, terminamos aquí
    if (crieDisponibles.length === 0) {
        placeholderOption.textContent = "No hay CRIE activos disponibles";
        return;
    }
    
    //Agregar las opciones disponibles
    crieDisponibles.forEach((crie) => {
        const option = document.createElement('option');
        option.value = crie.id;
        option.textContent = crie.nombre;
        
        //Lógica de selección:
        if (idCrieActual && idCrieActual === crie.id) {
             //1. Si estamos en edición y coincide con el actual
             option.selected = true;
             //Si seleccionamos uno real, deseleccionamos el placeholder
             placeholderOption.selected = false;
        }
        //2. Si es modo nuevo, dejamos el placeholder seleccionado.

        crieAsociadoSelect.appendChild(option);
    });
}

//2. Cargar datos si es edición
async function cargarDatosAsesor(idAsesor) {
    if (!idAsesor) return;
    
    //Lista de campos para desbloquear
    const camposCarga = [asesorNameInput, crieAsociadoSelect, userNameInput, passwordInput, confirmPasswordInput];

    try {
        //1. Ajustar el texto del botón
        if (btnAce) {
            btnAce.textContent="Actualizar y continuar";
        }
        
        //Obtener el Asesor
        const asesorRef = doc(db, 'Asesor', idAsesor);
        const asesorSnap = await getDoc(asesorRef);

        if (!asesorSnap.exists()) {
            mostrarNotificacion("Error: Asesor no encontrado.", 'danger');
            
            //Si falla, desbloqueamos y limpiamos el 'cargando'
            camposCarga.forEach(input => {
                if (input.tagName === 'INPUT') input.value = "";
                input.removeAttribute('disabled');
            });
            if (btnAce) btnAce.disabled = false;
            return;
        }

        const asesorData = asesorSnap.data();
        idUsuarioEdit = asesorData.idUsuario;

        //Rellenar campo nombre del Asesor
        asesorNameInput.value = asesorData.nombre || '';
        
        //Rellenar campo CRIE
        // La función poblarCrieSelect ahora maneja si es Director o Administrador
        await poblarCrieSelect(asesorData.idCrie); 
        
        // **VALIDACIÓN ADICIONAL PARA DIRECTOR EN EDICIÓN**
        // Si el Director intenta editar un Asesor que NO es de su CRIE, lo bloqueamos
        if (esDirector && asesorData.idCrie !== idCrieDirector) {
            mostrarNotificacion("Acceso Denegado: Solo puede editar asesores de su propio CRIE.", 'danger');
            
            // Bloquear todos los campos y botones
            camposCarga.forEach(input => input.setAttribute('disabled', 'true'));
            if (btnAce) btnAce.disabled = true;
            return; 
        }

        //Paso 2: Obtener el Usuario Relacionado
        if (idUsuarioEdit) {
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                //Rellenar campo usuario
                userNameInput.value = userData.usuario || '';
                
                passwordInput.value = '';
                confirmPasswordInput.value = '';

                passwordInput.removeAttribute('disabled');
                userNameInput.removeAttribute('disabled');
            }
        }
        
        //Desbloqueo y Habilitación final de todos los campos que aún sigan bloqueados
        camposCarga.forEach(input => {
            // No quitar 'disabled' si fue aplicado por ser Director al CRIE Select
            if (input.id !== 'crieAsociado' || !esDirector) { 
                input.removeAttribute('disabled');
            }
        });
        if (btnAce) btnAce.disabled = false;
        
    } catch (error) {
        console.error("Error al cargar datos para edición:", error);
        mostrarNotificacion("Error al cargar los datos del asesor.", 'danger');
        
        // Asegurar que los campos se desbloqueen si hay un error de conexión
        camposCarga.forEach(input => {
             if (input.tagName === 'INPUT') input.value = "Error.";
             input.removeAttribute('disabled');
        });
        if (btnAce) btnAce.disabled = false;
    }
}

//------------lógica de envío y manejo de bd--------------------

//Lógica del envío del formulario para saber si es guardado o edición
if (asesorForm) {
    asesorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        //Paso 1: Bloquear el botón y cambiar el texto
        btnAce.disabled = true;
        btnAce.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
        
        //2. Ejecutar todas las validaciones
        const esFormularioValido = await validarTodoAlSubmit(modoEdicion);
        
        if (!esFormularioValido) {
            
            btnAce.disabled = false;
            
            btnAce.textContent = modoEdicion ? "Actualizar y continuar" : originalBtnText;
            
            return;
        }
        
        //3. Ejecución Final (Solo si todas las validaciones pasaron)
        let newAsesorId = null;
        
        try {
            if (modoEdicion) {
                await actualizarAsesor();
                newAsesorId = idAsesorEdit;
            } else {
                await validarCrieDirector(); // Valida CRIE para nuevo registro
                newAsesorId = await registrarNuevoAsesor();
            }
        } catch (error) {
            //Error en la base de datos
            console.error("Error fatal en el proceso de guardado/actualización:", error);
            mostrarNotificacion('Error inesperado al intentar guardar el Asesor.', 'danger');
            newAsesorId = null;
        } finally {
            //4: Restaurar el botón si no hubo redirección exitosa
            if (!newAsesorId) {
                btnAce.disabled = false;
                
                btnAce.textContent = modoEdicion ? "Actualizar y continuar" : originalBtnText;
            }
        }

        //5. Redirección final a la asignación de escuela (Si newAsesorId existe)
        if(newAsesorId) {
            sessionStorage.setItem('notificacionPendiente', JSON.stringify({
                mensaje: `Asesor ${asesorNameInput.value.trim()} procesado exitosamente. Ahora asigne una escuela.`,
                tipo: 'info'
            }));
            window.location.href = `asignarEscuelaAsesor.html?idAsesor=${newAsesorId}`;
        }
    });
}

// Función de validación de CRIE para Director en modo Guardado
async function validarCrieDirector() {
    if (esDirector) {
        if (!idCrieDirector) {
            throw new Error("El Director no tiene un CRIE asociado válido.");
        }
        // Aseguramos que el valor del select es el del director
        crieAsociadoSelect.value = idCrieDirector;
    }
}


//Función para el guardado
async function registrarNuevoAsesor() {
    //Capturar valores del formulario
    const nombre = asesorNameInput.value.trim();
    // Usa el valor del select, que ya fue fijado o elegido por el Director/Admin
    const idCrie = crieAsociadoSelect.value;
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value;
    
    let idNuevoAsesor = null;

    if (!nombre || !usuario || !contrasena || !idCrie) {
        mostrarNotificacion('Por favor, complete todos los campos requeridos.', 'warning');
        return null;
    }
    
    try {
        await runTransaction(db, async (transaction) => {
            
            //Paso A: Crear un nuevo documento en la colección Usuario
            const nuevoUsuarioData = {
                usuario: usuario,
                contrasena: contrasena,
                idRol: ASESOR_ROL_ID,
                status: 1
            };

            const nuevoUsuarioRef = doc(collection(db, 'Usuario'));
            transaction.set(nuevoUsuarioRef, nuevoUsuarioData);
            const idNuevoUsuario = nuevoUsuarioRef.id;

            // --- PASO B: Crear el documento en la colección 'Asesor' ---
            const nuevoAsesorData = {
                nombre: nombre,
                idCrie: idCrie,
                idUsuario: idNuevoUsuario,
                status: 1
            };

            const nuevoAsesorRef = doc(collection(db, 'Asesor'));
            transaction.set(nuevoAsesorRef, nuevoAsesorData);
            idNuevoAsesor = nuevoAsesorRef.id;
        });

        return idNuevoAsesor; //Retorna el ID para la redirección

    } catch (error) {
        console.error("Error en la transacción al agregar asesor:", error);
        mostrarNotificacion(`Error: No se pudo registrar al asesor.`, 'danger');
        return null;
    }
}

//5. Función para la Editar asesor
async function actualizarAsesor() {
    //1. Validación de IDs
    if (!idAsesorEdit || !idUsuarioEdit) {
        mostrarNotificacion('Error: No se encontró el ID de edición necesario.', 'danger');
        return;
    }

    //2. Capturar valores
    const nombre = asesorNameInput.value.trim();
    // Usa el valor del select, si es director estará fijo al idCrieDirector
    const idCrie = crieAsociadoSelect.value;
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value;

    if (!nombre || !usuario || !idCrie) {
        mostrarNotificacion('El nombre, usuario y CRIE son obligatorios.', 'warning');
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            
            //Caso A: Actualizar el documento en la colección Asesor
            const asesorRef = doc(db, 'Asesor', idAsesorEdit);
            
            //Actualizamos nombre e idCrie
            transaction.update(asesorRef, {
                nombre: nombre,
                idCrie: idCrie
            });

            //Caso B: Preparar la actualización del documento Usuario
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const updatesUsuario = {
                usuario: usuario
            };

            if (contrasena && contrasena.length > 0) {
                
                updatesUsuario.contrasena = contrasena;
            }

            //Actualizamos el documento Usuario
            transaction.update(userRef, updatesUsuario);
        });

    } catch (error) {
        console.error("Error en la transacción al actualizar asesor:", error);
        mostrarNotificacion(`Error: No se pudo actualizar al asesor.`, 'danger');
    }
}
//----------Generación automática de credenciales-------------

//1. Función para generar las iniciales
function generarIniciales(nombreCompleto) {
    if (!nombreCompleto) return "";
    
    const palabras = nombreCompleto.trim().split(/\s+/);
    const iniciales = palabras.map(palabra => palabra.charAt(0).toUpperCase()).join('');
    
    return iniciales;
}

//2. La clave autonumérica 
async function generarUsuarioUnicoAsesor(iniciales) {
    const asesorCollectionRef = collection(db, 'Asesor'); //Contar Asesores
    
    try {
        //1. Obtener el número base de la colección Asesor.
        const snapshot = await getDocs(asesorCollectionRef);
        const count = snapshot.size; 
        
        let numeroBase = count;

        for (let intento = 1; intento <= MAX_INTENTOS_UNICIDAD; intento++) {
            
            const siguienteNumero = numeroBase + intento;
            const numeroFormateado = String(siguienteNumero).padStart(3, '0');
            
            //Formato de usuario: [INICIALES][PREFIJO][NUMERO]
            const usuarioPropuesto = `${iniciales}${PREFIJO_ASESOR}${numeroFormateado}`; 
            
            //2. Validar Unicidad Asíncrona en la colección Usuario
            const esUnico = await validarUnicidadUsuario(usuarioPropuesto, null); 
            
            if (esUnico) {
                
                return usuarioPropuesto;
            }
            
            console.warn(`Usuario propuesto "${usuarioPropuesto}" ya existe. Intentando +1...`);
        }
        
        //3. Fallo: Máximo de intentos alcanzado.
        console.error(`Fallo al generar un usuario único después de ${MAX_INTENTOS_UNICIDAD} intentos.`);
        return null;

    } catch (error) {
        console.error("Error al contar/validar asesores para clave autonumérica:", error);
        mostrarNotificacion("Error al obtener el contador de la base de datos.", 'danger');
        return null; 
    }
}

//3. Función para generar ahora sí las credenciales
async function generarCredenciales(debeActualizarUsuario = true) {
    const nombre = asesorNameInput.value.trim();

    if (!nombre) {
        mostrarNotificacion("Por favor, ingrese el nombre del asesor primero.", 'warning');
        asesorNameInput.focus();
        return;
    }
    
    //Deshabilitar botones para evitar clics múltiples
    if (btnGenerateUser) btnGenerateUser.disabled = true;
    if (btnGeneratePass) btnGeneratePass.disabled = true;

    const iniciales = generarIniciales(nombre); 
    
    //Caso 1: Generar un usuario unico con reintento
    const usuarioCalculado = await generarUsuarioUnicoAsesor(iniciales);
    // ---------------------------------------------------------------------------------

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

    //2. Lógica para el campo de Usuario (userNameInput)
    if (debeActualizarUsuario) {
        userNameInput.value = usuarioCalculado;
        mostrarFeedback(userNameInput, true); //Marcar como válido
        usuarioBaseParaContrasena = usuarioCalculado;
    } else {
        const usuarioExistente = userNameInput.value.trim();
        
        //Si no se actualiza el usuario, 
        // usamos el que ya está en el campo o el calculado.
        usuarioBaseParaContrasena = usuarioExistente || usuarioCalculado;
        
        if (!usuarioExistente) {
             userNameInput.value = usuarioCalculado;
             mostrarFeedback(userNameInput, true);
        }
    }

    
    //3. Generar y Rellenar Contraseña
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

//---------Funciones de validación-----

//1. Limpiar el feedback (Reutilizada)
function limpiarFeedback() {
    [asesorNameInput, crieAsociadoSelect, userNameInput, passwordInput, confirmPasswordInput].forEach(input => {
        
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

//2. Validar usuario único (Reutilizada)
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

async function validarStatusFinalCrie(idCrie) {
    if (!idCrie) return false;

    try {
        const crieRef = doc(db, 'Crie', idCrie);
        const crieSnap = await getDoc(crieRef);

        if (!crieSnap.exists() || crieSnap.data().status !== 1) {
            mostrarFeedback(crieAsociadoSelect, false, 'El CRIE seleccionado ya no está activo o fue eliminado. Por favor, elija otro.');
            return false;
        }
        
        mostrarFeedback(crieAsociadoSelect, true);
        return true;
        
    } catch (error) {
        console.error("Error al verificar CRIE:", error);
        mostrarFeedback(crieAsociadoSelect, false, 'Error de conexión al verificar el CRIE.');
        return false;
    }
}

//3. Función para mostrar el Feedback en los divs correspondientes (Reutilizada)
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


//4. Función para validar todo (Adaptada para Asesor con nuevas reglas)
async function validarTodoAlSubmit(modoEdicion) {
    let esValido = true;
    
    //1. Limpiamos todos los estados de validación anteriores
    limpiarFeedback(); 

    const nombre = asesorNameInput.value.trim();
    const idCrie = crieAsociadoSelect.value;
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value;
    const confirmContrasena = confirmPasswordInput.value;
    
    //Reglas de Validación
    const nombreRegex = /^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/; // Solo letras, espacios y acentos
    const usuarioPassRegex = /^\S+$/; // No debe tener espacios (para usuario y contraseña)

    //Validaciones sincronas:
    
    //1. Validación de Nombre
    if (!nombre) {
        mostrarFeedback(asesorNameInput, false, 'El nombre no puede estar vacío.');
        esValido = false;
    } else if (!nombreRegex.test(nombre)) {
        mostrarFeedback(asesorNameInput, false, 'El nombre solo acepta letras, espacios y acentos.');
        esValido = false;
    } else {
        mostrarFeedback(asesorNameInput, true); 
    }

    //2. Validación de CRIE
    if (!idCrie) {
        mostrarFeedback(crieAsociadoSelect, false, 'Selecciona un CRIE.');
        esValido = false;
    } else {
        mostrarFeedback(crieAsociadoSelect, true);
    }
    
    //3. Validación de Usuario (Requisito: No vacío y sin espacios)
    if (!usuario) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede estar vacío.');
        esValido = false;
    } else if (!usuarioPassRegex.test(usuario)) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede contener espacios.');
        esValido = false;
    } else {
       
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
           
        }

        if (!confirmContrasena) {
             mostrarFeedback(confirmPasswordInput, false, 'Debe confirmar la contraseña.');
             passValido = false;
        } else if (contrasena !== confirmContrasena) {
            mostrarFeedback(confirmPasswordInput, false, 'Las contraseñas no coinciden.');
            passValido = false;
        } else {
             
        }
        
        if (!passValido) {
            esValido = false;
        } else {
            //Si pasan la validación síncrona
            mostrarFeedback(passwordInput, true); 
            mostrarFeedback(confirmPasswordInput, true);
        }

    } else {
        //Modo Edición y no se quieren cambiar, se marcan como válidos
        mostrarFeedback(passwordInput, true);
        mostrarFeedback(confirmPasswordInput, true);
    }
    
    //Validación asincrona
    if (esValido && usuario && usuarioPassRegex.test(usuario)) { // Solo si pasó las validaciones síncronas de usuario
        const esUsuarioUnico = await validarUnicidadUsuario(usuario, idUsuarioEdit);
        
        if (!esUsuarioUnico) {
            mostrarFeedback(userNameInput, false, `El usuario "${usuario}" ya existe. Por favor, elija otro.`);
            esValido = false;
        } else {
            mostrarFeedback(userNameInput, true);
        }
    }
    
    
    //Solo se ejecuta si hasta ahora es válido y el CRIE fue seleccionado.
    if (esValido && idCrie) {
        const esCrieActivo = await validarStatusFinalCrie(idCrie);
        if (!esCrieActivo) {
            esValido = false;
        }
        // Nota: la función validarStatusFinalCrie ya maneja el feedback
    }


    
    //Si hay algún error (síncrono o asíncrono), mostrar notificación general
    if (!esValido) {
        mostrarNotificacion("Revise los errores marcados en el formulario.", 'warning');
    }
    
    return esValido;
}


//------------------------------------Funciones para inicializar------------------------------------
//1. Inicia los eventos para los botones de generar y cancelar
function inicializarEventos() {
    //Generadores
    if (btnGenerateUser) {
        btnGenerateUser.addEventListener('click', () => generarCredenciales(true)); 
    }

    if (btnGeneratePass) {
        btnGeneratePass.addEventListener('click', () => generarCredenciales(false)); 
    }

    //Cancelar
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            
            window.location.href = 'gestionAsesores.html'; 
        });
    }
}


//La inicialización general del DOM
document.addEventListener('DOMContentLoaded', async () => {
    
    // 0. Cargar el CRIE del Director si es necesario
    if (esDirector) {
        // Bloquear el select mientras se carga la información
        crieAsociadoSelect.setAttribute('disabled', 'true');
        await obtenerDatosCrieDirector();
        if (!idCrieDirector) {
            mostrarNotificacion("No se pudo cargar su CRIE. No puede gestionar Asesores.", 'danger');
            // Bloquear el formulario completamente si no se pudo obtener el CRIE del Director
            asesorForm.querySelector('fieldset').setAttribute('disabled', 'true');
            btnAce.disabled = true;
            return;
        }
    }


    //1. Inicializar Eventos
    inicializarEventos();

    //2. Ejecutar la carga o la población de CRIE
    if (modoEdicion) {
        
        const camposCarga = [asesorNameInput, crieAsociadoSelect, userNameInput, passwordInput, confirmPasswordInput];
        
        camposCarga.forEach(input => {
            input.setAttribute('disabled', 'true');
            
            if (input.tagName === 'INPUT') {
                input.value = "Cargando...";
            }
        });
        
        //Bloquear botón aceptar
        if (btnAce) {
            btnAce.disabled = true;
            btnAce.textContent = "Cargando...";
        }

        await cargarDatosAsesor(idAsesor);
        
    } else {
        
        await poblarCrieSelect();
        // Si no es Director, el select estaba bloqueado al inicio, ahora se debe desbloquear
        if (!esDirector) {
             crieAsociadoSelect.removeAttribute('disabled');
        }
    }
});