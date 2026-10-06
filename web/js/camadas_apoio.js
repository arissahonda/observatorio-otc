/**
 * Módulo: camada.js
 * Descrição: Carrega e estiliza as Camadas de Apoio Espaciais (Regiões Administrativas,
 *            Pontos de Parada destacados e Terminais com ícones dinâmicos).
 */

const canvasRenderer = L.canvas({ padding: 0.5 });
let camadasEstaticas = {};

async function alternarCamadaEstatica(nomeTabela, ativada) {
    if (!ativada) {
        if (camadasEstaticas[nomeTabela]) {
            mapa1.removeLayer(camadasEstaticas[nomeTabela]);
        }
        return;
    }

    if (!camadasEstaticas[nomeTabela]) {
        try {
            const resp = await fetch(`${API_URL}/mapa/camada-estatica/${nomeTabela}`);
            const geojson = await resp.json();

            // 1. Regiões Administrativas (Polígonos Roxo com Tooltip)
            if (nomeTabela === 'tb_regioes_administrativas') {
                camadasEstaticas[nomeTabela] = L.geoJSON(geojson, {
                    style: { color: '#6a1b9a', weight: 2, fillColor: '#8e24aa', fillOpacity: 0.15 },
                    onEachFeature: (feature, layer) => {
                        const p = feature.properties || {};
                        const nomeRA = p.ra_nome || p.nm_ra || p.NOME || p.nome || p.RA || 'Região Administrativa';
                        layer.bindTooltip(`<b>🏛️ RA: ${nomeRA}</b>`, { sticky: true });
                    }
                });
            } 
            // 2. Pontos de Parada Destacados (Círculos Laranjas com Destaque)
            else if (nomeTabela === 'tb_ponto_parada_v2025') {
                camadasEstaticas[nomeTabela] = L.geoJSON(geojson, {
                    renderer: canvasRenderer,
                    pointToLayer: (feature, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: 7,
                            fillColor: '#ff8c00',
                            color: '#ffffff',
                            weight: 1.5,
                            opacity: 1,
                            fillOpacity: 0.9
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        const p = feature.properties || {};
                        const codPonto = p.cod_parada_v2025 || p.cod_ponto || p.CODIGO || p.codigo || p.id || 'S/N';
                        const descPonto = p.endereco || p.DESCRICAO || p.ENDERECO || '';
                        const txtTooltip = descPonto ? `<b>🚏 Parada: ${codPonto}</b><br>${descPonto}` : `<b>🚏 Parada: ${codPonto}</b>`;
                        layer.bindTooltip(txtTooltip, { sticky: true });
                    }
                });
            }
            // 3. Terminais Coloridos com Ícone BRT e Popup
            else if (nomeTabela === 'tb_terminais') {
                camadasEstaticas[nomeTabela] = L.geoJSON(geojson, {
                    pointToLayer: (feature, latlng) => {
                        const p = feature.properties || {};
                        
                        const situacao = (p.situacao || p.SITUACAO || '').toString().trim().toLowerCase();
                        const operacao = (p.operacao || p.OPERADORA || p.OPERACAO || '').toString().trim().toUpperCase();
                        const eBRT = operacao.includes('BRT');

                        let corFundo = '#198754';
                        let corTexto = '#ffffff';

                        if (situacao.includes('obra') || situacao.includes('licitação') || situacao.includes('licitacao') || situacao.includes('os assinada')) {
                            corFundo = '#ffc107'; 
                            corTexto = '#212529';
                        } 
                        else if (situacao.includes('soltura')) {
                            corFundo = '#0d6efd'; 
                            corTexto = '#ffffff';
                        } 
                        else if (situacao.includes('operação') || situacao.includes('operacao') || situacao.includes('ampliação') || situacao.includes('ampliacao')) {
                            corFundo = '#198754'; 
                            corTexto = '#ffffff';
                        }

                        const iconeSimbolo = eBRT ? '⚡ BRT' : '🏣';
                        const nomeTerm = p.nome || p.NOME || 'Terminal';

                        const iconHtml = `
                            <div style="
                                background-color: ${corFundo};
                                color: ${corTexto};
                                padding: 4px 10px;
                                border-radius: 12px;
                                border: 2px solid #ffffff;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                                font-size: 11px;
                                font-weight: 700;
                                white-space: nowrap;
                                display: flex;
                                align-items: center;
                                gap: 5px;
                            ">
                                ${iconeSimbolo} ${nomeTerm}
                            </div>
                        `;

                        return L.marker(latlng, {
                            icon: L.divIcon({
                                className: 'custom-terminal-icon',
                                html: iconHtml,
                                iconSize: [null, 26],
                                iconAnchor: [30, 13]
                            })
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        const p = feature.properties || {};
                        const nomeTerm = p.nome || p.NOME || 'Terminal de Ônibus';
                        const situacao = p.situacao || p.SITUACAO || 'Em operação';
                        const operacao = p.operacao || p.OPERACAO || 'STPC';

                        const popupHtml = `
                            <div style="min-width: 200px;">
                                <h6 class="fw-bold text-primary mb-1">${operacao.includes('BRT') ? '⚡ BRT' : '🏣'} ${nomeTerm}</h6>
                                <hr class="my-1">
                                <b>Situação:</b> <span class="badge bg-secondary">${situacao}</span><br>
                                <b>Operação:</b> ${operacao}
                            </div>
                        `;
                        layer.bindPopup(popupHtml);
                        layer.bindTooltip(`<b>${nomeTerm}</b> (${situacao})`, { sticky: true });
                    }
                });
            } else {
                camadasEstaticas[nomeTabela] = L.geoJSON(geojson);
            }

            camadasEstaticas[nomeTabela].addTo(mapa1);
        } catch (e) {
            console.error("Erro na camada estática:", e);
        }
    } else {
        camadasEstaticas[nomeTabela].addTo(mapa1);
    }
}