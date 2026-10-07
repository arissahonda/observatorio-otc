/**
 * Módulo: metro.js
 * Descrição: Gestão do módulo de Metrô com barra lateral, rankings Top 5/Menos 5,
 *            sincronização de mapas, gráfico multi-séries, gráfico de pizza
 *            interativo e exportação para Excel.
 */

const URL_API_METRO = API_URL;

let mapaMetro = null;
let camadaLinhasMetro = null;
let camadaEstacoesMetro = null;
let graficoLinhasMetroInstance = null;
let graficoPizzaCategoriasInstance = null;
let dadosMetroCache = []; 

// Estado Global do Filtro de Categoria no Mapa
let categoriaAtivaMapa = 'total_passageiros';
const ROTULOS_CATEGORIAS = {
    'total_passageiros': 'Total Geral',
    'total_pagantes': 'Pagantes',
    'total_estudantes': 'Estudantes',
    'total_gratuidades': 'Gratuidades',
    'total_integracoes': 'Integrações'
};

function normalizarCodigoEstacao(codigo) {
    if (codigo === null || codigo === undefined) return "";
    return codigo.toString().trim().replace(/^0+/, "");
}

function removerMadrugadaVazia(dados) {
    if (!dados || dados.length === 0) return [];
    const faixasOrdenadas = [...new Set(dados.map(i => i.INTERVALO))].sort();
    const totalPorFaixa = {};
    dados.forEach(item => {
        const f = item.INTERVALO;
        const pass = parseInt(item.total_passageiros, 10) || 0;
        totalPorFaixa[f] = (totalPorFaixa[f] || 0) + pass;
    });

    const primeiroIndiceComAtividade = faixasOrdenadas.findIndex(f => (totalPorFaixa[f] || 0) > 0);
    if (primeiroIndiceComAtividade <= 0) return dados;

    const indiceCorte = Math.max(0, primeiroIndiceComAtividade - 1);
    const faixasPermitidas = new Set(faixasOrdenadas.slice(indiceCorte));
    return dados.filter(item => faixasPermitidas.has(item.INTERVALO));
}

// 1. Inicializa o Mapa Leaflet
function inicializarMapaMetro() {
    if (mapaMetro) return;

    const containerMapa = document.getElementById('mapa-metro');
    if (!containerMapa) return;

    mapaMetro = L.map('mapa-metro').setView([-15.83, -48.05], 11);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18
    }).addTo(mapaMetro);

    if (typeof ativarControlesMouseMapa === 'function') {
        ativarControlesMouseMapa(mapaMetro);
    }

    mapaMetro.on('click', () => {
        const selectEstacao = document.getElementById('select-estacao-metro');
        if (selectEstacao && selectEstacao.value !== "") {
            selectEstacao.value = "";
            filtrarDadosEstacaoLocal();
        }
    });

    carregarGeometriasMetro();
}

