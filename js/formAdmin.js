//Importa la conexión a Firebase
import { db } from "./firebase.js";
//Importa las funciones de Firestore necesarias para el form
import { collection, addDoc, doc, getDoc, updateDoc, runTransaction, getDocs, query, where }  from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
//Importa la función de notificación
import { mostrarNotificacion } from "./toastFlotante.js"; 

//------------------Variables e incialización------------------
//Campos del formulario
const adminNameInput = document.getElementById('adminName');
const userNameInput = document.getElementById('userName');
const passwordInput = document.getElementById('password');
//Confirmación
const confirmPasswordInput = document.getElementById('confirmPassword'); 

//Botones generar
const btnGenerateUser = document.querySelector('#userName + .btn-generate');
const btnGeneratePass = document.querySelector('#password + .btn-generate');

//Boton guardar
const btnAce = document.getElementById('btnAceptar');


//-------------Variables globales--------------------
//Almacenar IDs para el modo edición
let idAdminEdit = null;
let idUsuarioEdit = null;

//-------------Constantes globales------------------

const urlParams = new URLSearchParams(window.location.search);
const idAdmin = urlParams.get('idAdmin');
const modoEdicion = !!idAdmin; // true si idAdmin existe, false si es nulo

const adminForm = document.getElementById('adminForm');
const formTitle = document.querySelector('.custom-form-card h4');



//Define el margen que debe tener el input-group cuando NO hay error
const MARGIN_BOTTOM_VALID = '30px'; 
//Define el margen cuando hay error (para que el feedback quepa)
const MARGIN_BOTTOM_INVALID = '0px'; 

//Variable global
let isProcessing = false;

const idAdminURL = urlParams.get('idAdmin');

//Recursos extra
function toggleBotonAceptar(deshabilitar) {
    if (deshabilitar) {
        btnAce.disabled = true;
        btnAce.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;
    } else {
        btnAce.disabled = false;
        // Restaurar el texto original (Guardar o Actualizar)
        btnAce.textContent = modoEdicion ? 'Actualizar' : 'Guardar'; 
    }
}

//---------------------Funciones, métodos y toda los eventos o lógica---------------------

//1. Revisa si es modo edición para cargar los datos
if (modoEdicion) {
    idAdminEdit = idAdminURL;
    formTitle.textContent = "Editando Administrador";
    btnAce.textContent = "Actualizar"
    cargarDatosAdministrador(idAdminEdit);
} else {
    formTitle.textContent = "Agregando Administrador";
}


//2. Cargar datos si es edición
async function cargarDatosAdministrador(idAdministrador) {
    if (!idAdministrador) return;

    const camposCarga = [adminNameInput, userNameInput, passwordInput, confirmPasswordInput];
    camposCarga.forEach(input => {
        input.value = "Cargando...";
    });


    try {
        //Paso 1: Obtener el Administrador
        const adminRef = doc(db, 'Administrador', idAdministrador);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
            mostrarNotificacion("Error: Administrador no encontrado.", 'danger');
            return;
        }

        const adminData = adminSnap.data();
        idUsuarioEdit = adminData.idUsuario;

        //Rellenar campo nombre del Administrador
        adminNameInput.value = adminData.nombre || '';

        //Paso 2: Obtener el Usuario relacionado
        if (idUsuarioEdit) {
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                //Rellenar campo 'Usuario' (username)
                userNameInput.value = userData.usuario || '';
                
                passwordInput.value = ''; 
                confirmPasswordInput.value = '';
                
                
                passwordInput.removeAttribute('disabled');
                userNameInput.removeAttribute('disabled');
            }
        }
        
    } catch (error) {
        console.error("Error al cargar datos para edición:", error);
        mostrarNotificacion("Error al cargar los datos del administrador.", 'danger');
    }
}


//3. Logica del envío del formulario para saber si es guardado o edición
//así como la revisión de validaciones
if (adminForm) {
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
        
        //Paso 1: verificar estado y bloquear clics adicionales
        if (isProcessing) {
            return; 
        }
        isProcessing = true;
        
        //Paso 2: Bloquear visualmente el botón
    toggleBotonAceptar(true); 
    
    //1. Ejecutar las validaciones
    const esFormularioValido = await validarTodoAlSubmit(modoEdicion);
    
    if (!esFormularioValido) {
      //Desbloquear si la validación falla
      toggleBotonAceptar(false);
            isProcessing = false;
      return;
    }
    
    //2. Ejecución Final (Solo si todas las validaciones pasaron)
    try { 
      if (modoEdicion) {
        await actualizarAdministrador();
      } else {
        await registrarNuevoAdministrador();
      }
    } catch (error) {
      console.error("Error fatal en el envío:", error);
      //Desbloquear botón en caso de error fatal
      toggleBotonAceptar(false);
            isProcessing = false;
      mostrarNotificacion("Ocurrió un error inesperado al procesar la solicitud.", 'danger');
    }
        
  });
}

