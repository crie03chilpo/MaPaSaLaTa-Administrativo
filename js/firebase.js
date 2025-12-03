//Importa las funciones necesarias desde los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

//Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCbA0g0MNFjw9hcEf9njbczRdl-Qnm6VqY",
    authDomain: "mapasalata-b88bc.firebaseapp.com",
    projectId: "mapasalata-b88bc",
    storageBucket: "mapasalata-b88bc.firebasestorage.app",
    messagingSenderId: "841958406534",
    appId: "1:841958406534:web:acb281084d85aa0b605407"
};

//Inicializa Firebase
const app = initializeApp(firebaseConfig);

//Inicializa Firestore
const db = getFirestore(app);

//Exporta la instancia de la base de datos (db) para que otros archivos la usen
export { db };