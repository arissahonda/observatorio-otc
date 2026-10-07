/**
 * Módulo: operacao_teorica_stu.js
 * Descrição: Gestão do painel Operação Teórica (STU)
 * Totalmente integrado com a tabela hist_indicadores_simp_pico_stu,
 * incluindo seleção de métricas por grupo, formatação percentual, badges de geometria e gráfico anual.
 */

const URL_API_TEORICA = (typeof API_URL !== 'undefined') ? API_URL : "http://localhost:8000/api/v1";

// 1. DICIONÁRIO COMPLETO DE RÓTULOS (INCLUINDO PERCENTUAIS E PADRONIZAÇÃO DE GEOMETRIA)
const ROTULOS_TEORICA = {
    'LINHA_CODIGO': 'Linha',
    'LINHA_DENOMINACAO': 'Denominação',
    'SENTIDO': 'Sentido',
    'OPERADORA': 'Operadora',
    'BACIA_OPERACAO': 'Bacia',
    'TARIFA_USUARIO': 'Tarifa Usuário (R$)',
    'TARIFA_TECNICA': 'Tarifa Técnica (R$)',
    'FROTA_ALOCADA': 'Frota Alocada',
    'FROTA_REAPROVEITADA': 'Frota Reaproveitada',
    'FROTA_PLANEJADA': 'Frota Planejada',
    'DURACAO': 'Duração (min)',
    'VIAGENS_PLANEJADAS': 'Viagens Planejadas',
    'HW_OPERADOR': 'Headway Operador',
    'HW_PASSAGEIRO': 'Headway Passageiro',
    'EXTENSAO_KM': 'Extensão (km)',
    'KM_DIA': 'KM Dia',
    'KM_MES': 'KM Mês',
    'KM_ANO': 'KM Ano',
    'HORAS_DIA': 'Horas Dia',
    'LUGARES_OFERTADOS': 'Lugares Ofertados',
    'LUGARES_VIAGEM': 'Lugares / Viagem',
    'TOTAL_GRATUIDADES': 'Gratuidades',
    'TOTAL_ESTUDANTES': 'Estudantes',
    'TOTAL_PAGANTES': 'Pagantes',
    'TOTAL_INTEGRACOES': 'Integrações',
    'TOTAL_PASSAGEIROS': 'Total Passageiros',
    'PERC_INTEGRACOES': '% Integrações',
    'PERC_GRATUIDADES': '% Gratuidades',
    'PERC_ESTUDANTES': '% Estudantes',
    'PASSAGEIROS_ELEGIVEIS_SUBSIDIO': 'Passag. Elegíveis Subsídio',
    'PASSAGEIROS_MES': 'Passageiros Mês',
    'PASSAGEIROS_ANO': 'Passageiros Ano',
    'CUSTO_SERVICO': 'Custo Serviço (R$)',
    'ARRECADACAO_DIA': 'Arrecadação Dia (R$)',
    'VALOR_SUBSIDIO': 'Valor Subsídio (R$)',
    'IPK': 'IPK',
    'DEMANDA_OFERTA': 'Demanda / Oferta',
    'PASSAGEIROS_VIAGEM': 'Passag. / Viagem',
    'IRP': 'IRP',
    'RECEITA_VIAGEM': 'Receita / Viagem (R$)',
    'RECEITA_VEICULO': 'Receita / Veículo (R$)',
    'SUBSIDIO': 'Subsídio por Passag. (R$)',
    'RECEITA_KM': 'Receita / KM (R$)',
    'VELOCIDADE_MEDIA': 'Velocidade Média (km/h)',
    'DATA_PICO': 'Data Pico',
    'DIA_SEMANA': 'Dia Semana',
    'DIAS_UTEIS_MES': 'Dias Úteis Mês',
    'ID_LINHA': 'ID Linha',
    'MOTIVO_SEM_GEOMETRIA': 'Inconsistência Geométrica',
    'FLG_DIVERGENCIA_SENTIDO': 'Divergência Sentido'
};