// 2. Carrega Linhas e Estações
async function carregarGeometriasMetro() {
    try {
        const respLinhas = await fetch(`${URL_API_METRO}/mapa/camada-estatica/tb_linha_metro`);
        const dataLinhas = await respLinhas.json();

        if (dataLinhas.features) {
            camadaLinhasMetro = L.geoJSON(dataLinhas, {
                style: { color: '#fd7e14', weight: 4, opacity: 0.9 }
            }).addTo(mapaMetro);
            
            if (camadaLinhasMetro.getBounds().isValid()) {
                mapaMetro.fitBounds(camadaLinhasMetro.getBounds());
            }
        }

        const respEstacoes = await fetch(`${URL_API_METRO}/mapa/camada-estatica/tb_estacao_metro`);
        const dataEstacoes = await respEstacoes.json();

        if (dataEstacoes.features) {
            camadaEstacoesMetro = L.geoJSON(dataEstacoes, {
                filter: function (feature) {
                    const situacao = (feature.properties.mto_situac || "").toUpperCase();
                    return !situacao.includes("CONSTRUCAO") && !situacao.includes("CONSTRUÇÃO");
                },
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 6,
                        fillColor: "#0dcaf0",
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.85
                    });
                },
                onEachFeature: function (feature, layer) {
                    const nomeOriginal = feature.properties.mto_nome_e || feature.properties.NOME_ESTACAO || "Estação Metrô";
                    const codigoGeom = normalizarCodigoEstacao(feature.properties.mto_num_es);

                    layer.bindTooltip(`<b>${nomeOriginal}</b> (Cód: ${codigoGeom})`);

                    layer.on('click', (e) => {
                        if (e) L.DomEvent.stopPropagation(e);
                        const selectEstacao = document.getElementById('select-estacao-metro');
                        if (selectEstacao) {
                            const opcoes = Array.from(selectEstacao.options);
                            const opcaoEncontrada = opcoes.find(opt => {
                                const codigoOpt = opt.dataset.codigo;
                                return codigoOpt && normalizarCodigoEstacao(codigoOpt) === codigoGeom;
                            });
                            
                            if (opcaoEncontrada) {
                                selectEstacao.value = opcaoEncontrada.value;
                                filtrarDadosEstacaoLocal();
                            }
                        }
                    });
                }
            }).addTo(mapaMetro);

            if (dadosMetroCache && dadosMetroCache.length > 0) {
                const selectEstacao = document.getElementById('select-estacao-metro');
                const estacaoSelecionada = selectEstacao ? selectEstacao.value : "";
                atualizarMapaEstacoesCarregamento(dadosMetroCache, estacaoSelecionada);
            }
        }

    } catch (erro) {
        console.error("❌ Erro ao carregar geometrias do Metrô:", erro);
    }
}

// 3. Busca Lista de Datas
async function carregarDatasDisponiveisMetro() {
    const selectData = document.getElementById('select-data-metro');
    if (!selectData) return;

    try {
        const resp = await fetch(`${URL_API_METRO}/indicadores/datas-disponiveis?tabela=metro`);
        const json = await resp.json();

        if (json.sucesso && json.datas && json.datas.length > 0) {
            selectData.innerHTML = json.datas.map(d => `<option value="${d}">${d}</option>`).join('');
            carregarDadosMetro();
        } else {
            selectData.innerHTML = '<option value="">Nenhuma data encontrada</option>';
        }
    } catch (erro) {
        console.error("❌ Erro ao carregar datas do Metrô:", erro);
    }
}

// 4. Carrega Dados da API
async function carregarDadosMetro() {
    const selectData = document.getElementById('select-data-metro');
    const labelDiaSemana = document.getElementById('info-dia-semana-metro');

    if (!selectData || !selectData.value) return;
    const dataSelecionada = selectData.value;
    
    if (labelDiaSemana) {
        const diaSemana = (typeof obterDiaDaSemana === 'function') ? obterDiaDaSemana(dataSelecionada) : '';
        labelDiaSemana.innerHTML = diaSemana ? `🗓️ <b>${diaSemana}</b>` : "";
    }

    try {
        const url = `${URL_API_METRO}/indicadores/metro-faixa-horaria?data_pico=${encodeURIComponent(dataSelecionada)}`;
        const resp = await fetch(url);
        const json = await resp.json();

        if (json.sucesso && Array.isArray(json.dados)) {
            dadosMetroCache = json.dados;
            populaSelectEstacoes(dadosMetroCache);
            configurarEscutadorEstacao();
            filtrarDadosEstacaoLocal();
        } else {
            dadosMetroCache = [];
            filtrarDadosEstacaoLocal();
        }
    } catch (erro) {
        console.error("❌ Erro ao buscar dados da API do Metrô:", erro);
    }
}

function populaSelectEstacoes(dados) {
    const selectEstacao = document.getElementById('select-estacao-metro');
    if (!selectEstacao) return;

    const mapaEstacoes = {};
    dados.forEach(item => {
        if (item.ESTACAO && item.LINHA_CODIGO) {
            mapaEstacoes[item.ESTACAO] = item.LINHA_CODIGO;
        }
    });

    const estacoesOrdenadas = Object.keys(mapaEstacoes).sort();
    let htmlOptions = '<option value="" data-codigo="">Todas as Estações (Geral)</option>';
    estacoesOrdenadas.forEach(nome => {
        const cod = mapaEstacoes[nome];
        htmlOptions += `<option value="${nome}" data-codigo="${cod}">${nome}</option>`;
    });

    selectEstacao.innerHTML = htmlOptions;
}

