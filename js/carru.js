function adjustImageSize(carouselInner, largeScreen) {
    if (carouselInner) {
        // Selecciona todas las etiquetas <img> dentro del carrusel específico
        const images = carouselInner.querySelectorAll('img'); 
        
        // Define los tamaños:
        const largeSize = '65%'; // Tamaño en pantalla grande (ejemplo: 65% en lugar de 75%)
        const baseSize = '75%'; // Tamaño normal (base)
        
        const targetSize = largeScreen ? largeSize : baseSize;

        images.forEach(img => {
            // Modificamos max-width y max-height
            img.style.maxWidth = targetSize;
            img.style.maxHeight = targetSize; // Aunque 'mh-75' ya lo limita, es bueno ser explícito
        });
    }
}


function adjustCarousel() {
    // --- DECLARACIONES ---
    const carouselColumn = document.getElementById('carouselColumn');
    const carouselInner = document.getElementById('carouselInner');
    const carouselColumn2 = document.getElementById('carouselColumn2');
    const carouselInner2 = document.getElementById('carouselInner2');
    const carouselColumn3 = document.getElementById('carouselColumn3');
    const carouselInner3 = document.getElementById('carouselInner3');


    const screenWidth = window.innerWidth;
    const hideBreakpoint = 868;
    const largeScreenBreakpoint = 1400; // Punto donde la pantalla es "grande"

    const isLargeScreen = screenWidth >= largeScreenBreakpoint;

    // --- LÓGICA DE AJUSTE PARA EL CARRUSEL 1 (MAPASALA) ---
    // (Sin cambios significativos en el tamaño de imagen, solo altura)
    if (carouselColumn && carouselInner) {
        // ... Lógica de ocultar/mostrar y altura de C1 (sin cambios) ...
        if (screenWidth < hideBreakpoint) {
            carouselColumn.style.display = 'none';
        } else {
            carouselColumn.style.display = '';
        }

        if (isLargeScreen) {
            carouselInner.style.height = '550px';
            carouselInner.style.lineHeight = '550px';
        } else if (screenWidth >= 768) {
            carouselInner.style.height = '465px';
            carouselInner.style.lineHeight = '465px';
        }
        // Para C1, si también quisieras achicar la imagen grande, llama aquí a adjustImageSize(carouselInner, isLargeScreen);
    }
    
    // --- LÓGICA DE AJUSTE PARA EL CARRUSEL 2 (PREVIO) ---
    if (carouselColumn2 && carouselInner2) {

        const baseHeight2 = '420px';
        const largeHeight2 = '470px';

        // LÓGICA 2.1: OCULTAR/MOSTRAR (C2)
        if (screenWidth < hideBreakpoint) {
            carouselColumn2.style.display = 'none';
        } else {
            carouselColumn2.style.display = '';
        }

        // LÓGICA 2.2: CAMBIO DE ALTURA (C2)
        if (isLargeScreen) {
            carouselInner2.style.height = largeHeight2;
            carouselInner2.style.lineHeight = largeHeight2;
        } else if (screenWidth >= 768) {
            carouselInner2.style.height = baseHeight2;
            carouselInner2.style.lineHeight = baseHeight2;
        }

        // LÓGICA 2.3: CAMBIO DE TAMAÑO DE IMAGEN (NUEVO)
        adjustImageSize(carouselInner2, isLargeScreen);
    }
    
    // --- LÓGICA DE AJUSTE PARA EL CARRUSEL 3 (PLANTILLAS) ---
    if (carouselColumn3 && carouselInner3) {

        const baseHeight3 = '420px';
        const largeHeight3 = '470px';

        // LÓGICA 3.1: OCULTAR/MOSTRAR (C3)
        if (screenWidth < hideBreakpoint) {
            carouselColumn3.style.display = 'none';
        } else {
            carouselColumn3.style.display = '';
        }

        // LÓGICA 3.2: CAMBIO DE ALTURA (C3)
        if (isLargeScreen) {
            carouselInner3.style.height = largeHeight3;
            carouselInner3.style.lineHeight = largeHeight3;
        } else if (screenWidth >= 768) {
            carouselInner3.style.height = baseHeight3;
            carouselInner3.style.lineHeight = baseHeight3;
        }

        // LÓGICA 3.3: CAMBIO DE TAMAÑO DE IMAGEN (NUEVO)
        adjustImageSize(carouselInner3, isLargeScreen);
    }
    
}

// Ejecutar la función en la carga y al redimensionar
window.onload = adjustCarousel;
window.onresize = adjustCarousel;