// 2. ESTRUTURAÇÃO DOS GRUPOS DO ACORDEÃO LATERAL
const COLUNAS_TEORICA_GRUPO = {
    'grupo-colunas-operacional': [
        { chave: 'LINHA_DENOMINACAO', checado: true },
        { chave: 'SENTIDO', checado: true },
        { chave: 'OPERADORA', checado: true },
        { chave: 'BACIA_OPERACAO', checado: false },
        { chave: 'MOTIVO_SEM_GEOMETRIA', checado: true },
        { chave: 'DATA_PICO', checado: false },
        { chave: 'DIA_SEMANA', checado: false },
        { chave: 'DIAS_UTEIS_MES', checado: false },
        { chave: 'FROTA_ALOCADA', checado: false },
        { chave: 'FROTA_REAPROVEITADA', checado: false },
        { chave: 'FROTA_PLANEJADA', checado: true },
        { chave: 'DURACAO', checado: false },
        { chave: 'HORAS_DIA', checado: false },
        { chave: 'VELOCIDADE_MEDIA', checado: false },
        { chave: 'VIAGENS_PLANEJADAS', checado: true },
        { chave: 'HW_OPERADOR', checado: false },
        { chave: 'HW_PASSAGEIRO', checado: false },
        { chave: 'EXTENSAO_KM', checado: false },
        { chave: 'KM_DIA', checado: false },
        { chave: 'KM_MES', checado: false },
        { chave: 'KM_ANO', checado: false },
        { chave: 'LUGARES_OFERTADOS', checado: false },
        { chave: 'LUGARES_VIAGEM', checado: false }
    ],
    'grupo-colunas-demanda': [
        { chave: 'TOTAL_PASSAGEIROS', checado: true },
        { chave: 'TOTAL_PAGANTES', checado: false },
        { chave: 'TOTAL_GRATUIDADES', checado: false },
        { chave: 'TOTAL_ESTUDANTES', checado: false },
        { chave: 'TOTAL_INTEGRACOES', checado: false },
        { chave: 'PERC_INTEGRACOES', checado: false },
        { chave: 'PERC_GRATUIDADES', checado: false },
        { chave: 'PERC_ESTUDANTES', checado: false },
        { chave: 'IPK', checado: true },
        { chave: 'IRP', checado: false },
        { chave: 'DEMANDA_OFERTA', checado: true }
    ],
     'grupo-colunas-financeiro': [
        { chave: 'TARIFA_USUARIO', checado: false },
        { chave: 'TARIFA_TECNICA', checado: false },
        { chave: 'ARRECADACAO_DIA', checado: true },
        { chave: 'CUSTO_SERVICO', checado: false },
        { chave: 'VALOR_SUBSIDIO', checado: false },
        { chave: 'RECEITA_VIAGEM', checado: false },
        { chave: 'RECEITA_VEICULO', checado: false },
        { chave: 'RECEITA_KM', checado: false },
        { chave: 'IPK', checado: true },
        { chave: 'IRP', checado: false },
        { chave: 'DEMANDA_OFERTA', checado: false }
    ]
};

// Variáveis Globais de Controle
let mapaTeoricaSTU = null;
let camadaTeoricaLinhas = null;
let dadosBrutosTeoricaSTU = [];
let listaTeoricaFiltradaAtual = [];
let filtroApenasInconsistentesTeorica = false;
let graficoAnualTeoricaInstance = null;

document.addEventListener("DOMContentLoaded", function () {
    gerarCheckboxesAcordeaoTeoricaSTU();
    inicializarAbaTeoricaSTU();
    ocultarCardNaoOperadasTeoricaSTU();
});

function ocultarCardNaoOperadasTeoricaSTU() {
    const elBadgeNaoOp = document.getElementById('badge-total-nao-operado-teorica-stu');
    if (elBadgeNaoOp) {
        const cardParent = elBadgeNaoOp.closest('.col') || elBadgeNaoOp.closest('.col-md-2') || elBadgeNaoOp.parentElement;
        if (cardParent) cardParent.style.display = 'none';
    }
}