function configurarEscutadorEstacao() {
    const selectEstacao = document.getElementById('select-estacao-metro');
    if (selectEstacao && !selectEstacao.dataset.listener) {
        selectEstacao.addEventListener('change', () => {
            filtrarDadosEstacaoLocal();
        });
        selectEstacao.dataset.listener = "true";
    }
}

// 5. Aplica Filtros e Atualiza os Componentes
function filtrarDadosEstacaoLocal() {
    const selectEstacao = document.getElementById('select-estacao-metro');
    const badgeFiltro = document.getElementById('badge-filtro-estacao');
    const estacaoSelecionada = selectEstacao ? selectEstacao.value : "";

    const nomeCat = ROTULOS_CATEGORIAS[categoriaAtivaMapa] || 'Total Geral';
    if (badgeFiltro) {
        badgeFiltro.innerText = estacaoSelecionada 
            ? `${estacaoSelecionada} (${nomeCat})` 
            : `Visão Geral (${nomeCat})`;
    }

    let dadosFiltrados = dadosMetroCache;
    if (estacaoSelecionada) {
        dadosFiltrados = dadosMetroCache.filter(item => item.ESTACAO === estacaoSelecionada);
    }

    dadosFiltrados = removerMadrugadaVazia(dadosFiltrados);

    renderizarGraficoMultiSeries(dadosFiltrados);
    renderizarGraficoRoscaCategorias(dadosFiltrados);
    atualizarCardsResumo(dadosFiltrados);
    atualizarMapaEstacoesCarregamento(dadosMetroCache, estacaoSelecionada);
    preencherRankingsEstacoesMetro(dadosMetroCache);
    renderizarTabelaCarregamento(dadosFiltrados);
}

// 6. NOVO: Calcula e Preenche os Rankings de Estações Mais e Menos Acessadas
function preencherRankingsEstacoesMetro(dados) {
    const listTop = document.getElementById('lista-top-estacoes-metro');
    const listLow = document.getElementById('lista-low-estacoes-metro');
    if (!listTop || !listLow) return;

    // Agrupa o volume de acessos por estação para a categoria ativa
    const totaisPorEstacao = {};
    dados.forEach(item => {
        const nomeEstacao = item.ESTACAO || "Desconhecida";
        const qtd = parseInt(item[categoriaAtivaMapa], 10) || 0;
        totaisPorEstacao[nomeEstacao] = (totaisPorEstacao[nomeEstacao] || 0) + qtd;
    });

    // Converte em array e ordena do maior para o menor
    const arrayOrdenado = Object.entries(totaisPorEstacao)
        .map(([estacao, total]) => ({ estacao, total }))
        .sort((a, b) => b.total - a.total);

    if (arrayOrdenado.length === 0) {
        listTop.innerHTML = '<li class="text-muted">Sem dados</li>';
        listLow.innerHTML = '<li class="text-muted">Sem dados</li>';
        return;
    }

    // Top 5 Mais Acessadas
    const top5 = arrayOrdenado.slice(0, 5);
    listTop.innerHTML = top5.map(item => 
        `<li><b>${item.estacao}</b>: ${item.total.toLocaleString('pt-BR')} pass.</li>`
    ).join('');

    // Top 5 Menos Acessadas (reverte a lista ordenada)
    const low5 = [...arrayOrdenado].reverse().slice(0, 5);
    listLow.innerHTML = low5.map(item => 
        `<li><b>${item.estacao}</b>: ${item.total.toLocaleString('pt-BR')} pass.</li>`
    ).join('');
}

