document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. Definición de Carruseles y sus Subtítulos ---
    const carousels = [
        { id: 'appCarousel', captionId: 'mainCaption' },    // El Carrusel 1 original
        { id: 'appCarousel-previo', captionId: 'captionCarousel2' }, // El Carrusel 2
        { id: 'appCarousel-plantilla', captionId: 'captionCarousel3' }  // El Carrusel 3
    ];


    // --- 2. Función genérica para actualizar el subtítulo ---
    function updateCaption(targetElement, captionElement) {
        const newCaption = targetElement.getAttribute('data-caption');
        
        if (newCaption) {
            captionElement.textContent = newCaption;
        } else {
            captionElement.textContent = "Descripción no disponible";
        }
    }


    // --- 3. Inicialización y Escucha de Eventos para CADA Carrusel ---
    carousels.forEach(carouselConfig => {
        const carouselElement = document.getElementById(carouselConfig.id);
        const captionElement = document.getElementById(carouselConfig.captionId);

        // Verificar que ambos elementos existan antes de continuar
        if (!carouselElement || !captionElement) {
            console.warn(`Advertencia: No se pudo inicializar ${carouselConfig.id} o ${carouselConfig.captionId}`);
            return; 
        }

        // 3.1. Establecer el subtítulo inicial (del slide activo al cargar)
        const activeSlide = carouselElement.querySelector('.carousel-item.active');
        if (activeSlide) {
            updateCaption(activeSlide, captionElement);
        }

        // 3.2. Escuchar el evento de cambio de slide (slide.bs.carousel)
        carouselElement.addEventListener('slide.bs.carousel', function (event) {
            // event.relatedTarget es el nuevo elemento DOM (el nuevo slide)
            updateCaption(event.relatedTarget, captionElement);
        });
    });

});