function garantirInicializacaoMapaTeoricaSTU() {
    if (!mapaTeoricaSTU) {
        const elMapa = document.getElementById('mapa-teorica-stu');
        if (!elMapa) return;

        if (typeof inicializarMapaBase === 'function') {
            mapaTeoricaSTU = inicializarMapaBase('mapa-teorica-stu');
        } else if (typeof L !== 'undefined') {
            mapaTeoricaSTU = L.map('mapa-teorica-stu').setView([-15.793889, -47.882778], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(mapaTeoricaSTU);
        }

        if (mapaTeoricaSTU && typeof ativarControlesMouseMapa === 'function') {
            ativarControlesMouseMapa(mapaTeoricaSTU, filtrarPorAreaTeoricaSTU, limparSelecaoAreaTeoricaSTU);
        }

        elMapa.style.cursor = 'crosshair';
    }
}

function inicializarAbaTeoricaSTU() {
    garantirInicializacaoMapaTeoricaSTU();

    const abaAutonomoTab = document.getElementById("aba-autonomo-tab");
    const subTeoricaSTUTab = document.getElementById("sub-teorica-stu-tab");

    const carregarEMostrarMapaTeorica = () => {
        setTimeout(() => {
            garantirInicializacaoMapaTeoricaSTU();
            if (mapaTeoricaSTU) mapaTeoricaSTU.invalidateSize();
            if (dadosBrutosTeoricaSTU && dadosBrutosTeoricaSTU.length > 0) {
                renderizarMapaTeoricaSTU(dadosBrutosTeoricaSTU);
            }
        }, 250);
    };

    if (abaAutonomoTab) abaAutonomoTab.addEventListener("shown.bs.tab", carregarEMostrarMapaTeorica);
    if (subTeoricaSTUTab) subTeoricaSTUTab.addEventListener("shown.bs.tab", carregarEMostrarMapaTeorica);

    carregarDatasTeoricaSTU();
}

// 3. CARREGAR DATAS E DADOS DA API
async function carregarDatasTeoricaSTU() {
    const selectData = document.getElementById("select-data-teorica-stu");
    if (!selectData) return;

    try {
        const resp = await fetch(`${URL_API_TEORICA}/indicadores/datas-disponiveis?tabela=pico_teorica&modal=stu_teorica`);
        const json = await resp.json();

        if (json.sucesso && json.datas && json.datas.length > 0) {
            selectData.innerHTML = json.datas.map(d => `<option value="${d}">${d}</option>`).join('');
            carregarDadosTeoricaSTUPorData();
        } else {
            selectData.innerHTML = '<option value="">Nenhuma data encontrada</option>';
        }
    } catch (erro) {
        console.error("❌ Erro ao carregar datas teóricas STU:", erro);
        selectData.innerHTML = '<option value="">Erro ao conectar à API</option>';
    }
}

async function carregarDadosTeoricaSTUPorData() {
    const selectData = document.getElementById("select-data-teorica-stu");
    const labelDiaSemana = document.getElementById("info-dia-semana-teorica-stu");
    const corpoTabela = document.getElementById("corpo-tabela-teorica-stu");

    if (!selectData || !selectData.value) return;
    const dataSelecionada = selectData.value;

    if (labelDiaSemana) {
        const diaSemana = (typeof obterDiaDaSemana === 'function') ? obterDiaDaSemana(dataSelecionada) : '';
        labelDiaSemana.innerHTML = diaSemana ? `🗓️ <b>${diaSemana}</b>` : "";
    }

    if (corpoTabela) {
        corpoTabela.innerHTML = '<tr><td colspan="20" class="text-center text-primary py-4">🔄 A carregar indicadores teóricos...</td></tr>';
    }

    try {
        const resp = await fetch(`${URL_API_STU}/indicadores/historico-completo?data=${encodeURIComponent(dataSelecionada)}&modal=stu_teorica`);
        const json = await resp.json();

        if (json.sucesso && json.dados) {
            dadosBrutosTeoricaSTU = json.dados;
            preencherDropdownOperadorasTeoricaSTU(dadosBrutosTeoricaSTU);
            renderizarMapaTeoricaSTU(dadosBrutosTeoricaSTU);
            preencherTabelaTeoricaSTU(dadosBrutosTeoricaSTU, dataSelecionada);
            carregarDadosAnuaisTeoricaAPI('stu');
        } else {
            if (corpoTabela) corpoTabela.innerHTML = `<tr><td colspan="20" class="text-center text-danger py-4">${json.erro || "Sem dados."}</td></tr>`;
        }
    } catch (erro) {
        console.error("❌ Erro ao buscar dados teóricos STU:", erro);
        if (corpoTabela) corpoTabela.innerHTML = `<tr><td colspan="20" class="text-center text-danger py-4">Erro de conexão.</td></tr>`;
    }
}

function preencherDropdownOperadorasTeoricaSTU(dados) {
    const selectOp = document.getElementById("select-operadora-teorica-stu");
    if (!selectOp) return;

    const operadoresUnicos = new Set();
    dados.forEach(item => {
        const op = item.OPERADORA || item.operadora;
        if (op) operadoresUnicos.add(op.toString().trim());
    });

    const operadoresOrdenados = Array.from(operadoresUnicos).sort();
    let htmlOptions = '<option value="">Todas as Operadoras</option>';
    operadoresOrdenados.forEach(op => { htmlOptions += `<option value="${op}">${op}</option>`; });
    selectOp.innerHTML = htmlOptions;
}

// 4. FILTROS E BUSCAS
function aplicarFiltrosTeoricaSTU() {
    if (!dadosBrutosTeoricaSTU || !dadosBrutosTeoricaSTU.length) return;

    const inputTexto = document.getElementById("input-filtrar-linha-teorica-stu");
    const selectOp = document.getElementById("select-operadora-teorica-stu");

    const termoTexto = inputTexto ? inputTexto.value.trim().toLowerCase() : "";
    const operadoraSelecionada = selectOp ? selectOp.value.trim().toLowerCase() : "";
    const codigosBusca = termoTexto ? termoTexto.split(',').map(c => c.trim()).filter(Boolean) : [];

    const dadosFiltrados = dadosBrutosTeoricaSTU.filter(item => {
        const codigoLinha = (item.LINHA_CODIGO || item.linha_codigo || "").toString().toLowerCase().trim();
        const bateuTexto = codigosBusca.length === 0 || codigosBusca.some(busca => codigoLinha.includes(busca));

        const operadora = (item.OPERADORA || item.operadora || "").toString().toLowerCase();
        const bateuOperadora = !operadoraSelecionada || operadora.includes(operadoraSelecionada);

        let bateuInconsistencia = true;
        if (filtroApenasInconsistentesTeorica) {
            const motivo = String(item.MOTIVO_SEM_GEOMETRIA || item.motivo_sem_geometria || '').trim().toUpperCase();
            bateuInconsistencia = motivo !== '' && motivo !== 'OK' && motivo !== 'NULL' && motivo !== 'UNDEFINED';
        }

        return bateuTexto && bateuOperadora && bateuInconsistencia;
    });

    const dataSelecionada = document.getElementById('select-data-teorica-stu')?.value || '';
    preencherTabelaTeoricaSTU(dadosFiltrados, dataSelecionada);
    renderizarMapaTeoricaSTU(dadosFiltrados);
}

function filtrarLinhaTeoricaSTU() { aplicarFiltrosTeoricaSTU(); }
function filtrarPorOperadoraTeoricaSTU() { aplicarFiltrosTeoricaSTU(); }

function limparFiltrosTeoricaSTU() {
    const inputTexto = document.getElementById("input-filtrar-linha-teorica-stu");
    const selectOp = document.getElementById("select-operadora-teorica-stu");

    if (inputTexto) inputTexto.value = "";
    if (selectOp) selectOp.value = "";
    filtroApenasInconsistentesTeorica = false;

    aplicarFiltrosTeoricaSTU();
}

function filtrarLinhasInconsistentesTeoricaSTU() {
    filtroApenasInconsistentesTeorica = !filtroApenasInconsistentesTeorica;
    aplicarFiltrosTeoricaSTU();
}

function filtrarPorAreaTeoricaSTU(bounds) {
    const linhasFiltradas = [];

    if (camadaTeoricaLinhas) {
        camadaTeoricaLinhas.eachLayer(layer => {
            const interseca = typeof linhaIntersecaRetangulo === 'function' 
                ? linhaIntersecaRetangulo(layer.feature.geometry, bounds) 
                : false;

            if (interseca) {
                layer.setStyle({ color: '#dc3545', weight: 5, opacity: 1 });
                linhasFiltradas.push(layer.feature.properties);
            } else {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }

    const dataSelecionada = document.getElementById('select-data-teorica-stu')?.value || '';
    preencherTabelaTeoricaSTU(linhasFiltradas, dataSelecionada);
}

/**
 * Limpa a seleção espacial do mapa na Operação Teórica (STU)
 * e reseta o campo de filtro por itinerário.
 */
function limparSelecaoAreaTeoricaSTU() {
    // 1. Localiza o campo de entrada do filtro por itinerário e limpa o texto digitado
    const inputTexto = document.getElementById("input-filtrar-linha-teorica-stu");
    if (inputTexto) {
        inputTexto.value = "";
    }

    // 2. Restaura o estilo visual padrão de todas as linhas desenhadas no mapa
    if (camadaTeoricaLinhas) {
        camadaTeoricaLinhas.eachLayer(layer => {
            layer.setStyle({ 
                color: '#0d6efd', 
                weight: 3, 
                opacity: 0.8 
            });
        });
    }

    // 3. Reseta a variável de controle de inconsistências (caso esteja ativa)
    filtroApenasInconsistentesTeorica = false;

    // 4. Executa a função central de filtros para atualizar o mapa e a tabela sincronizados
    aplicarFiltrosTeoricaSTU();
}

// 5. MAPA LEAFLET
function renderizarMapaTeoricaSTU(dados) {
    garantirInicializacaoMapaTeoricaSTU();
    if (!mapaTeoricaSTU) return;

    if (camadaTeoricaLinhas) {
        try { mapaTeoricaSTU.removeLayer(camadaTeoricaLinhas); } catch (e) {}
    }

    const features = [];
    dados.forEach(item => {
        if (!item.geojson_geom) return;
        try {
            const geomObj = (typeof item.geojson_geom === 'string') ? JSON.parse(item.geojson_geom) : item.geojson_geom;
            if (geomObj) features.push({ type: "Feature", geometry: geomObj, properties: item });
        } catch (e) {}
    });

    if (features.length > 0) {
        camadaTeoricaLinhas = L.geoJSON({ type: "FeatureCollection", features: features }, {
            style: { color: '#0d6efd', weight: 3, opacity: 0.8 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const cod = p.LINHA_CODIGO || p.linha_codigo || '-';
                const denom = p.LINHA_DENOMINACAO || p.linha_denominacao || '';
                const pass = parseInt(p.TOTAL_PASSAGEIROS ?? 0, 10) || 0;
                layer.bindTooltip(`<b>🚌 Linha Teórica ${cod}</b><br>${denom}<br><b>Passageiros:</b> ${pass.toLocaleString('pt-BR')}`);
            }
        }).addTo(mapaTeoricaSTU);

        setTimeout(() => {
            mapaTeoricaSTU.invalidateSize();
            const bounds = camadaTeoricaLinhas.getBounds();
            if (bounds && bounds.isValid()) {
                mapaTeoricaSTU.fitBounds(bounds, { padding: [20, 20], maxZoom: 12, animate: false });
            }
        }, 100);
    }
}

// 6. PREENCHIMENTO DA TABELA E CÁLCULO DE CARDS
function preencherTabelaTeoricaSTU(lista, dataStr) {
    listaTeoricaFiltradaAtual = lista || [];
    const tbody = document.getElementById('corpo-tabela-teorica-stu');
    const thead = document.getElementById('cabecalho-tabela-teorica-stu');
    const badgeLinhas = document.getElementById('badge-total-linhas-teorica-stu');
    const badgePassageiros = document.getElementById('badge-total-passageiros-teorica-stu');
    const btnExcel = document.getElementById('btn-exportar-excel-teorica-stu');

    let colunasAtivas = ['LINHA_CODIGO'];
    const chks = document.querySelectorAll('#accordionColunasTeoricaSTU input.chk-coluna-teorica:checked');
    if (chks && chks.length > 0) {
        chks.forEach(c => { if (!colunasAtivas.includes(c.value)) colunasAtivas.push(c.value); });
    } else {
        colunasAtivas = [
            'LINHA_CODIGO', 'LINHA_DENOMINACAO', 'SENTIDO', 'OPERADORA', 'BACIA_OPERACAO',
            'MOTIVO_SEM_GEOMETRIA', 'FROTA_PLANEJADA', 'VIAGENS_PLANEJADAS', 'KM_DIA', 'LUGARES_OFERTADOS',
            'TOTAL_PASSAGEIROS', 'IPK', 'DEMANDA_OFERTA', 'CUSTO_SERVICO', 'ARRECADACAO_DIA', 'VALOR_SUBSIDIO'
        ];
    }

    if (!lista || lista.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted py-4">Nenhum dado disponível.</td></tr>';
        if (btnExcel) btnExcel.disabled = true;
        return;
    }

    calcularECardsTeoricaSTU(lista);
    preencherRankingsEDiagnosticosTeorica(lista);

    if (thead) {
        let htmlHeader = '<tr>';
        colunasAtivas.forEach(col => { 
            const rotulo = ROTULOS_TEORICA[col] || col;
            htmlHeader += `<th>${rotulo}</th>`; 
        });
        htmlHeader += '</tr>';
        thead.innerHTML = htmlHeader;
    }

    let htmlBody = '';
    lista.forEach(p => {
        htmlBody += '<tr>';
        colunasAtivas.forEach(col => {
            let val = p[col] ?? p[col.toLowerCase()] ?? '-';
            
            if (col === 'LINHA_CODIGO') {
                val = `<span class="badge bg-primary fs-6">${val}</span>`;
            } else if (col === 'MOTIVO_SEM_GEOMETRIA') {
                const strVal = String(val).trim().toUpperCase();
                if (strVal === 'OK' || strVal === '-' || strVal === '' || strVal === 'NULL') {
                    val = `<span class="badge bg-success">OK</span>`;
                } else {
                    val = `<span class="badge bg-warning text-dark" title="${val}">⚠️ ${val}</span>`;
                }
            } else if (['CUSTO_SERVICO', 'ARRECADACAO_DIA', 'VALOR_SUBSIDIO', 'TARIFA_USUARIO', 'TARIFA_TECNICA', 'RECEITA_VIAGEM', 'RECEITA_VEICULO', 'SUBSIDIO', 'RECEITA_KM'].includes(col)) {
                const num = parseFloat(val);
                val = !isNaN(num) ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
            } else if (['PERC_INTEGRACOES', 'PERC_GRATUIDADES', 'PERC_ESTUDANTES', 'DEMANDA_OFERTA'].includes(col)) {
                const num = parseFloat(val);
                if (!isNaN(num) && val !== '-') {
                    let pct = num;
                    if (num <= 1 && num > 0) {
                        pct = num * 100;
                    }
                    val = `${pct.toFixed(1).replace('.', ',')}%`;
                } else if (val === 0 || val === '0') {
                    val = '0,0%';
                }
            } else if (['IPK', 'IRP', 'HW_OPERADOR', 'HW_PASSAGEIRO', 'VELOCIDADE_MEDIA'].includes(col)) {
                const num = parseFloat(val);
                val = !isNaN(num) ? num.toFixed(2).replace('.', ',') : '-';
            } else if (['TOTAL_PASSAGEIROS', 'TOTAL_PAGANTES', 'TOTAL_GRATUIDADES', 'TOTAL_ESTUDANTES', 'TOTAL_INTEGRACOES', 'LUGARES_OFERTADOS', 'VIAGENS_PLANEJADAS', 'FROTA_PLANEJADA'].includes(col)) {
                const num = parseInt(val, 10);
                val = !isNaN(num) ? num.toLocaleString('pt-BR') : '-';
            } else if (['EXTENSAO_KM', 'KM_DIA', 'KM_MES', 'KM_ANO'].includes(col)) {
                const num = parseFloat(val);
                val = !isNaN(num) ? num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-';
            }

            htmlBody += `<td>${val}</td>`;
        });
        htmlBody += '</tr>';
    });

    if (tbody) tbody.innerHTML = htmlBody;

    const codigosUnicos = new Set(lista.map(i => i.LINHA_CODIGO || i.linha_codigo));
    const somaPassageiros = lista.reduce((acc, i) => acc + (parseInt(i.TOTAL_PASSAGEIROS || 0, 10) || 0), 0);

    if (badgeLinhas) {
        badgeLinhas.classList.remove('d-none');
        badgeLinhas.innerHTML = `Linhas: <b>${codigosUnicos.size.toLocaleString('pt-BR')}</b>`;
    }
    if (badgePassageiros) {
        badgePassageiros.classList.remove('d-none');
        badgePassageiros.innerHTML = `Total Passageiros: <b>${somaPassageiros.toLocaleString('pt-BR')}</b>`;
    }
    if (btnExcel) btnExcel.disabled = false;
}

// 7. CÁLCULO DOS CARDS OPERACIONAIS SUPERIORES
function calcularECardsTeoricaSTU(dados) {
    if (!dados || dados.length === 0) return;

    let somaPassageiros = 0, somaKmDia = 0, somaCusto = 0, somaArrecadacao = 0, somaSubsidio = 0, somaLugaresOfertados = 0;

    dados.forEach(item => {
        somaPassageiros += parseFloat(item.TOTAL_PASSAGEIROS || 0) || 0;
        somaKmDia += parseFloat(item.KM_DIA || 0) || 0;
        somaCusto += parseFloat(item.CUSTO_SERVICO || 0) || 0;
        somaArrecadacao += parseFloat(item.ARRECADACAO_DIA || 0) || 0;
        somaSubsidio += parseFloat(item.VALOR_SUBSIDIO || 0) || 0;
        somaLugaresOfertados += parseFloat(item.LUGARES_OFERTADOS || 0) || 0;
    });

    const ipkMedio = somaKmDia > 0 ? (somaPassageiros / somaKmDia) : 0;
    const irpMedio = somaCusto > 0 ? (somaArrecadacao / somaCusto) : 0;
    const custoMedioKm = somaKmDia > 0 ? (somaCusto / somaKmDia) : 0;
    const demandaOfertaPerc = somaLugaresOfertados > 0 ? ((somaPassageiros / somaLugaresOfertados) * 100) : 0;

    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    setT('card-ipk-medio-teorica-stu', ipkMedio.toFixed(2).replace('.', ','));
    setT('card-irp-medio-teorica-stu', irpMedio.toFixed(2).replace('.', ','));
    setT('card-custo-medio-teorica-stu', custoMedioKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-arrecadacao-total-teorica-stu', somaArrecadacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-subsidio-total-teorica-stu', somaSubsidio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-demanda-oferta-teorica-stu', demandaOfertaPerc.toFixed(1).replace('.', ',') + '%');
}

// =========================================================================
// 8. DIAGNÓSTICOS E RANKINGS (OPERAÇÃO TEÓRICA)
// =========================================================================
function preencherRankingsEDiagnosticosTeorica(dados) {
    if (!dados || dados.length === 0) return;

    // Função auxiliar para formatar 'Linha {CODIGO} ({SENTIDO})'
    const formatarLinhaESentido = (item) => {
        const cod = item.LINHA_CODIGO || item.linha_codigo || '-';
        const sentido = item.SENTIDO || item.sentido || '';
        const sentidoTxt = sentido ? ` (${sentido})` : '';
        return `<b>Linha ${cod}</b>${sentidoTxt}`;
    };

    // 1. Top 5 Maior IPK
    const ordenadoMaiorIPK = [...dados]
        .filter(i => parseFloat(i.IPK || 0) > 0)
        .sort((a, b) => parseFloat(b.IPK || 0) - parseFloat(a.IPK || 0))
        .slice(0, 5);

    const listTopIpk = document.getElementById('lista-top-ipk-teorica-stu');
    if (listTopIpk) {
        listTopIpk.innerHTML = ordenadoMaiorIPK.map(item => {
            const ipk = parseFloat(item.IPK || 0).toFixed(2).replace('.', ',');
            return `<li>${formatarLinhaESentido(item)}: IPK ${ipk}</li>`;
        }).join('');
    }

    // 2. Top 5 Menor IPK
    const ordenadoMenorIPK = [...dados]
        .filter(i => parseFloat(i.IPK || 0) > 0)
        .sort((a, b) => parseFloat(a.IPK || 0) - parseFloat(b.IPK || 0))
        .slice(0, 5);

    const listLowIpk = document.getElementById('lista-low-ipk-teorica-stu');
    if (listLowIpk) {
        listLowIpk.innerHTML = ordenadoMenorIPK.map(item => {
            const ipk = parseFloat(item.IPK || 0).toFixed(2).replace('.', ',');
            return `<li>${formatarLinhaESentido(item)}: IPK ${ipk}</li>`;
        }).join('');
    }

    // 3. Top 5 Carregamento (Passageiros)
    const ordenadoCarregamento = [...dados]
        .sort((a, b) => parseInt(b.TOTAL_PASSAGEIROS || 0, 10) - parseInt(a.TOTAL_PASSAGEIROS || 0, 10))
        .slice(0, 5);

    const listTopCarga = document.getElementById('lista-top-carregamento-teorica-stu');
    if (listTopCarga) {
        listTopCarga.innerHTML = ordenadoCarregamento.map(item => {
            const pass = parseInt(item.TOTAL_PASSAGEIROS || 0, 10).toLocaleString('pt-BR');
            return `<li>${formatarLinhaESentido(item)}: ${pass} pass.</li>`;
        }).join('');
    }

    // 4. Linhas Sem Carregamento
    const semCarregamento = dados.filter(i => parseInt(i.TOTAL_PASSAGEIROS || 0, 10) === 0);
    const badgeSemCarga = document.getElementById('badge-total-sem-carregamento-teorica-stu');
    if (badgeSemCarga) badgeSemCarga.innerText = semCarregamento.length;

    // 5. Inconsistências Geométricas
    const semGeometria = dados.filter(i => {
        const motivo = String(i.MOTIVO_SEM_GEOMETRIA || i.motivo_sem_geometria || '').trim().toUpperCase();
        return motivo !== '' && motivo !== 'OK' && motivo !== 'NULL' && motivo !== 'UNDEFINED';
    });
    
    const badgeInconsistencia = document.getElementById('badge-total-inconsistencia-teorica-stu');
    if (badgeInconsistencia) {
        badgeInconsistencia.innerText = semGeometria.length;
    }
}

// 9. GERADOR E SELETOR DE CHECKBOXES DO ACORDEÃO LATERAL (COM SELEÇÃO POR GRUPO)
function gerarCheckboxesAcordeaoTeoricaSTU() {
    Object.keys(COLUNAS_TEORICA_GRUPO).forEach(idGrupo => {
        const idTarget = idGrupo + "-teorica-stu";
        const container = document.getElementById(idTarget);
        if (!container) return;

        let html = `
            <div class="form-check m-0 mb-2 pb-1 border-bottom">
                <input class="form-check-input" type="checkbox" id="chk-todos-${idGrupo}-teorica" onchange="alternarTodosDoGrupoTeoricaSTU('${idGrupo}', this.checked)">
                <label class="form-check-label fw-bold text-primary small" for="chk-todos-${idGrupo}-teorica">Marcar / Desmarcar Todos</label>
            </div>
        `;

        COLUNAS_TEORICA_GRUPO[idGrupo].forEach(col => {
            const rotulo = ROTULOS_TEORICA[col.chave] || col.chave;
            html += `
                <div class="form-check m-0 mb-1">
                    <input class="form-check-input chk-coluna-teorica" type="checkbox" value="${col.chave}" id="chk-teorica-${col.chave}" ${col.checado ? 'checked' : ''} onchange="aplicarFiltrosTeoricaSTU()">
                    <label class="form-check-label text-truncate" for="chk-teorica-${col.chave}">${rotulo}</label>
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

function alternarTodosDoGrupoTeoricaSTU(idGrupo, marcado) {
    const container = document.getElementById(idGrupo + "-teorica-stu");
    if (!container) return;

    const checkboxes = container.querySelectorAll('.chk-coluna-teorica');
    checkboxes.forEach(chk => { chk.checked = marcado; });

    aplicarFiltrosTeoricaSTU();
}

// 10. RENDERIZAÇÃO DO GRÁFICO HISTÓRICO ANUAL
async function carregarDadosAnuaisTeoricaAPI(modal = 'stu') {
    const anoSelecionado = document.getElementById('select-ano-teorica-stu')?.value || '2026';
    const canvas = document.getElementById('graficoTeoricaMensalSTU');
    if (!canvas || typeof Chart === 'undefined') return;

    try {
        const resp = await fetch(`${URL_API_TEORICA}/indicadores/historico-anual?ano=${anoSelecionado}&modal=stu_teorica`);
        const json = await resp.json();

        if (!json.sucesso || !json.dados || json.dados.length === 0) return;

        const labelsMeses = json.dados.map(d => d.mes_ano);
        const ipkValores = json.dados.map(d => parseFloat(d.ipk_medio || 0).toFixed(2));
        const custoValores = json.dados.map(d => parseFloat(d.custo_total || 0));
        const arrecadacaoValores = json.dados.map(d => parseFloat(d.arrecadacao_total || 0));
        const subsidioValores = json.dados.map(d => parseFloat(d.subsidio_total || 0));

        if (graficoAnualTeoricaInstance) {
            graficoAnualTeoricaInstance.destroy();
        }

        graficoAnualTeoricaInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labelsMeses,
                datasets: [
                    { type: 'line', label: 'IPK Médio', data: ipkValores, borderColor: '#ffc107', borderWidth: 3, yAxisID: 'yIPK', fill: false },
                    { label: 'Custo Total (R$)', data: custoValores, backgroundColor: 'rgba(220, 53, 69, 0.8)' },
                    { label: 'Arrecadação Total (R$)', data: arrecadacaoValores, backgroundColor: 'rgba(25, 135, 84, 0.8)' },
                    { label: 'Subsídio Total (R$)', data: subsidioValores, backgroundColor: 'rgba(13, 110, 253, 0.8)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Valores Financeiros (R$)' } },
                    yIPK: { position: 'right', beginAtZero: false, title: { display: true, text: 'IPK' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    } catch (e) {
        console.error("❌ Erro ao carregar gráfico anual da Operação Teórica:", e);
    }
}

// 11. EXPORTAÇÃO EXCEL
function exportarTabelaExcelTeoricaSTU() {
    if (!listaTeoricaFiltradaAtual || listaTeoricaFiltradaAtual.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(listaTeoricaFiltradaAtual);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teorica_STU");
    XLSX.writeFile(wb, `operacao_teorica_stu.xlsx`);
}