// 7. Atualiza Marcadores do Mapa com Raio Responsivo
function atualizarMapaEstacoesCarregamento(todosDados, estacaoSelecionada = "") {
    if (!camadaEstacoesMetro) return;

    const demandaPorCodigo = {};
    let maiorDemandaEstacao = 0;

    todosDados.forEach(item => {
        const codNorm = normalizarCodigoEstacao(item.LINHA_CODIGO);
        const pass = parseInt(item[categoriaAtivaMapa], 10) || 0;
        
        demandaPorCodigo[codNorm] = (demandaPorCodigo[codNorm] || 0) + pass;

        if (demandaPorCodigo[codNorm] > maiorDemandaEstacao) {
            maiorDemandaEstacao = demandaPorCodigo[codNorm];
        }
    });

    const selectEstacao = document.getElementById('select-estacao-metro');
    const opcaoSelecionada = selectEstacao ? selectEstacao.options[selectEstacao.selectedIndex] : null;
    const codigoEstacaoSelecionada = opcaoSelecionada ? normalizarCodigoEstacao(opcaoSelecionada.dataset.codigo) : "";

    camadaEstacoesMetro.eachLayer(layer => {
        const props = layer.feature.properties;
        const nomeOriginal = props.mto_nome_e || props.NOME_ESTACAO || "";
        const codigoGeom = normalizarCodigoEstacao(props.mto_num_es);
        
        const totalEmbarquesCat = demandaPorCodigo[codigoGeom] || 0;

        let raio = 5;
        if (maiorDemandaEstacao > 0 && totalEmbarquesCat > 0) {
            raio = 4 + Math.round((totalEmbarquesCat / maiorDemandaEstacao) * 14);
        }

        let cor = "#0dcaf0";
        if (maiorDemandaEstacao > 0 && totalEmbarquesCat > 0) {
            const pct = totalEmbarquesCat / maiorDemandaEstacao;
            if (pct > 0.65) cor = "#dc3545";
            else if (pct > 0.30) cor = "#ffc107";
            else cor = "#198754";
        }

        const estaSelecionada = codigoEstacaoSelecionada && codigoEstacaoSelecionada === codigoGeom;
        const rotuloCat = ROTULOS_CATEGORIAS[categoriaAtivaMapa] || 'Embarques';
        
        layer.setRadius(estaSelecionada ? raio + 5 : raio);
        layer.setStyle({
            fillColor: estaSelecionada ? "#6f42c1" : cor,
            color: estaSelecionada ? "#ffffff" : "#000000",
            weight: estaSelecionada ? 2.5 : 1,
            fillOpacity: estaSelecionada ? 1.0 : 0.85
        });

        layer.bindTooltip(
            `<b>${nomeOriginal}</b> (Cód: ${codigoGeom})<br>${rotuloCat}: <b>${totalEmbarquesCat.toLocaleString('pt-BR')}</b>`
        );
    });
}

// 8. Renderiza Gráfico Multi-Séries de Linha
function renderizarGraficoMultiSeries(dados) {
    const ctx = document.getElementById('graficoBarrasCarregamento');
    if (!ctx) return;

    const faixasHorarias = [...new Set(dados.map(i => i.INTERVALO))].sort();
    const totais = { passageiros: {}, pagantes: {}, estudantes: {}, gratuidades: {}, integracoes: {} };

    dados.forEach(item => {
        const f = item.INTERVALO;
        totais.passageiros[f] = (totais.passageiros[f] || 0) + (parseInt(item.total_passageiros, 10) || 0);
        totais.pagantes[f] = (totais.pagantes[f] || 0) + (parseInt(item.total_pagantes, 10) || 0);
        totais.estudantes[f] = (totais.estudantes[f] || 0) + (parseInt(item.total_estudantes, 10) || 0);
        totais.gratuidades[f] = (totais.gratuidades[f] || 0) + (parseInt(item.total_gratuidades, 10) || 0);
        totais.integracoes[f] = (totais.integracoes[f] || 0) + (parseInt(item.total_integracoes, 10) || 0);
    });

    const datasets = [
        { label: 'Total Geral', data: faixasHorarias.map(f => totais.passageiros[f] || 0), borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', borderWidth: 3, tension: 0.35, fill: true },
        { label: 'Pagantes', data: faixasHorarias.map(f => totais.pagantes[f] || 0), borderColor: '#198754', borderWidth: 2, tension: 0.35, fill: false },
        { label: 'Estudantes', data: faixasHorarias.map(f => totais.estudantes[f] || 0), borderColor: '#fd7e14', borderWidth: 2, tension: 0.35, fill: false },
        { label: 'Gratuidades', data: faixasHorarias.map(f => totais.gratuidades[f] || 0), borderColor: '#dc3545', borderWidth: 2, tension: 0.35, fill: false },
        { label: 'Integrações', data: faixasHorarias.map(f => totais.integracoes[f] || 0), borderColor: '#6f42c1', borderWidth: 2, tension: 0.35, fill: false }
    ];

    if (graficoLinhasMetroInstance) graficoLinhasMetroInstance.destroy();

    graficoLinhasMetroInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: faixasHorarias, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } },
            scales: {
                y: { beginAtZero: true },
                x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } }
            }
        }
    });
}