//4. Función para el guardado
async function registrarNuevoAdministrador() {
    //Capturar valores del formulario
    const nombre = document.getElementById('adminName').value.trim();
    const usuario = document.getElementById('userName').value.trim();
    const contrasena = document.getElementById('password').value; // No se hace trim a la contraseña
    
    //Validación simple de campos obligatorios
    if (!nombre || !usuario || !contrasena) {
        mostrarNotificacion('Por favor, complete todos los campos requeridos.', 'warning');
        return;
    }
    

    try {
 
        await runTransaction(db, async (transaction) => {
            
            //Caso A: Crear un nuevo documento en la colección Usuario

            const nuevoUsuarioData = {
                usuario: usuario,
                contrasena: contrasena,
                idRol: "1",
                status: 1 
            };

            //Nueva referencia de documento con un ID automático
            const nuevoUsuarioRef = doc(collection(db, 'Usuario'));
            
            //Nuevo usuario dentro de la transacción
            transaction.set(nuevoUsuarioRef, nuevoUsuarioData);
            
            const idNuevoUsuario = nuevoUsuarioRef.id;

            //Caso B: Crear el documento en la colección Administrador
            const nuevoAdminData = {
                nombre: nombre,
                idUsuario: idNuevoUsuario
            };

            //Creamos el nuevo administrador
            const nuevoAdminRef = doc(collection(db, 'Administrador'));
            transaction.set(nuevoAdminRef, nuevoAdminData);
        });


        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `Administrador ${nombre} agregado exitosamente.`,
            tipo: 'success'
        }));
        
        //Limpiar formulario (opcional)
        adminForm.reset(); 
        
        //Redirigir a la página de listado
        window.location.href = 'gestionAdministradores.html';

    } catch (error) {
        //Manejo de errores de la transacción
        console.error("Error en la transacción al agregar administrador:", error);
        mostrarNotificacion(`Error: No se pudo registrar al administrador.`, 'danger');
    }
}

//5. Función para la EDICION ADMINISTRADOR:
async function actualizarAdministrador() {
    //1. Validación de IDs
    if (!idAdminEdit || !idUsuarioEdit) {
        mostrarNotificacion('Error: No se encontró el ID de edición necesario.', 'danger');
        return;
    }

    //2. Capturar valores
    const nombre = adminNameInput.value.trim();
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value; // Sin trim para permitir espacios si son intencionales

    if (!nombre || !usuario) {
        mostrarNotificacion('El nombre y el usuario no pueden estar vacíos.', 'warning');
        return;
    }

    try {
        //Usamos una transacción para asegurar la atomicidad de las operaciones
        await runTransaction(db, async (transaction) => {
            
            //Caso A: Actualizar el documento en la colección Administrador
            const adminRef = doc(db, 'Administrador', idAdminEdit);
            
            //Solo actualizamos el nombre
            transaction.update(adminRef, {
                nombre: nombre
            });

            //Caso B: Preparar la actualización del documento Usuario
            const userRef = doc(db, 'Usuario', idUsuarioEdit);
            const updatesUsuario = {
                usuario: usuario //Siempre actualizamos el nombre de usuario
            };

            
            if (contrasena && contrasena.length > 0) {
                
                updatesUsuario.contrasena = contrasena;
            }

            //Actualizamos el documento Usuario
            transaction.update(userRef, updatesUsuario);
        });

        //3. Éxito
        sessionStorage.setItem('notificacionPendiente', JSON.stringify({
            mensaje: `Administrador ${nombre} actualizado exitosamente.`,
            tipo: 'success'
        }));
        
        //4. Redirigir
        window.location.href = 'gestionAdministradores.html';

    } catch (error) {
        console.error("Error en la transacción al actualizar administrador:", error);
        mostrarNotificacion(`Error: No se pudo actualizar al administrador.`, 'danger');
    }
}


//---------Funciones para la generación automática de credenciales-------------------

//1. Función para generar las iniciales
function generarIniciales(nombreCompleto) {
    if (!nombreCompleto) return "";
    
    //Elimina espacios extra y divide el nombre en palabras
    const palabras = nombreCompleto.trim().split(/\s+/);
    
    //Toma la primera letra de cada palabra y las une
    const iniciales = palabras.map(palabra => palabra.charAt(0).toUpperCase()).join('');
    
    return iniciales;
}

