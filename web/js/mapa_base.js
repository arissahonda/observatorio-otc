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

// =========================================================================
// GEOMETRIA ESPACIAL PRECISA (ALGORITMO DE LIANG-BARSKY)
// =========================================================================

/**
 * Algoritmo de Liang-Barsky: testa se o segmento de reta (x1,y1)->(x2,y2) 
 * interseca a caixa delimitadora [xmin, xmax, ymin, ymax].
 */
function segmentoIntersecaBox(x1, y1, x2, y2, xmin, xmax, ymin, ymax) {
    // Pré-checagem rápida de caixa envolvente (Bounding Box)
    if (Math.max(x1, x2) < xmin || Math.min(x1, x2) > xmax ||
        Math.max(y1, y2) < ymin || Math.min(y1, y2) > ymax) {
        return false;
    }

    let dx = x2 - x1;
    let dy = y2 - y1;

    let p = [-dx, dx, -dy, dy];
    let q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];

    let u1 = 0;
    let u2 = 1;

    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return false; // Linha paralela fora da caixa
        } else {
            let t = q[i] / p[i];
            if (p[i] < 0) {
                if (t > u1) u1 = t;
            } else {
                if (t < u2) u2 = t;
            }
        }
    }

    return u1 <= u2;
}

/**
 * Extrai recursivamente todas as linhas simples (arrays de pontos [lng, lat])
 * de qualquer estrutura de geometria GeoJSON.
 */
function extrairLinhasDaGeometria(geom) {
    if (!geom || !geom.coordinates) return [];
    let linhas = [];

    function processarCoordenadas(coords) {
        if (!Array.isArray(coords) || coords.length === 0) return;

        // Verifica se é uma lista direta de pontos [[lng, lat], [lng, lat], ...]
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            linhas.push(coords);
            return;
        }

        // Se for uma estrutura aninhada (MultiLineString), aprofunda a busca
        for (let sub of coords) {
            processarCoordenadas(sub);
        }
    }

    processarCoordenadas(geom.coordinates);
    return linhas;
}

/**
 * Testador espacial: verifica se a linha cruza a área com sensibilidade total.
 */
function linhaIntersecaRetangulo(featureGeometry, bounds) {
    if (!featureGeometry) return false;

    const xmin = Math.min(bounds.getWest(), bounds.getEast());
    const xmax = Math.max(bounds.getWest(), bounds.getEast());
    const ymin = Math.min(bounds.getSouth(), bounds.getNorth());
    const ymax = Math.max(bounds.getSouth(), bounds.getNorth());

    const linhas = extrairLinhasDaGeometria(featureGeometry);

    for (let line of linhas) {
        for (let i = 0; i < line.length - 1; i++) {
            const lng1 = line[i][0];
            const lat1 = line[i][1];
            const lng2 = line[i + 1][0];
            const lat2 = line[i + 1][1];

            if (segmentoIntersecaBox(lng1, lat1, lng2, lat2, xmin, xmax, ymin, ymax)) {
                return true;
            }
        }
    }
    return false;
}

// =========================================================================
// EVENTOS DE MOUSE E INTERAÇÃO
// =========================================================================

function ativarControlesMouseMapa(mapaObj, callbackSelecaoArea, callbackLimparArea) {
    if (!mapaObj) return;

    if (mapaObj.scrollWheelZoom) {
        mapaObj.scrollWheelZoom.enable();
    }

    const container = mapaObj.getContainer();

    container.addEventListener('contextmenu', (e) => e.preventDefault());
    container.addEventListener('auxclick', (e) => {
        if (e.button === 1) e.preventDefault();
    });

    let desenhandoRetangulo = false;
    let arrastandoMapa = false;
    let pontoInicialLatLng = null;
    let pontoInicialPixel = null;
    let retanguloSelecao = null;

    container.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            desenhandoRetangulo = true;
            pontoInicialLatLng = mapaObj.mouseEventToLatLng(e);

            if (retanguloSelecao) {
                mapaObj.removeLayer(retanguloSelecao);
                retanguloSelecao = null;
            }
        } else if (e.button === 1 || e.button === 2) {
            e.preventDefault();
            arrastandoMapa = true;
            pontoInicialPixel = { x: e.clientX, y: e.clientY };
            container.style.cursor = 'grabbing';
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (desenhandoRetangulo && pontoInicialLatLng) {
            const pontoAtualLatLng = mapaObj.mouseEventToLatLng(e);
            const bounds = L.latLngBounds(pontoInicialLatLng, pontoAtualLatLng);

            if (!retanguloSelecao) {
                retanguloSelecao = L.rectangle(bounds, {
                    color: '#dc3545',
                    weight: 2,
                    dashArray: '4, 4',
                    fillColor: '#dc3545',
                    fillOpacity: 0.15
                }).addTo(mapaObj);
            } else {
                retanguloSelecao.setBounds(bounds);
            }
        } else if (arrastandoMapa && pontoInicialPixel) {
            const dx = e.clientX - pontoInicialPixel.x;
            const dy = e.clientY - pontoInicialPixel.y;
            mapaObj.panBy([-dx, -dy], { animate: false });
            pontoInicialPixel = { x: e.clientX, y: e.clientY };
        }
    });

    // Restaura o cursor padrão e finaliza o arrasto de forma limpa
    window.addEventListener('mouseup', () => {
        if (desenhandoRetangulo) {
            desenhandoRetangulo = false;

            if (retanguloSelecao) {
                const bounds = retanguloSelecao.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();

                if (sw.distanceTo(ne) > 2 && typeof callbackSelecaoArea === 'function') {
                    callbackSelecaoArea(bounds);
                } else {
                    mapaObj.removeLayer(retanguloSelecao);
                    retanguloSelecao = null;
                    if (typeof callbackLimparArea === 'function') callbackLimparArea();
                }
            } else {
                if (typeof callbackLimparArea === 'function') callbackLimparArea();
            }
        }

        if (arrastandoMapa) {
            arrastandoMapa = false;
            pontoInicialPixel = null;
            // Restaura o cursor apenas no contêiner do mapa, sem afetar o resto da página
            container.style.cursor = '';
        }
    });
}