// 9. Renderiza Gráfico de Rosca/Pizza por Categoria
function renderizarGraficoRoscaCategorias(dados) {
    const ctx = document.getElementById('graficoRoscaCategorias');
    if (!ctx) return;

    let totalPagantes = 0, totalEstudantes = 0, totalGratuidades = 0, totalIntegracoes = 0;

    dados.forEach(item => {
        totalPagantes += parseInt(item.total_pagantes, 10) || 0;
        totalEstudantes += parseInt(item.total_estudantes, 10) || 0;
        totalGratuidades += parseInt(item.total_gratuidades, 10) || 0;
        totalIntegracoes += parseInt(item.total_integracoes, 10) || 0;
    });

    if (graficoPizzaCategoriasInstance) {
        graficoPizzaCategoriasInstance.destroy();
    }

    const chavesCategorias = ['total_pagantes', 'total_estudantes', 'total_gratuidades', 'total_integracoes'];

    graficoPizzaCategoriasInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pagantes', 'Estudantes', 'Gratuidades', 'Integrações'],
            datasets: [{
                data: [totalPagantes, totalEstudantes, totalGratuidades, totalIntegracoes],
                backgroundColor: ['#198754', '#fd7e14', '#dc3545', '#6f42c1'],
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } }
            },
            onClick: (e, elements) => {
                if (elements && elements.length > 0) {
                    const idx = elements[0].index;
                    categoriaAtivaMapa = chavesCategorias[idx];
                } else {
                    categoriaAtivaMapa = 'total_passageiros';
                }
                filtrarDadosEstacaoLocal();
            }
        }
    });
}

function resetarFiltroCategoriaMapa() {
    categoriaAtivaMapa = 'total_passageiros';
    filtrarDadosEstacaoLocal();
}

