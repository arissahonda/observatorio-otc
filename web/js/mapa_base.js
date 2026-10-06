/**
 * Módulo: mapa_base.js
 * Descrição: Centraliza a inicialização do mapa Leaflet com servidor OpenStreetMap (OSM).
 */

const API_URL = "https://api-observatorio-otpc.onrender.com/api/v1";

/**
 * Cria e inicializa um mapa Leaflet focado em ultra-performance de carregamento.
 * @param {string} idElementoHTML - ID do contêiner HTML onde o mapa será desenhado.
 * @returns {L.Map|null} Instância do mapa Leaflet ou null se o elemento não existir.
 */
function inicializarMapaBase(idElementoHTML) {
    // 1. Camada Vetorial Padrão OpenStreetMap (OSM)
    const camadaOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        
        // --- OTIMIZAÇÕES DE DESEMPENHO E REDE ---
        updateWhenIdle: true,     // Descarrega novos blocos apenas quando o utilizador parar de arrastar
        updateWhenZooming: false,  // Evita requisições no meio do movimento de zoom
        keepBuffer: 2              // Mantém poucos blocos na memória fora da tela para poupar RAM
    });

    // 2. Camada de Imagem de Satélite Esri World Imagery
    const camadaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 2
    });

    // 3. Validação do contêiner HTML
    const containerMapa = document.getElementById(idElementoHTML);
    if (!containerMapa) {
        console.warn(`Aviso: O elemento HTML com ID '${idElementoHTML}' não foi encontrado.`);
        return null;
    }

    // 4. Instanciação do mapa com aceleração gráfica ativada
    const mapa = L.map(idElementoHTML, { 
        preferCanvas: true,        // Renderiza os itinerários via Canvas (muito mais leve)
        zoomControl: true,
        maxZoom: 19,
        minZoom: 9,
        layers: [camadaOSM],
        fadeAnimation: false,      // Desativa animação de transparência ao trocar de zoom
        zoomAnimation: true,
        markerZoomAnimation: false
    }).setView([-15.793889, -47.882778], 11);

    mapa.dragging.disable();

    // 5. Painel de escolha de camadas no canto superior direito
    const mapasBase = {
        "🗺️ Mapa Vetorial (OSM)": camadaOSM,
        "🛰️ Imagem de Satélite": camadaSatelite
    };
    L.control.layers(mapasBase, null, { position: 'topright' }).addTo(mapa);

    return mapa;
}