//2. La clave autonumérica
const MAX_INTENTOS_UNICIDAD = 10;


async function generarClaveAutonumericaUnica(iniciales) {
    const adminCollectionRef = collection(db, 'Administrador');
    
    try {
        //1. Obtener el número base de la colección Administrador.
        const snapshot = await getDocs(adminCollectionRef);
        const count = snapshot.size;
        
        let numeroBase = count;

        for (let intento = 1; intento <= MAX_INTENTOS_UNICIDAD; intento++) {
            
            const siguienteNumero = numeroBase + intento;
            const numeroFormateado = String(siguienteNumero).padStart(3, '0');
            
            //Formato de usuario: [INICIALES][PREFIJO][NUMERO]
            const usuarioPropuesto = `${iniciales}A${numeroFormateado}`; 
            
            //2. Validar Unicidad Asíncrona en la colección 'Usuario'.
            
            const esUnico = await validarUnicidadUsuario(usuarioPropuesto, null);
            
            if (esUnico) {
                //Éxito: una clave única.
                return usuarioPropuesto;
            }
            
            //Si no es único, el bucle continúa al siguiente intento (siguienteNumero).
            console.warn(`Usuario propuesto "${usuarioPropuesto}" ya existe. Intentando +1...`);
        }
        
        //3. Fallo: Máximo de intentos alcanzado.
        console.error(`Fallo al generar un usuario único después de ${MAX_INTENTOS_UNICIDAD} intentos.`);
        return null;

    } catch (error) {
        console.error("Error al contar/validar administradores para clave autonumérica:", error);
        mostrarNotificacion("Error al obtener el contador de la base de datos.", 'danger');
        return null; 
    }
}



//3. Función para generar ahora sí las credenciales con las funciones 1. y 2. anteriores
async function generarCredenciales(debeActualizarUsuario = true) {
    const nombre = adminNameInput.value.trim();

    if (!nombre) {
        mostrarNotificacion("Por favor, ingrese el nombre del administrador primero.", 'warning');
        adminNameInput.focus();
        return;
    }
    
    //Deshabilitar botones para evitar clics múltiples
    btnGenerateUser.disabled = true;
    if (btnGeneratePass) btnGeneratePass.disabled = true;

    const iniciales = generarIniciales(nombre);
    
    //Paso 1: Generar un usuario único con reintento
    const usuarioCalculado = await generarClaveAutonumericaUnica(iniciales);
    // -----------------------------------------------------

    if (usuarioCalculado === null) {
        //Manejo del error si no se encontró un usuario único después de los reintentos.
        mostrarNotificacion(`Error al generar usuario de forma automática, cree uno manualmente.`, 'danger');
        userNameInput.value = '';
        userNameInput.classList.add('is-invalid');
        btnGenerateUser.disabled = false;
        if (btnGeneratePass) btnGeneratePass.disabled = false;
        return;
    }

    let usuarioBaseParaContrasena = '';

    //2. Lógica para el campo de Usuario (userNameInput)
    if (debeActualizarUsuario) {
        //botón de generar Usuario o se está generando por defecto
        userNameInput.value = usuarioCalculado;
        mostrarFeedback(userNameInput, true); // Marcar como válido
        usuarioBaseParaContrasena = usuarioCalculado;
    } else {
        //botón de generar Contraseña
        const usuarioExistente = userNameInput.value.trim();
        
        
        usuarioBaseParaContrasena = usuarioExistente || usuarioCalculado;
        
        //Si el campo estaba vacío, lo rellenamos
        if (!usuarioExistente) {
             userNameInput.value = usuarioCalculado;
             mostrarFeedback(userNameInput, true); 
        }
    }

    
    //3. Generar y Rellenar Contraseña
    if (usuarioBaseParaContrasena) {
        const contrasenaGenerada = `${usuarioBaseParaContrasena}P`;
        
        //Rellenar campos de contraseña
        passwordInput.value = contrasenaGenerada;
        confirmPasswordInput.value = contrasenaGenerada; 
        
        //Marcar contraseñas como válidas.
        mostrarFeedback(passwordInput, true);
        mostrarFeedback(confirmPasswordInput, true);
        
        mostrarNotificacion("Usuario y contraseña generados con éxito, guarde la contraseña por favor.", 'success');

    } else {
         //Este caso solo ocurriría si el nombre se borra entre la validación inicial y este punto.
         mostrarNotificacion("No se pudo generar la contraseña: la base de usuario está vacía.", 'danger');
    }

    //Habilitar de nuevo
    btnGenerateUser.disabled = false;
    if (btnGeneratePass) btnGeneratePass.disabled = false;
}