// 10. Atualiza Cards de KPI
function atualizarCardsResumo(dados) {
    const cardTotal = document.getElementById('card-total-passageiros-metro');
    const cardPico = document.getElementById('card-pico-horario-metro');
    const cardSentido = document.getElementById('card-sentido-top-metro');

    if (!dados || dados.length === 0) {
        if (cardTotal) cardTotal.innerText = "0";
        if (cardPico) cardPico.innerText = "-";
        if (cardSentido) cardSentido.innerText = "R$ 0,00";
        return;
    }

    let totalPass = 0;
    let totalArrecadacao = 0;
    const faixaContagem = {};

    dados.forEach(item => {
        const pass = parseInt(item.total_passageiros, 10) || 0;
        const arrec = parseFloat(item.arrecadacao_dia) || 0;
        const faixa = item.INTERVALO || "-";

        totalPass += pass;
        totalArrecadacao += arrec;
        faixaContagem[faixa] = (faixaContagem[faixa] || 0) + pass;
    });

    let faixaPico = "-";
    let maxFaixaPass = 0;
    Object.entries(faixaContagem).forEach(([faixa, vol]) => {
        if (vol > maxFaixaPass) {
            maxFaixaPass = vol;
            faixaPico = faixa;
        }
    });

    if (cardTotal) cardTotal.innerText = totalPass.toLocaleString('pt-BR');
    if (cardPico) cardPico.innerText = faixaPico;
    if (cardSentido) cardSentido.innerText = totalArrecadacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// 11. Tabela Detalhada e Exportação Excel
let colunasOpcionaisMetro = {
    comumNormal: true, comumInteg: true, vtNormal: true, vtInteg: true,
    pagantes: true, contactless: true, estudantes: true, pne: true,
    pneAcomp: true, gratuitos: true, idoso: true, crianca: true,
    funcionarios: true, violenciaDomestica: true
};

const CONFIG_COLUNAS_OPCIONAIS_METRO = [
    { chave: 'comumNormal', label: 'Comum Normal' },
    { chave: 'comumInteg', label: 'Comum Integ.' },
    { chave: 'vtNormal', label: 'VT Normal' },
    { chave: 'vtInteg', label: 'VT Integ.' },
    { chave: 'pagantes', label: 'Pagantes' },
    { chave: 'contactless', label: 'Contactless' },
    { chave: 'estudantes', label: 'Total Estudantes' },
    { chave: 'pne', label: 'PNE' },
    { chave: 'pneAcomp', label: 'PNE Acomp.' },
    { chave: 'gratuitos', label: 'Gratuitos' },
    { chave: 'idoso', label: 'Idoso' },
    { chave: 'crianca', label: 'Criança' },
    { chave: 'funcionarios', label: 'Funcionários' },
    { chave: 'violenciaDomestica', label: 'Transporte por Elas' }
];

window.alternarColunaMetro = function (chave) {
    if (chave in colunasOpcionaisMetro) {
        colunasOpcionaisMetro[chave] = !colunasOpcionaisMetro[chave];
        filtrarDadosEstacaoLocal();
    }
};

window.alternarTodasColunasMetro = function (marcarTodas) {
    Object.keys(colunasOpcionaisMetro).forEach(chave => { colunasOpcionaisMetro[chave] = marcarTodas; });
    filtrarDadosEstacaoLocal();
};

function renderizarTabelaCarregamento(dados) {
    let containerTabela = document.getElementById('container-tabela-metro');
    if (!containerTabela) return;

    const faixasUnicas = [...new Set(dados.map(i => i.INTERVALO))].sort();
    
    const linhasTabela = faixasUnicas.map(faixa => {
        const sub = dados.filter(d => d.INTERVALO === faixa);
        const somar = (col) => sub.reduce((acc, curr) => acc + (parseInt(curr[col], 10) || 0), 0);
        const somarFloat = (col) => sub.reduce((acc, curr) => acc + (parseFloat(curr[col]) || 0), 0);

        return {
            faixa: faixa,
            comumNormal: somar('comum_normal'),
            comumInteg: somar('comum_integracao'),
            vtNormal: somar('vt_normal'),
            vtInteg: somar('vt_integracao'),
            pagantes: somar('pagantes'),
            contactless: somar('contactless'),
            estudantes: somar('total_estudantes'),
            pne: somar('pne'),
            pneAcomp: somar('pne_acompanhante'),
            gratuitos: somar('gratuitos'),
            idoso: somar('idoso'),
            crianca: somar('crianca'),
            funcionarios: somar('funcionarios'),
            violenciaDomestica: somar('violencia_domestica'),
            totalPagantes: somar('total_pagantes'),
            totalGratuidades: somar('total_gratuidades'),
            totalIntegracoes: somar('total_integracoes'),
            totalPassageiros: somar('total_passageiros'),
            arrecadacao: somarFloat('arrecadacao_dia')
        };
    });

    let htmlHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="fw-bold mb-0 text-primary">📋 Tabela Detalhada de Carregamento por Faixa Horária</h6>
            <button class="btn btn-sm btn-success fw-bold" onclick="exportarTabelaExcelMetro()">
                📥 Exportar Excel (.xlsx)
            </button>
        </div>

        <div class="p-2 mb-3 bg-light border rounded">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small fw-bold text-primary">⚙️ Selecione os detalhamentos desejados:</span>
                <div>
                    <button class="btn btn-link btn-sm p-0 me-2 text-decoration-none border-0" style="font-size: 0.75rem;" onclick="alternarTodasColunasMetro(true)">Marcar Todas</button>
                    <button class="btn btn-link btn-sm p-0 text-decoration-none border-0" style="font-size: 0.75rem;" onclick="alternarTodasColunasMetro(false)">Desmarcar Todas</button>
                </div>
            </div>
            <div class="d-flex flex-wrap gap-2">
    `;

    CONFIG_COLUNAS_OPCIONAIS_METRO.forEach(col => {
        const estaAtivo = colunasOpcionaisMetro[col.chave];
        htmlHTML += `
            <div class="form-check form-check-inline m-0">
                <input class="form-check-input" type="checkbox" id="chk_metro_${col.chave}" ${estaAtivo ? 'checked' : ''} onchange="alternarColunaMetro('${col.chave}')">
                <label class="form-check-label small" for="chk_metro_${col.chave}">${col.label}</label>
            </div>
        `;
    });

    htmlHTML += `
            </div>
        </div>

        <div class="table-responsive" style="max-height: 400px;">
            <table class="table table-sm table-hover table-bordered text-center align-middle" id="tabela-dados-metro" style="font-size: 0.82rem;">
                <thead class="table-dark sticky-top">
                    <tr>
                        <th>Faixa Horária</th>
    `;

    CONFIG_COLUNAS_OPCIONAIS_METRO.forEach(col => {
        if (colunasOpcionaisMetro[col.chave]) {
            htmlHTML += `<th>${col.label}</th>`;
        }
    });

    htmlHTML += `
                        <th>Total Pagantes</th>
                        <th>Total Gratuidades</th>
                        <th>Total Integrações</th>
                        <th>Total Geral</th>
                        <th>Arrecadação (R$)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    linhasTabela.forEach(r => {
        htmlHTML += `<tr>`;
        htmlHTML += `<td><strong>${r.faixa}</strong></td>`;

        CONFIG_COLUNAS_OPCIONAIS_METRO.forEach(col => {
            if (colunasOpcionaisMetro[col.chave]) {
                const valor = r[col.chave] || 0;
                htmlHTML += `<td>${valor.toLocaleString('pt-BR')}</td>`;
            }
        });

        htmlHTML += `
            <td><span class="badge bg-success fs-7">${r.totalPagantes.toLocaleString('pt-BR')}</span></td>
            <td><span class="badge bg-danger fs-7">${r.totalGratuidades.toLocaleString('pt-BR')}</span></td>
            <td><span class="badge bg-warning text-dark fs-7">${r.totalIntegracoes.toLocaleString('pt-BR')}</span></td>
            <td><span class="badge bg-primary fs-7">${r.totalPassageiros.toLocaleString('pt-BR')}</span></td>
            <td>${r.arrecadacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>`;
    });

    htmlHTML += `
                </tbody>
            </table>
        </div>
    `;

    containerTabela.innerHTML = htmlHTML;
}

window.exportarTabelaExcelMetro = function () {
    const tabela = document.getElementById('tabela-dados-metro');
    if (!tabela) return;

    const selectEstacao = document.getElementById('select-estacao-metro');
    let nomeEstacao = "Todas as Estações (Geral)";
    if (selectEstacao && selectEstacao.value) {
        nomeEstacao = selectEstacao.options[selectEstacao.selectedIndex].text;
    }

    const selectData = document.getElementById('select-data-metro');
    const dataAtual = (selectData && selectData.value) ? selectData.value : "Geral";

    const metadados = [
        ["OBSERVATÓRIO DO TRANSPORTE COLETIVO - OTC"],
        ["RELATÓRIO DE CARREGAMENTO DO METRÔ"],
        [`Estação: ${nomeEstacao}`],
        [`Data de Pico: ${dataAtual}`],
        []
    ];

    const ws = XLSX.utils.aoa_to_sheet(metadados);
    XLSX.utils.sheet_add_dom(ws, tabela, { origin: "A6" });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carregamento_Metro");

    const dataLimpa = dataAtual.replace(/\//g, "-");
    XLSX.writeFile(wb, `carregamento_metro_${dataLimpa}.xlsx`);
};

// 12. Escutador de Troca de Aba
document.addEventListener('DOMContentLoaded', () => {
    const abaMetroTab = document.getElementById('aba-metro-tab');
    
    if (abaMetroTab) {
        abaMetroTab.addEventListener('shown.bs.tab', () => {
            inicializarMapaMetro();
            setTimeout(() => {
                if (mapaMetro) {
                    mapaMetro.invalidateSize();
                    if (camadaLinhasMetro && camadaLinhasMetro.getBounds) {
                        const bounds = camadaLinhasMetro.getBounds();
                        if (bounds.isValid()) mapaMetro.fitBounds(bounds);
                    }
                }
            }, 250);
            carregarDatasDisponiveisMetro();
        });
    }
});