//---------Funciones para las validaciones del formulario-------------------

//1. Limpiar el feedback de las cosas malas que tuviera
function limpiarFeedback() {
    [adminNameInput, userNameInput, passwordInput, confirmPasswordInput].forEach(input => {
        
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

//2. Validador de contraseñas coincidentes
function validarCoincidenciaContrasenas() {
    const contrasena = passwordInput.value;
    const confirmContrasena = confirmPasswordInput.value;
    
    //Verificación de campos vacíos. Si están vacíos en modo edición, se ignora aquí.
    if (!contrasena && !confirmContrasena && modoEdicion) {
         return true;
    }
    
    if (contrasena !== confirmContrasena) {
        mostrarFeedback(confirmPasswordInput, false, 'Las contraseñas no coinciden.');
        return false;
    } else {
        mostrarFeedback(confirmPasswordInput, true);
        return true;
    }
}

//3. Validar usuario único
async function validarUnicidadUsuario(usuario, idUsuarioActual = null) {
    if (!usuario) return false;

    try {
        const usersRef = collection(db, 'Usuario');
        
        //la consulta: buscar documentos donde el campo usuario sea igual al valor
        let q = query(usersRef, where('usuario', '==', usuario));
        
        const snapshot = await getDocs(q);

        
        if (snapshot.size > 0) {
            
            if (idUsuarioActual && snapshot.size === 1 && snapshot.docs[0].id === idUsuarioActual) {
                return true; 
            }
            
            return false; 
        }

        //Si no se encontró ningún documento, es único.
        return true;

    } catch (error) {
        console.error("Error al validar unicidad del usuario:", error);
        mostrarNotificacion("Error de conexión al validar usuario.", 'danger');
        
        return false; 
    }
}

//4. Función para mostrar el Feedback en los divs correspondientes
//Para mostrar, esta no tiene los mensajes
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


//5. Función ahora sí para validar todo y acá ahora sí están los mensajes que se van a mostrar en el
//feedback
async function validarTodoAlSubmit(modoEdicion) {
    let esValido = true;
    
    //1. Limpiar todos los estados de validación anteriores
    limpiarFeedback(); 

    const nombre = adminNameInput.value.trim();
    const usuario = userNameInput.value.trim();
    const contrasena = passwordInput.value;
    const confirmContrasena = confirmPasswordInput.value;
    const nombreRegex = /^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/;

    const usuarioPassRegex = /^\S+$/;
    
    //1. Validación de Nombre (No vacío y Formato)
    if (!nombre) {
        mostrarFeedback(adminNameInput, false, 'El nombre no puede estar vacío.');
        esValido = false;
    } else if (!nombreRegex.test(nombre)) {
        mostrarFeedback(adminNameInput, false, 'El nombre solo acepta letras, espacios y acentos.');
        esValido = false;
    } else {
        mostrarFeedback(adminNameInput, true); 
    }
    
    //2. Validación de Usuario (No vacío)
if (!usuario) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede estar vacío.');
        esValido = false;
    } else if (!usuarioPassRegex.test(usuario)) {
        mostrarFeedback(userNameInput, false, 'El nombre de usuario no puede contener espacios.');
        esValido = false;
    } else {
        mostrarFeedback(userNameInput, true); 
    }

    //3. Validación de Contraseñas
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
        mostrarFeedback(passwordInput, true);
        mostrarFeedback(confirmPasswordInput, true);
    }

    if (usuario) {
        const esUsuarioUnico = await validarUnicidadUsuario(usuario, idUsuarioEdit);
        
        if (!esUsuarioUnico) {
            //Si no es único, marcamos el campo y establecemos esValido a false.
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
//1. Inicia los eventos para los botones de generar
function inicializarGeneradores() {
    if (btnGenerateUser) {
        btnGenerateUser.addEventListener('click', () => generarCredenciales(true)); 
    }

    if (btnGeneratePass) {
        btnGeneratePass.addEventListener('click', () => generarCredenciales(false)); 
    }
}

//La inicialización general del DOM
document.addEventListener('DOMContentLoaded', () => {
    inicializarGeneradores();
    
    //Si estamos en modo edición, cargar los datos
    if (modoEdicion) {
        cargarDatosAdministrador(idAdminURL);
    }
});