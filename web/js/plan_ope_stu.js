/**
 * Módulo: plan_ope_stu.js
 * Descrição: Gestão da sub-aba STU (Sistema de Transporte Urbano).
 *            Inclui suporte a camadas de apoio espaciais, acordeão de métricas,
 *            filtro sincronizado de veículos elétricos, indicadores de frota e gráficos.
 */

const URL_API_STU = API_URL;

// Variáveis Globais do STU
let mapaHistorico = null;
let camadaHistoricoLinhas = null;
let dadosBrutosHistorico = [];
let listaHistoricoFiltradaAtual = [];
let dadosBrutosFrotaSTU = [];
let listaFrotaSTUFiltradaAtual = [];

// Instâncias dos Gráficos e Camadas
let graficoHistoricoMensalInstance = null;
let graficoCombustivelInstance = null;
let camadasEstaticasHistorico = {};

let linhasZeroCarregamentoCache = [];
let filtroZeroCarregamentoAtivo = false;
let filtroEletricoAtivo = false;
let ordemColunasCustomizada = [];

// =========================================================================
// 1. DICIONÁRIO COMPLETO DE RÓTULOS E GRUPOS DE COLUNAS
// =========================================================================
const MAPA_ROTULOS_HISTORICO = {
    // Identificação Básica
    LINHA_CODIGO: 'Código',
    LINHA_DENOMINACAO: 'Denominação',
    SENTIDO: 'Sentido',
    OPERADORA: 'Operadora',
    BACIA_OPERACAO: 'Bacia Operação',
    DATA_PICO: 'Data Pico',
    DIA_SEMANA: 'Dia da Semana',
    DIAS_UTEIS_MES: 'Dias Úteis/Mês',
    MOTIVO_SEM_GEOMETRIA: 'Inconsistência Geométrica',
    
    // Oferta, Frota & Operacional
    FROTA_ALOCADA: 'Frota Alocada',
    FROTA_REAPROVEITADA: 'Frota Reaprov.',
    FROTA_TOTAL: 'Frota Total',
    FROTA_PLANEJADA: 'Frota Planejada',
    FROTA_REALIZADA: 'Frota Realizada',
    DURACAO: 'Duração',
    HORAS_DIA: 'Horas/Dia',
    VELOCIDADE_MEDIA: 'Vel. Média (km/h)',
    VIAGENS_PLANEJADAS: 'Viagens Planejadas',
    VIAGENS_REALIZADAS: 'Viagens Realizadas',
    EXTENSAO_KM: 'Extensão (km)',
    KM_DIA: 'KM / Dia',
    KM_MES: 'KM / Mês',
    KM_ANO: 'KM / Ano',
    HW_OPERADOR: 'HW Operador',
    HW_PASSAGEIRO: 'HW Passageiro',
    LUGARES_OFERTADOS: 'Lugares Ofertados',
    LUGARES_VIAGEM: 'Lugares / Viagem',
    
    // Demanda & Passageiros
    TOTAL_PASSAGEIROS: 'Total Passageiros',
    TOTAL_PAGANTES: 'Pagantes',
    TOTAL_ESTUDANTES: 'Estudantes',
    TOTAL_GRATUIDADES: 'Gratuidades',
    TOTAL_INTEGRACOES: 'Integrações',
    PASSAGEIROS_ELEGIVEIS_SUBSIDIO: 'Pass. Subsídio',
    PASSAGEIROS_MES: 'Pass. Mês',
    PASSAGEIROS_ANO: 'Pass. Ano',
    PASSAGEIROS_VIAGEM: 'Pass. / Viagem',
    PERC_INTEGRACOES: '% Integrações',
    PERC_GRATUIDADES: '% Gratuidades',
    PERC_ESTUDANTES: '% Estudantes',
    
    // Financeiro & Indicadores
    TARIFA_USUARIO: 'Tarifa Usuário',
    TARIFA_TECNICA: 'Tarifa Técnica',
    ARRECADACAO_DIA: 'Arrecadação Dia',
    CUSTO_SERVICO: 'Custo do Serviço',
    VALOR_SUBSIDIO: 'Subsídio',
    RECEITA_VIAGEM: 'Receita / Viagem',
    RECEITA_VEICULO: 'Receita / Veículo',
    RECEITA_KM: 'Receita / KM',
    IPK: 'IPK',
    IRP: 'IRP',
    DEMANDA_OFERTA: 'Demanda / Oferta'
};

// Grupos do Acordeão (Excluídos: FLG_DIVERGENCIA_SENTIDO, ID_LINHA e FLG_DIVERGENCIA_FROTA)
const COLUNAS_POR_GRUPO = {
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
        { chave: 'FROTA_TOTAL', checado: true },
        { chave: 'FROTA_PLANEJADA', checado: true },
        { chave: 'FROTA_REALIZADA', checado: true },
        { chave: 'DURACAO', checado: false },
        { chave: 'HORAS_DIA', checado: false },
        { chave: 'VELOCIDADE_MEDIA', checado: false },
        { chave: 'VIAGENS_PLANEJADAS', checado: true },
        { chave: 'VIAGENS_REALIZADAS', checado: true },
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
        { chave: 'TOTAL_ESTUDANTES', checado: false },
        { chave: 'TOTAL_GRATUIDADES', checado: false },
        { chave: 'TOTAL_INTEGRACOES', checado: false },
        { chave: 'PASSAGEIROS_ELEGIVEIS_SUBSIDIO', checado: false },
        { chave: 'PASSAGEIROS_MES', checado: false },
        { chave: 'PASSAGEIROS_ANO', checado: false },
        { chave: 'PASSAGEIROS_VIAGEM', checado: false },
        { chave: 'PERC_INTEGRACOES', checado: false },
        { chave: 'PERC_GRATUIDADES', checado: false },
        { chave: 'PERC_ESTUDANTES', checado: false }
    ],
    'grupo-colunas-financeiro': [
        { chave: 'TARIFA_USUARIO', checado: true },
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

// =========================================================================
// 2. INICIALIZAÇÃO E EVENTOS DO MAPA
// =========================================================================
document.addEventListener("DOMContentLoaded", function () {
    gerarCheckboxesAcordeaoHistorico();
    inicializarAbaHistorico();
});

function garantirInicializacaoMapaHistorico() {
    if (!mapaHistorico) {
        if (typeof inicializarMapaBase === 'function') {
            mapaHistorico = inicializarMapaBase('mapa-historico');
        } else if (typeof L !== 'undefined') {
            mapaHistorico = L.map('mapa-historico').setView([-15.793889, -47.882778], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(mapaHistorico);
        }

        if (mapaHistorico && typeof ativarControlesMouseMapa === 'function') {
            ativarControlesMouseMapa(mapaHistorico, filtrarPorAreaHistorico, limparSelecaoAreaHistorico);
        }

        const elMapa = document.getElementById('mapa-historico');
        if (elMapa) elMapa.style.cursor = 'crosshair';
    }
}

function inicializarAbaHistorico() {
    garantirInicializacaoMapaHistorico();

    const abaSTUTab = document.getElementById("sub-stu-tab");
    const abaOperadoTab = document.getElementById("aba-operado-tab");

    const carregarEMostrarMapaHistorico = () => {
        setTimeout(() => {
            garantirInicializacaoMapaHistorico();
            if (mapaHistorico) mapaHistorico.invalidateSize();
            if (dadosBrutosHistorico && dadosBrutosHistorico.length > 0) {
                renderizarMapaHistorico(dadosBrutosHistorico);
            }
        }, 200);
    };

    if (abaSTUTab) abaSTUTab.addEventListener("shown.bs.tab", carregarEMostrarMapaHistorico);
    if (abaOperadoTab) abaOperadoTab.addEventListener("shown.bs.tab", carregarEMostrarMapaHistorico);

    carregarDatasHistorico();
}

// =========================================================================
// 3. CONSULTAS À API
// =========================================================================
async function carregarDatasHistorico() {
    const selectData = document.getElementById("select-data-historico");
    if (!selectData) return;

    try {
        const resp = await fetch(`${URL_API_STU}/indicadores/datas-disponiveis?tabela=pico`);
        const json = await resp.json();

        if (json.sucesso && json.datas && json.datas.length > 0) {
            selectData.innerHTML = json.datas.map(d => `<option value="${d}">${d}</option>`).join('');
            carregarDadosHistoricoPorData();
        } else {
            selectData.innerHTML = '<option value="">Nenhuma data encontrada</option>';
        }
    } catch (erro) {
        console.error("❌ Erro ao carregar datas do STU:", erro);
        selectData.innerHTML = '<option value="">Erro ao conectar à API</option>';
    }
}

async function carregarDadosHistoricoPorData(modal = 'stu') {
    const selectData = document.getElementById("select-data-historico");
    const labelDiaSemana = document.getElementById("info-dia-semana-historico");
    const corpoTabela = document.getElementById("corpo-tabela-historico");

    if (!selectData || !selectData.value) return;
    const dataSelecionada = selectData.value;

    if (labelDiaSemana) {
        const diaSemana = (typeof obterDiaDaSemana === 'function') ? obterDiaDaSemana(dataSelecionada) : '';
        labelDiaSemana.innerHTML = diaSemana ? `🗓️ <b>${diaSemana}</b>` : "";
    }

    if (corpoTabela) {
        corpoTabela.innerHTML = '<tr><td colspan="20" class="text-center text-primary py-4">🔄 A carregar indicadores...</td></tr>';
    }

    carregarDadosAnuaisAPI(modal);

    try {
        const [respLinhas, respFrota] = await Promise.all([
        fetch(`${URL_API_STU}/indicadores/historico-completo?data=${encodeURIComponent(dataSelecionada)}&modal=stu`),
        fetch(`${URL_API_STU}/frota/historico-pico?data_pico=${encodeURIComponent(dataSelecionada)}`)
    ]);

        const jsonLinhas = await respLinhas.json();
        const jsonFrota = await respFrota.json();

        if (jsonFrota.sucesso && jsonFrota.dados) {
            dadosBrutosFrotaSTU = jsonFrota.dados || [];
        } else {
            dadosBrutosFrotaSTU = [];
        }

        if (jsonLinhas.sucesso && jsonLinhas.dados) {
            dadosBrutosHistorico = jsonLinhas.dados;

            preencherDropdownOperadorasHistorico(dadosBrutosHistorico);
            renderizarMapaHistorico(dadosBrutosHistorico);
            preencherTabelaHistorico(dadosBrutosHistorico, dataSelecionada);
            renderizarTabelaFrotaSTU(dadosBrutosHistorico);
        } else {
            if (corpoTabela) {
                corpoTabela.innerHTML = `<tr><td colspan="20" class="text-center text-danger py-4">${jsonLinhas.erro || "Sem dados para esta data."}</td></tr>`;
            }
            zerarCardsEListasHistorico();
            renderizarTabelaFrotaSTU([]);
        }
    } catch (erro) {
        console.error(`❌ Erro ao buscar dados do modal ${modal}:`, erro);
        if (corpoTabela) {
            corpoTabela.innerHTML = `<tr><td colspan="20" class="text-center text-danger py-4">Erro de conexão ao carregar dados.</td></tr>`;
        }
    }
}

function preencherDropdownOperadorasHistorico(dados) {
    const selectOp = document.getElementById("select-operadora-historico");
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

// =========================================================================
// 4. FILTROS COMBINADOS
// =========================================================================

/**
 * Alterna o estado do botão de filtro de linhas com veículos elétricos.
 */
function alternarFiltroEletricoHistorico() {
    filtroEletricoAtivo = !filtroEletricoAtivo;
    const btn = document.getElementById("btn-filtro-eletrico-historico");

    if (btn) {
        if (filtroEletricoAtivo) {
            btn.classList.remove("btn-outline-success");
            btn.classList.add("btn-success", "text-white");
            btn.innerHTML = "⚡ Linhas c/ Elétricos (Ativo)";
        } else {
            btn.classList.remove("btn-success", "text-white");
            btn.classList.add("btn-outline-success");
            btn.innerHTML = "⚡ Apenas Linhas c/ Elétricos";
        }
    }

    aplicarFiltrosHistorico();
}

/**
 * Função central de aplicação de filtros (Busca por texto, Operadora e Tecnologia Limpa Inversa).
 */
function aplicarFiltrosHistorico() {
    if (!dadosBrutosHistorico || !dadosBrutosHistorico.length) return;

    const inputTexto = document.getElementById("input-filtrar-linha-historico");
    const selectOp = document.getElementById("select-operadora-historico");

    const termoTexto = inputTexto ? inputTexto.value.trim().toLowerCase() : "";
    const operadoraSelecionada = selectOp ? selectOp.value.trim().toLowerCase() : "";
    const codigosBusca = termoTexto ? termoTexto.split(',').map(c => c.trim()).filter(Boolean) : [];

    // Mapeia na frota quais linhas possuem veículos com combustível ELÉTRICO
    const codigosLinhasEletricas = new Set();
    const idsLinhasEletricas = new Set();

    if (dadosBrutosFrotaSTU && dadosBrutosFrotaSTU.length > 0) {
        dadosBrutosFrotaSTU.forEach(veiculo => {
            const comb = String(
                veiculo.TIPO_COMBUSTIVEL || veiculo.tipo_combustivel || 
                veiculo.COMBUSTIVEL || veiculo.combustivel || ""
            ).toUpperCase();

            if (comb.includes("ELÉTRICO") || comb.includes("ELETRICO") || comb.includes("ELÉTRICA") || comb.includes("ELETRICA")) {
                const codLinha = String(
                    veiculo.LINHA_CODIGO || veiculo.linha_codigo || 
                    veiculo.CODIGO_LINHA || veiculo.codigo_linha || ""
                ).toLowerCase().trim();
                
                if (codLinha && codLinha !== "null" && codLinha !== "undefined") {
                    codigosLinhasEletricas.add(codLinha);
                }

                const idLinha = String(veiculo.ID_LINHA || veiculo.id_linha || "").trim();
                if (idLinha && idLinha !== "null" && idLinha !== "undefined") {
                    idsLinhasEletricas.add(idLinha);
                }
            }
        });
    }

    // Filtra os dados da tabela de indicadores cruzando as condições
    const dadosFiltrados = dadosBrutosHistorico.filter(item => {
        const codigoLinha = String(item.LINHA_CODIGO || item.linha_codigo || "").toLowerCase().trim();
        const idLinhaStr = String(item.ID_LINHA || item.id_linha || "").trim();

        // 1. Filtro por itinerário / texto
        const bateuTexto = codigosBusca.length === 0 || codigosBusca.some(busca => codigoLinha.includes(busca));

        // 2. Filtro por operadora
        const operadora = String(item.OPERADORA || item.operadora || "").toLowerCase();
        const bateuOperadora = !operadoraSelecionada || operadora.includes(operadoraSelecionada);

        // 3. Filtro Inverso: Apenas Linhas c/ Veículos Elétricos na Frota
        let bateuEletrico = true;
        if (filtroEletricoAtivo) {
            bateuEletrico = codigosLinhasEletricas.has(codigoLinha) || idsLinhasEletricas.has(idLinhaStr);
        }

        return bateuTexto && bateuOperadora && bateuEletrico;
    });

    const dataSelecionada = document.getElementById('select-data-historico')?.value || '';

    preencherTabelaHistorico(dadosFiltrados, dataSelecionada);
    renderizarMapaHistorico(dadosFiltrados);
    renderizarTabelaFrotaSTU(dadosFiltrados);
}

function filtrarLinhaHistorico() { aplicarFiltrosHistorico(); }
function filtrarPorOperadoraHistorico() { aplicarFiltrosHistorico(); }

/**
 * Reseta todos os filtros e desativa o estado do botão elétrico.
 */
function limparFiltrosHistorico() {
    const inputTexto = document.getElementById("input-filtrar-linha-historico");
    const selectOp = document.getElementById("select-operadora-historico");
    const btnEletrico = document.getElementById("btn-filtro-eletrico-historico");

    if (inputTexto) inputTexto.value = "";
    if (selectOp) selectOp.value = "";

    filtroEletricoAtivo = false;

    if (btnEletrico) {
        btnEletrico.classList.remove("btn-success", "text-white");
        btnEletrico.classList.add("btn-outline-success");
        btnEletrico.innerHTML = "⚡ Apenas Linhas c/ Elétricos";
    }

    aplicarFiltrosHistorico();
}

function filtrarPorAreaHistorico(bounds) {
    const linhasFiltradas = [];

    if (camadaHistoricoLinhas) {
        camadaHistoricoLinhas.eachLayer(layer => {
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

    const dataSelecionada = document.getElementById('select-data-historico')?.value || '';
    preencherTabelaHistorico(linhasFiltradas, dataSelecionada);
    renderizarTabelaFrotaSTU(linhasFiltradas);
}

/**
 * Limpa a seleção espacial do mapa no Planejado vs. Operado (STU)
 * e reseta o campo de filtro por itinerário.
 */
function limparSelecaoAreaHistorico() {
    // 1. Localiza o campo de entrada do filtro por itinerário e limpa o texto digitado
    const inputTexto = document.getElementById("input-filtrar-linha-historico");
    if (inputTexto) {
        inputTexto.value = "";
    }

    // 2. Restaura a cor e opacidade padrão das linhas do mapa
    if (camadaHistoricoLinhas) {
        camadaHistoricoLinhas.eachLayer(layer => {
            layer.setStyle({ 
                color: '#198754', 
                weight: 3, 
                opacity: 0.8 
            });
        });
    }

    // 3. Re-aplica os filtros gerais para manter a tabela e o mapa sincronizados
    aplicarFiltrosHistorico();
}

// =========================================================================
// VARIÁVEIS GLOBAIS DE CONTROLE DE ESTADO DOS FILTROS DIAGNÓSTICOS
// =========================================================================
let filtroSemCarregamentoAtivo = false;
let filtroNaoOperadoAtivo = false;
let filtroVistoriasVencidasAtivo = false;
let filtroInconsistenciasAtivo = false;

/**
 * 1. Filtra linhas que foram OPERADAS (Viagens Realizadas > 0), mas registaram ZERO Passageiros.
 */
function filtrarLinhasSemCarregamento() {
    filtroSemCarregamentoAtivo = !filtroSemCarregamentoAtivo;
    filtroNaoOperadoAtivo = false;
    filtroInconsistenciasAtivo = false;
    filtroVistoriasVencidasAtivo = false;

    const subtexto = document.getElementById('subtexto-sem-carregamento');

    if (filtroSemCarregamentoAtivo) {
        const linhasSemCarregamento = dadosBrutosHistorico.filter(item => {
            const viagensReal = parseFloat(item.VIAGENS_REALIZADAS ?? item.viagens_realizadas ?? 0);
            const pass = parseFloat(item.TOTAL_PASSAGEIROS ?? item.total_passageiros ?? 0);
            return viagensReal > 0 && pass === 0;
        });

        preencherTabelaHistorico(linhasSemCarregamento, document.getElementById('select-data-historico')?.value || '');
        renderizarMapaHistorico(linhasSemCarregamento);
        renderizarTabelaFrotaSTU(linhasSemCarregamento);

        if (subtexto) subtexto.innerHTML = "<b>Filtrando:</b> operadas sem passageiros. (Clique p/ limpar)";
    } else {
        aplicarFiltrosHistorico();
        if (subtexto) subtexto.innerText = "Linhas operadas no dia sem registro de passageiros.";
    }

    const tabelaEl = document.getElementById('titulo-tabela-historico');
    if (tabelaEl) tabelaEl.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 2. Filtra linhas que foram PLANEJADAS (Viagens Planejadas > 0), mas NÃO FORAM OPERADAS (Viagens Realizadas = 0).
 */
function filtrarLinhasNaoOperadas() {
    filtroNaoOperadoAtivo = !filtroNaoOperadoAtivo;
    filtroSemCarregamentoAtivo = false;
    filtroInconsistenciasAtivo = false;
    filtroVistoriasVencidasAtivo = false;

    const subtexto = document.getElementById('subtexto-nao-operado');

    if (filtroNaoOperadoAtivo) {
        const linhasNaoOperadas = dadosBrutosHistorico.filter(item => {
            const viagensPlan = parseFloat(item.VIAGENS_PLANEJADAS ?? item.viagens_planejadas ?? 0);
            const viagensReal = parseFloat(item.VIAGENS_REALIZADAS ?? item.viagens_realizadas ?? 0);
            return viagensPlan > 0 && viagensReal === 0;
        });

        preencherTabelaHistorico(linhasNaoOperadas, document.getElementById('select-data-historico')?.value || '');
        renderizarMapaHistorico(linhasNaoOperadas);
        renderizarTabelaFrotaSTU(linhasNaoOperadas);

        if (subtexto) subtexto.innerHTML = "<b>Filtrando:</b> planejadas e não operadas. (Clique p/ limpar)";
    } else {
        aplicarFiltrosHistorico();
        if (subtexto) subtexto.innerText = "Linhas planejadas que não realizaram viagens.";
    }

    const tabelaEl = document.getElementById('titulo-tabela-historico');
    if (tabelaEl) tabelaEl.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 3. Filtro Interativo: Inconsistências Geométricas (TDMAX / BDG)
 */
function filtrarLinhasInconsistentes() {
    filtroInconsistenciasAtivo = !filtroInconsistenciasAtivo;
    filtroSemCarregamentoAtivo = false;
    filtroNaoOperadoAtivo = false;
    filtroVistoriasVencidasAtivo = false;

    const subtexto = document.getElementById('subtexto-inconsistencia');

    if (filtroInconsistenciasAtivo) {
        const linhasInconsistentes = dadosBrutosHistorico.filter(item => {
            const motivo = String(item.MOTIVO_SEM_GEOMETRIA || item.motivo_sem_geometria || '').trim().toUpperCase();
            return motivo !== '' && motivo !== 'OK' && motivo !== 'NULL' && motivo !== 'UNDEFINED';
        });

        preencherTabelaHistorico(linhasInconsistentes, document.getElementById('select-data-historico')?.value || '');
        renderizarMapaHistorico(linhasInconsistentes);
        renderizarTabelaFrotaSTU(linhasInconsistentes);

        if (subtexto) subtexto.innerHTML = "<b>Filtrando:</b> erros de cadastro/geometria. (Clique para limpar)";
    } else {
        aplicarFiltrosHistorico();
        if (subtexto) subtexto.innerText = "Linhas operadas com pendência de geometria.";
    }

    const tabelaEl = document.getElementById('titulo-tabela-historico');
    if (tabelaEl) tabelaEl.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 4. Filtro Interativo Cruzado: Vistorias Vencidas (Correlaciona Veículos x Linhas x Mapa)
 */
function filtrarFrotaVistoriasVencidas() {
    filtroVistoriasVencidasAtivo = !filtroVistoriasVencidasAtivo;
    filtroSemCarregamentoAtivo = false;
    filtroNaoOperadoAtivo = false;
    filtroInconsistenciasAtivo = false;

    if (filtroVistoriasVencidasAtivo) {
        const codigosLinhasVencidas = new Set();
        const idsLinhasVencidas = new Set();

        dadosBrutosFrotaSTU.forEach(veiculo => {
            const vistoria = String(veiculo.SITUACAO_VISTORIA_PICO || veiculo.situacao_vistoria_pico || '').toUpperCase();
            if (vistoria.includes('VENCIDA')) {
                const codLinha = String(veiculo.LINHA_CODIGO || veiculo.codigo_linha || veiculo.CODIGO_LINHA || '').toLowerCase().trim();
                if (codLinha) codigosLinhasVencidas.add(codLinha);

                const idLinha = String(veiculo.ID_LINHA || veiculo.id_linha || '').trim();
                if (idLinha) idsLinhasVencidas.add(idLinha);
            }
        });

        const linhasComVistoriaVencida = dadosBrutosHistorico.filter(item => {
            const cod = String(item.LINHA_CODIGO || item.linha_codigo || '').toLowerCase().trim();
            const id = String(item.ID_LINHA || item.id_linha || '').trim();
            return codigosLinhasVencidas.has(cod) || idsLinhasVencidas.has(id);
        });

        preencherTabelaHistorico(linhasComVistoriaVencida, document.getElementById('select-data-historico')?.value || '');
        renderizarMapaHistorico(linhasComVistoriaVencida);
        renderizarTabelaFrotaSTU(linhasComVistoriaVencida);

    } else {
        aplicarFiltrosHistorico();
    }

    const tabelaFrotaEl = document.getElementById('tabela-frota-stu');
    if (tabelaFrotaEl) tabelaFrotaEl.scrollIntoView({ behavior: 'smooth' });
}

// =========================================================================
// 5. CAMADAS DE APOIO ESPACIAIS (LEAFLET)
// =========================================================================
async function alternarCamadaEstaticaHistorico(nomeTabela, ativada) {
    if (!mapaHistorico) return;

    if (!ativada) {
        if (camadasEstaticasHistorico[nomeTabela]) {
            mapaHistorico.removeLayer(camadasEstaticasHistorico[nomeTabela]);
        }
        return;
    }

    if (camadasEstaticasHistorico[nomeTabela]) {
        camadasEstaticasHistorico[nomeTabela].addTo(mapaHistorico);
        return;
    }

    try {
        const resp = await fetch(`${URL_API_STU}/mapa/camada-estatica/${nomeTabela}`);
        const geojson = await resp.json();

        if (!geojson || !geojson.features) return;

        if (nomeTabela === 'tb_regioes_administrativas') {
            camadasEstaticasHistorico[nomeTabela] = L.geoJSON(geojson, {
                style: { color: '#6a1b9a', weight: 2, fillColor: '#8e24aa', fillOpacity: 0.15 },
                onEachFeature: (feature, layer) => {
                    const p = feature.properties || {};
                    const nomeRA = p.ra_nome || p.nm_ra || p.NOME || p.nome || p.RA || 'Região Administrativa';
                    layer.bindTooltip(`<b>🏛️ RA: ${nomeRA}</b>`, { sticky: true });
                }
            });
        } 
        else if (nomeTabela === 'tb_ponto_parada_v2025') {
            camadasEstaticasHistorico[nomeTabela] = L.geoJSON(geojson, {
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, { radius: 5, fillColor: '#ff8c00', color: '#ffffff', weight: 1.5, opacity: 1, fillOpacity: 0.9 });
                },
                onEachFeature: (feature, layer) => {
                    const p = feature.properties || {};
                    const codPonto = p.cod_parada_v2025 || p.cod_ponto || p.CODIGO || p.codigo || 'S/N';
                    const descPonto = p.endereco || p.DESCRICAO || p.ENDERECO || '';
                    layer.bindTooltip(`<b>🚏 Parada: ${codPonto}</b><br>${descPonto}`, { sticky: true });
                }
            });
        }
        else if (nomeTabela === 'tb_terminais') {
            camadasEstaticasHistorico[nomeTabela] = L.geoJSON(geojson, {
                pointToLayer: (feature, latlng) => {
                    const p = feature.properties || {};
                    const nomeTerm = p.nome || p.NOME || 'Terminal';
                    const iconHtml = `<div style="background-color: #198754; color: #ffffff; padding: 3px 8px; border-radius: 10px; border: 2px solid #ffffff; font-size: 11px; font-weight: 700; white-space: nowrap;">🏣 ${nomeTerm}</div>`;
                    return L.marker(latlng, { icon: L.divIcon({ className: 'custom-terminal-icon-hist', html: iconHtml, iconSize: [null, 24] }) });
                },
                onEachFeature: (feature, layer) => {
                    const p = feature.properties || {};
                    const nomeTerm = p.nome || p.NOME || 'Terminal de Ônibus';
                    layer.bindTooltip(`<b>🏣 ${nomeTerm}</b>`, { sticky: true });
                }
            });
        } else {
            camadasEstaticasHistorico[nomeTabela] = L.geoJSON(geojson);
        }

        camadasEstaticasHistorico[nomeTabela].addTo(mapaHistorico);

    } catch (e) {
        console.error("❌ Erro ao carregar camada estática no STU:", e);
    }
}

// =========================================================================
// 6. INDICADORES DE FROTA E GRÁFICO DE COMBUSTÍVEL
// =========================================================================
function calcularECardsFrotaSTU(frotaFiltrada) {
    if (!frotaFiltrada || frotaFiltrada.length === 0) {
        zerarCardsFrota();
        return;
    }

    const veiculosUnicos = new Set();
    let somaIdades = 0;
    let totalVeiculosComIdade = 0;
    let totalVistoriasVencidas = 0;
    let kmTotalEstimada = 0;
    const contagemCombustivel = {};

    frotaFiltrada.forEach(item => {
        const id_veiculo = item.ID_VEICULO || item.id_veiculo || item.NR_PLACA || item.nr_placa;
        const km = parseFloat(item.KM_ESTIMADO_VEICULO || item.km_estimado_veiculo || 0);
        if (!isNaN(km)) kmTotalEstimada += km;

        if (id_veiculo && !veiculosUnicos.has(id_veiculo)) {
            veiculosUnicos.add(id_veiculo);

            const anoFab = parseInt(item.ANO_FABRICACAO || item.ano_fabricacao || item.ANO_VEICULO || 0, 10);
            const idadeDireta = parseInt(item.IDADE_VEICULO || item.idade_veiculo || 0, 10);
            let idade = idadeDireta;
            if (idade <= 0 && anoFab > 0) idade = 2026 - anoFab;

            if (idade >= 0) {
                somaIdades += idade;
                totalVeiculosComIdade++;
            }

            const vistoria = String(item.SITUACAO_VISTORIA_PICO || item.situacao_vistoria_pico || '').toUpperCase();
            if (vistoria.includes('VENCIDA')) {
                totalVistoriasVencidas++;
            }

            const comb = (item.TIPO_COMBUSTIVEL || item.tipo_combustivel || item.COMBUSTIVEL || item.combustivel || 'DIESEL').toUpperCase();
            contagemCombustivel[comb] = (contagemCombustivel[comb] || 0) + 1;
        }
    });

    const totalUnicos = veiculosUnicos.size || 1;
    const idadeMedia = totalVeiculosComIdade > 0 ? (somaIdades / totalVeiculosComIdade) : 0;
    const percVencidas = (totalVistoriasVencidas / totalUnicos) * 100;

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setT('card-frota-idade-media', `${idadeMedia.toFixed(1).replace('.', ',')} anos`);
    setT('card-frota-vistorias-vencidas', `${totalVistoriasVencidas} (${percVencidas.toFixed(1).replace('.', ',')}%)`);
    setT('card-frota-km-total', `${kmTotalEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`);

    renderizarGraficoCombustivelFrota(contagemCombustivel);
}

/**
 * Zera todos os cartões de métricas da frota física e limpa o gráfico de combustível.
 */
function zerarCardsFrota() {
    // 1. Zera os textos dos cards numéricos
    ['card-frota-idade-media', 'card-frota-vistorias-vencidas', 'card-frota-km-total']
        .forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.innerText = '-'; 
        });

    // 2. Zera a badge de contagem de veículos
    const badgeTotal = document.getElementById("badge-total-frota-stu");
    if (badgeTotal) badgeTotal.innerText = 'Veículos: 0';

    // 3. Desativa o botão de exportação Excel
    const btnExcel = document.getElementById("btn-exportar-excel-frota-stu");
    if (btnExcel) btnExcel.disabled = true;

    // 4. Destrói o gráfico de combustível para não manter dados antigos na tela
    if (graficoCombustivelInstance) {
        graficoCombustivelInstance.destroy();
        graficoCombustivelInstance = null;
    }
}

function renderizarGraficoCombustivelFrota(dadosCombustivel) {
    const ctx = document.getElementById('graficoCombustivelFrota');
    if (!ctx) return;

    const labels = Object.keys(dadosCombustivel);
    const valores = Object.values(dadosCombustivel);

    if (graficoCombustivelInstance) {
        graficoCombustivelInstance.destroy();
    }

    const paletaCores = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0'];

    graficoCombustivelInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: paletaCores.slice(0, labels.length),
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: { size: 10, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.raw || 0;
                            const perc = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${val} (${perc}%)`;
                        }
                    }
                }
            }
        }
    });
}

// =========================================================================
// 7. TABELA DE FROTA (COM SUPORTE A LINHAS NÃO OPERADAS E OPERADORA)
// =========================================================================

/**
 * Renderiza a tabela de detalhamento da frota física com cruzamento estrito por CHAVE_VINCULO.
 * @param {Array} linhasVisiveis - Lista de linhas atualmente visíveis na tabela macro.
 */
function renderizarTabelaFrotaSTU(linhasVisiveis) {
    const tbody = document.getElementById("corpo-tabela-frota-stu") || 
                  document.getElementById("corpo-frota-stu") || 
                  document.querySelector("#tabela-frota-stu tbody");
                  
    const badgeTotal = document.getElementById("badge-total-frota-stu");
    const btnExcel = document.getElementById("btn-exportar-excel-frota-stu");
    
    if (!tbody) return;

    // Se nenhuma linha estiver selecionada na tabela macro, exibe 0 veículos!
    if (!linhasVisiveis || !Array.isArray(linhasVisiveis) || linhasVisiveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted py-3">Nenhum veículo associado às linhas selecionadas.</td></tr>';
        if (badgeTotal) badgeTotal.innerText = 'Veículos: 0';
        if (btnExcel) btnExcel.disabled = true;
        return;
    }

    // Criar conjunto de chaves únicas selecionadas na tabela macro
    const chavesMacroAtivas = new Set();
    linhasVisiveis.forEach(linha => {
        const idLinha = String(linha.ID_LINHA || linha.id_linha || '').trim();
        const sentido = String(linha.SENTIDO || linha.sentido || '').toUpperCase().trim();
        const dataPico = String(linha.DATA_PICO || linha.data_pico || '').trim();
        
        const chaveDireta = String(linha.CHAVE_VINCULO || linha.chave_vinculo || '').trim();
        if (chaveDireta) {
            chavesMacroAtivas.add(chaveDireta);
        } else if (idLinha && sentido && dataPico) {
            chavesMacroAtivas.add(`${idLinha}_${sentido}_${dataPico}`);
        }
    });

    // Filtrar a frota estritamente pelas chaves ativas
    const frotaFiltrada = (dadosBrutosFrotaSTU || []).filter(veiculo => {
        const idLinhaV = String(veiculo.ID_LINHA || veiculo.id_linha || '').trim();
        const sentidoV = String(veiculo.SENTIDO || veiculo.sentido || '').toUpperCase().trim();
        const dataV = String(veiculo.DATA_REFERENCIA || veiculo.data_referencia || veiculo.DATA_PICO || veiculo.data_pico || '').trim();
        
        const chaveV = String(veiculo.CHAVE_VINCULO || veiculo.chave_vinculo || '').trim();
        
        const pertenceASelecao = chavesMacroAtivas.has(chaveV) || chavesMacroAtivas.has(`${idLinhaV}_${sentidoV}_${dataV}`);
        
        if (!pertenceASelecao) return false;

        if (typeof filtroEletricoAtivo !== 'undefined' && filtroEletricoAtivo) {
            const comb = (veiculo.TIPO_COMBUSTIVEL || veiculo.tipo_combustivel || "").toString().toUpperCase();
            if (!comb.includes("ELÉTRICO") && !comb.includes("ELETRICO")) return false;
        }

        if (typeof filtroVistoriasVencidasAtivo !== 'undefined' && filtroVistoriasVencidasAtivo) {
            const vistoria = String(veiculo.SITUACAO_VISTORIA_PICO || veiculo.situacao_vistoria_pico || '').toUpperCase();
            if (!vistoria.includes('VENCIDA')) return false;
        }

        return true;
    });

    listaFrotaSTUFiltradaAtual = frotaFiltrada;

    // Se a busca resultar em zero veículos, exibe zero (sem acionar fallback de todos os veículos)
    if (frotaFiltrada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted py-3">Nenhum veículo corresponde à seleção atual.</td></tr>';
        if (badgeTotal) badgeTotal.innerText = 'Veículos: 0';
        if (btnExcel) btnExcel.disabled = true;
        return;
    }

    if (typeof calcularECardsFrotaSTU === 'function') {
        calcularECardsFrotaSTU(frotaFiltrada);
    }

    let htmlBody = '';
    const veiculosUnicos = new Set();

    frotaFiltrada.forEach(item => {
        try {
            const id_veiculo = item.ID_VEICULO || item.id_veiculo || item.PREFIXO || item.prefixo || '-';
            const placa = item.NR_PLACA || item.nr_placa || 'SEM PLACA';
            const operadora = item.OPERADORA || item.operadora || 'NÃO INFORMADO';
            const codigoLinhaExibicao = item.LINHA_CODIGO || item.linha_codigo || item.CODIGO_LINHA || item.codigo_linha || '-';
            const sentidoExibicao = item.SENTIDO || item.sentido || '-';
            const tipoVeiculo = item.TIPO_VEICULO || item.tipo_veiculo || 'ÔNIBUS BÁSICO';
            const combustivel = item.TIPO_COMBUSTIVEL || item.tipo_combustivel || 'DIESEL';

            const anoFabricacao = parseInt(item.ANO_FABRICACAO || item.ano_fabricacao || 0, 10);
            const idadeDireta = parseInt(item.IDADE_VEICULO || item.idade_veiculo || 0, 10);
            
            let idadeFormatada = '-';
            if (idadeDireta > 0) {
                idadeFormatada = `${idadeDireta} ano${idadeDireta > 1 ? 's' : ''}`;
            } else if (anoFabricacao > 0) {
                const idadeCalculada = 2026 - anoFabricacao;
                idadeFormatada = `${idadeCalculada} ano${idadeCalculada !== 1 ? 's' : ''}`;
            }

            const statusPermissao = item.STATUS_PERMISSAO || item.status_permissao || 'ATIVO';
            const situacaoVistoria = String(item.SITUACAO_VISTORIA_PICO || item.situacao_vistoria_pico || 'SEM REGISTRO');
            
            const capVeiculo = parseInt(item.CAPACIDADE_FINAL || item.capacidade_final || item.CAPACIDADE_VEICULO || item.capacidade_veiculo || 89, 10);
            const qtViagens = parseInt(item.QT_VIAGENS || item.qt_viagens || 1, 10);
            const qtPassageiros = parseInt(item.QT_PASSAGEIROS || item.qt_passageiros || 0, 10);
            const kmEstimada = parseFloat(item.KM_ESTIMADO_VEICULO || item.km_estimado_veiculo || 0);
            const capOfertadaTotal = capVeiculo * qtViagens;

            veiculosUnicos.add(id_veiculo);

            let badgeVistoria = `<span class="badge bg-success">${situacaoVistoria}</span>`;
            if (situacaoVistoria.toUpperCase().includes('VENCIDA')) {
                badgeVistoria = `<span class="badge bg-danger">${situacaoVistoria} ⚠️</span>`;
            } else if (situacaoVistoria.toUpperCase().includes('SEM REGISTRO')) {
                badgeVistoria = `<span class="badge bg-secondary">${situacaoVistoria}</span>`;
            }

            const kmFormatada = isNaN(kmEstimada) ? '0,00 km' : `${kmEstimada.toFixed(2).replace('.', ',')} km`;

            htmlBody += `
                <tr>
                    <td><b>${id_veiculo}</b></td>
                    <td><span class="badge bg-light text-dark border">${placa}</span></td>
                    <td><span class="badge bg-outline-primary text-dark border">${operadora}</span></td>
                    <td><span class="badge bg-success">${codigoLinhaExibicao}</span></td>
                    <td>${sentidoExibicao}</td>
                    <td>${tipoVeiculo}</td>
                    <td><span class="badge bg-outline-secondary text-dark border">${combustivel}</span></td>
                    <td><b>${idadeFormatada}</b></td>
                    <td>${statusPermissao}</td>
                    <td>${badgeVistoria}</td>
                    <td>${capVeiculo.toLocaleString('pt-BR')}</td>
                    <td>${qtViagens.toLocaleString('pt-BR')}</td>
                    <td><b>${capOfertadaTotal.toLocaleString('pt-BR')}</b></td>
                    <td>${qtPassageiros.toLocaleString('pt-BR')}</td>
                    <td>${kmFormatada}</td>
                </tr>
            `;
        } catch (err) {
            console.error("⚠️ Erro ao renderizar veículo:", err);
        }
    });

    tbody.innerHTML = htmlBody;

    if (badgeTotal) badgeTotal.innerText = `Veículos: ${veiculosUnicos.size.toLocaleString('pt-BR')}`;
    if (btnExcel) btnExcel.disabled = false;
}

// =========================================================================
// 8. MAPA LEAFLET DE LINHAS
// =========================================================================
function renderizarMapaHistorico(dados) {
    garantirInicializacaoMapaHistorico();
    if (!mapaHistorico) return;

    if (camadaHistoricoLinhas) {
        try { mapaHistorico.removeLayer(camadaHistoricoLinhas); } catch (e) {}
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
        camadaHistoricoLinhas = L.geoJSON({ type: "FeatureCollection", features: features }, {
            style: { color: '#198754', weight: 3, opacity: 0.8 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const cod = p.LINHA_CODIGO || p.linha_codigo || '-';
                const denom = p.LINHA_DENOMINACAO || p.linha_denominacao || '';
                const pass = parseInt(p.TOTAL_PASSAGEIROS ?? 0, 10) || 0;
                layer.bindTooltip(`<b>🚌 Linha ${cod}</b><br>${denom}<br><b>Passageiros:</b> ${pass.toLocaleString('pt-BR')}`);
            }
        }).addTo(mapaHistorico);

        mapaHistorico.invalidateSize();
        const bounds = camadaHistoricoLinhas.getBounds();
        if (bounds && bounds.isValid()) {
            mapaHistorico.fitBounds(bounds, { padding: [20, 20], maxZoom: 12, animate: false });
        }
    }
}

// =========================================================================
// 9. ACORDEÃO E TABELA DINÂMICA DE INDICADORES
// =========================================================================
function obterColunasAtivasHistorico() {
    const marcadas = new Set(['LINHA_CODIGO']);
    const checkboxes = document.querySelectorAll('.chk-coluna-historico');

    checkboxes.forEach(chk => {
        if (chk.checked && chk.value !== 'LINHA_CODIGO') marcadas.add(chk.value);
    });

    if (ordemColunasCustomizada.length > 0) {
        const filtradas = ordemColunasCustomizada.filter(col => marcadas.has(col));
        marcadas.forEach(col => { if (!filtradas.includes(col)) filtradas.push(col); });
        ordemColunasCustomizada = filtradas;
        return ordemColunasCustomizada;
    }

    ordemColunasCustomizada = Array.from(marcadas);
    return ordemColunasCustomizada;
}

function gerarCheckboxesAcordeaoHistorico() {
    Object.keys(COLUNAS_POR_GRUPO).forEach(idGrupo => {
        const container = document.getElementById(idGrupo);
        if (!container) return;

        let html = `
            <div class="form-check m-0 mb-2 pb-1 border-bottom">
                <input class="form-check-input" type="checkbox" id="chk-todos-${idGrupo}" onchange="alternarTodosDoGrupoHistorico('${idGrupo}', this.checked)">
                <label class="form-check-label fw-bold text-primary small" for="chk-todos-${idGrupo}">Marcar / Desmarcar Todos</label>
            </div>
        `;

        COLUNAS_POR_GRUPO[idGrupo].forEach(col => {
            const rotuloSemBr = (MAPA_ROTULOS_HISTORICO[col.chave] || col.chave).replace(/<br\s*[\/]?>/gi, ' ');
            const idChk = `chk-hist-${col.chave}`;
            const checkedAttr = col.checado ? 'checked' : '';

            html += `
                <div class="form-check m-0 mb-1">
                    <input class="form-check-input chk-coluna-historico" type="checkbox" value="${col.chave}" id="${idChk}" ${checkedAttr} onchange="atualizarTabelaHistoricoDinamica('${idGrupo}')">
                    <label class="form-check-label text-truncate" for="${idChk}" title="${rotuloSemBr}">${rotuloSemBr}</label>
                </div>
            `;
        });

        container.innerHTML = html;
    });
}

function alternarTodosDoGrupoHistorico(idGrupo, marcado) {
    const container = document.getElementById(idGrupo);
    if (!container) return;

    const checkboxes = container.querySelectorAll('.chk-coluna-historico');
    checkboxes.forEach(chk => { chk.checked = marcado; });

    atualizarTabelaHistoricoDinamica();
}

function atualizarTabelaHistoricoDinamica() {
    preencherTabelaHistorico(
        listaHistoricoFiltradaAtual, 
        document.getElementById('select-data-historico')?.value || ''
    );
}

// =========================================================================
// VARIÁVEIS DE PAGINACÃO
// =========================================================================
let paginaAtualHistorico = 1;
const ITENS_POR_PAGINA_HISTORICO = 50;

function preencherTabelaHistorico(lista, dataStr) {
    listaHistoricoFiltradaAtual = lista || [];
    const thead = document.getElementById('cabecalho-tabela-historico');
    const tbody = document.getElementById('corpo-tabela-historico');
    const tituloTabela = document.getElementById('titulo-tabela-historico');
    const badgeLinhas = document.getElementById('badge-total-linhas-historico');
    const badgePassageiros = document.getElementById('badge-total-passageiros-historico');
    const btnExcel = document.getElementById('btn-exportar-excel-historico');

    const colunasAtivas = obterColunasAtivasHistorico();

    if (!lista || lista.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted py-4">Nenhum dado disponível para o STU.</td></tr>';
        if (badgeLinhas) badgeLinhas.innerHTML = `Linhas: <b>0</b>`;
        if (badgePassageiros) badgePassageiros.innerHTML = `Passageiros: <b>0</b>`;
        renderizarControlesPaginacao(0, 1);
        if (btnExcel) btnExcel.disabled = true;
        return;
    }

    calcularECardsHistorico(lista);

    if (tituloTabela) {
        const diaSemana = (typeof obterDiaDaSemana === 'function') ? obterDiaDaSemana(dataStr) : '';
        const complemento = diaSemana ? ` (${diaSemana})` : '';
        tituloTabela.innerHTML = `📋 Indicadores Operacionais Consolidados - Data: <b>${dataStr}</b>${complemento}`;
    }

    if (thead) {
        let htmlHeader = '<tr>';
        colunasAtivas.forEach(col => { 
            const rotulo = (MAPA_ROTULOS_HISTORICO[col] || col).replace(/<br\s*[\/]?>/gi, ' ');
            htmlHeader += `<th data-coluna="${col}">${rotulo}</th>`; 
        });
        htmlHeader += '</tr>';
        thead.innerHTML = htmlHeader;

        if (typeof aplicarDragAndDropTabela === 'function') {
            aplicarDragAndDropTabela('cabecalho-tabela-historico', (idxOrigem, idxDestino) => {
                const colAtivas = obterColunasAtivasHistorico();
                const [removido] = colAtivas.splice(idxOrigem, 1);
                colAtivas.splice(idxDestino, 0, removido);
                ordemColunasCustomizada = colAtivas;
                preencherTabelaHistorico(listaHistoricoFiltradaAtual, document.getElementById('select-data-historico')?.value || '');
            });
        }

        if (typeof aplicarRedimensionamentoTabela === 'function') {
            aplicarRedimensionamentoTabela('cabecalho-tabela-historico');
        }
    }

    const totalItens = lista.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA_HISTORICO) || 1;
    if (paginaAtualHistorico > totalPaginas) paginaAtualHistorico = 1;

    const inicio = (paginaAtualHistorico - 1) * ITENS_POR_PAGINA_HISTORICO;
    const fim = inicio + ITENS_POR_PAGINA_HISTORICO;
    const listaPaginada = lista.slice(inicio, fim);

    let htmlBody = '';
    listaPaginada.forEach(p => {
        const getV = (chave) => p[chave] ?? p[chave.toLowerCase()] ?? p[chave.toUpperCase()] ?? null;

        htmlBody += '<tr>';
        colunasAtivas.forEach(col => {
            let rawVal = getV(col);
            let val = (rawVal !== null && rawVal !== undefined && rawVal !== '') ? rawVal : '-';

            if (col === 'LINHA_CODIGO') {
                val = `<span class="badge bg-success">${val}</span>`;
            } 
            else if (col === 'MOTIVO_SEM_GEOMETRIA') {
                const strVal = String(val).trim().toUpperCase();
                if (strVal === 'OK' || strVal === '-' || strVal === '') {
                    val = `<span class="badge bg-success">OK</span>`;
                } else {
                    val = `<span class="badge bg-warning text-dark" title="${val}">⚠️ ${val}</span>`;
                }
            } 
            else if (col.includes('ARRECADACAO') || col.includes('TARIFA') || col.includes('CUSTO') || 
                    col.includes('VALOR_SUBSIDIO') || col.includes('RECEITA')) {
                const num = parseFloat(val);
                if (!isNaN(num) && val !== '-') {
                    val = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else if (val === 0 || val === '0') {
                    val = 'R$ 0,00';
                }
            } 
            else if (col.includes('PERC_') || col === 'DEMANDA_OFERTA') {
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
            }
            else if (col === 'IPK' || col === 'IRP') {
                const num = parseFloat(val);
                val = (!isNaN(num)) ? num.toFixed(2).replace('.', ',') : '-';
            } 
            else if (col.includes('FROTA') || col.includes('VIAGENS') || col.includes('PASSAGEIROS')) {
                if (val !== '-') {
                    const numInt = parseInt(val, 10);
                    val = (!isNaN(numInt)) ? numInt.toLocaleString('pt-BR') : val;
                }
            }

            htmlBody += `<td>${val}</td>`;
        });
        htmlBody += '</tr>';
    });

    if (tbody) tbody.innerHTML = htmlBody;

    const codigosUnicos = new Set(lista.map(i => i.LINHA_CODIGO || i.linha_codigo));
    const somaPassageiros = lista.reduce((acc, i) => acc + (parseInt(i.TOTAL_PASSAGEIROS || 0, 10) || 0), 0);

    if (badgeLinhas) badgeLinhas.innerHTML = `Linhas: <b>${codigosUnicos.size.toLocaleString('pt-BR')}</b>`;
    if (badgePassageiros) badgePassageiros.innerHTML = `Total Passageiros: <b>${somaPassageiros.toLocaleString('pt-BR')}</b>`;
    if (btnExcel) btnExcel.disabled = false;

    renderizarControlesPaginacao(totalItens, totalPaginas);
}

function renderizarControlesPaginacao(totalItens, totalPaginas) {
    let containerPaginacao = document.getElementById("container-paginacao-historico");

    if (!containerPaginacao) {
        const tabelaEl = document.getElementById("tabela-historico") || document.getElementById("corpo-tabela-historico")?.closest("table");
        if (tabelaEl && tabelaEl.parentNode) {
            containerPaginacao = document.createElement("div");
            containerPaginacao.id = "container-paginacao-historico";
            containerPaginacao.className = "d-flex justify-content-between align-items-center mt-2 px-2";
            tabelaEl.parentNode.insertBefore(containerPaginacao, tabelaEl.nextSibling);
        } else {
            return;
        }
    }

    if (totalItens === 0) {
        containerPaginacao.innerHTML = "";
        return;
    }

    containerPaginacao.innerHTML = `
        <span class="small text-muted">
            Mostrando <b>${((paginaAtualHistorico - 1) * ITENS_POR_PAGINA_HISTORICO) + 1}</b> a 
            <b>${Math.min(paginaAtualHistorico * ITENS_POR_PAGINA_HISTORICO, totalItens)}</b> de <b>${totalItens.toLocaleString('pt-BR')}</b> registros
        </span>
        <div>
            <button class="btn btn-sm btn-outline-secondary me-1" 
                    onclick="mudarPaginaHistorico(${paginaAtualHistorico - 1})" 
                    ${paginaAtualHistorico === 1 ? 'disabled' : ''}>
                ◀ Anterior
            </button>
            <span class="small fw-bold mx-2">Página ${paginaAtualHistorico} de ${totalPaginas}</span>
            <button class="btn btn-sm btn-outline-secondary ms-1" 
                    onclick="mudarPaginaHistorico(${paginaAtualHistorico + 1})" 
                    ${paginaAtualHistorico === totalPaginas ? 'disabled' : ''}>
                Próximo ▶
            </button>
        </div>
    `;
}

function mudarPaginaHistorico(novaPagina) {
    paginaAtualHistorico = novaPagina;
    preencherTabelaHistorico(listaHistoricoFiltradaAtual, document.getElementById('select-data-historico')?.value || '');
}

// =========================================================================
// 10. RANKINGS E CÁLCULOS DOS CARDS PRINCIPAIS
// =========================================================================
function calcularECardsHistorico(dados) {
    if (!dados || dados.length === 0) {
        zerarCardsEListasHistorico();
        return;
    }

    let somaPassageiros = 0, somaKmDia = 0, somaIrp = 0, somaCusto = 0;
    let somaArrecadacao = 0, somaSubsidio = 0, somaCapacidadeOfertada = 0;
    let qtdValidaIrp = 0;

    const getV = (item, k) => {
        const val = parseFloat(item[k] ?? item[k.toLowerCase()] ?? item[k.toUpperCase()] ?? 0);
        return isNaN(val) ? 0 : val;
    };

    dados.forEach(item => {
        const viagensRealizadas = getV(item, 'VIAGENS_REALIZADAS');
        const kmRealizado = getV(item, 'KM_DIA');

        somaPassageiros += getV(item, 'TOTAL_PASSAGEIROS');
        somaCusto += getV(item, 'CUSTO_SERVICO');
        somaArrecadacao += getV(item, 'ARRECADACAO_DIA');
        somaSubsidio += getV(item, 'VALOR_SUBSIDIO');
        somaCapacidadeOfertada += getV(item, 'LUGARES_OFERTADOS');

        if (viagensRealizadas > 0) {
            somaKmDia += kmRealizado;
        }

        const irpVal = getV(item, 'IRP');
        if (viagensRealizadas > 0 && irpVal > 0) {
            somaIrp += irpVal;
            qtdValidaIrp++;
        }
    });

    const ipkMedio = somaKmDia > 0 ? (somaPassageiros / somaKmDia) : 0;
    const irpMedio = qtdValidaIrp > 0 ? (somaIrp / qtdValidaIrp) : 0;
    const custoMedioKm = somaKmDia > 0 ? (somaCusto / somaKmDia) : 0;
    const percDemandaOferta = somaCapacidadeOfertada > 0 ? ((somaPassageiros / somaCapacidadeOfertada) * 100) : 0;

    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

    setT('card-ipk-medio', ipkMedio.toFixed(2).replace('.', ','));
    setT('card-irp-medio', irpMedio.toFixed(2).replace('.', ','));
    setT('card-custo-medio', custoMedioKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-arrecadacao-total', somaArrecadacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-subsidio-total', somaSubsidio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setT('card-demanda-oferta', `${percDemandaOferta.toFixed(1).replace('.', ',')}%`);

    const linhasInconsistentes = dados.filter(item => {
        const motivo = String(item.MOTIVO_SEM_GEOMETRIA || item.motivo_sem_geometria || '').trim().toUpperCase();
        return motivo !== '' && motivo !== 'OK' && motivo !== 'NULL' && motivo !== 'UNDEFINED';
    });

    const badgeInconsistencia = document.getElementById('badge-total-inconsistencia');
    if (badgeInconsistencia) badgeInconsistencia.innerText = linhasInconsistentes.length.toLocaleString('pt-BR');

    const topIpk = [...dados].filter(item => getV(item, 'IPK') > 0).sort((a, b) => getV(b, 'IPK') - getV(a, 'IPK')).slice(0, 5);
    renderizarListaTopHistorico('lista-top-ipk', topIpk, item => `IPK ${getV(item, 'IPK').toFixed(2).replace('.', ',')}`);

    const lowIpk = [...dados].filter(item => getV(item, 'IPK') > 0).sort((a, b) => getV(a, 'IPK') - getV(b, 'IPK')).slice(0, 5);
    renderizarListaTopHistorico('lista-low-ipk', lowIpk, item => `IPK ${getV(item, 'IPK').toFixed(2).replace('.', ',')}`);

    const topCarregamento = [...dados].sort((a, b) => getV(b, 'TOTAL_PASSAGEIROS') - getV(a, 'TOTAL_PASSAGEIROS')).slice(0, 5);
    renderizarListaTopHistorico('lista-top-carregamento', topCarregamento, item => `${getV(item, 'TOTAL_PASSAGEIROS').toLocaleString('pt-BR')} pass.`);

    const longasBaixo = [...dados].filter(item => getV(item, 'EXTENSAO_KM') > 0 && getV(item, 'TOTAL_PASSAGEIROS') >= 1)
        .sort((a, b) => (getV(b, 'EXTENSAO_KM') / getV(b, 'TOTAL_PASSAGEIROS')) - (getV(a, 'EXTENSAO_KM') / getV(a, 'TOTAL_PASSAGEIROS')))
        .slice(0, 5);
    renderizarListaTopHistorico('lista-longas-baixo-carregamento', longasBaixo, item => `${getV(item, 'EXTENSAO_KM').toFixed(1).replace('.', ',')} km | ${getV(item, 'TOTAL_PASSAGEIROS')} pass.`);

    const linhasSemCarregamento = dados.filter(item => {
        const viagensReal = parseFloat(item.VIAGENS_REALIZADAS ?? item.viagens_realizadas ?? 0);
        const pass = parseFloat(item.TOTAL_PASSAGEIROS ?? item.total_passageiros ?? 0);
        return viagensReal > 0 && pass === 0;
    });

    const linhasNaoOperadas = dados.filter(item => {
        const viagensPlan = parseFloat(item.VIAGENS_PLANEJADAS ?? item.viagens_planejadas ?? 0);
        const viagensReal = parseFloat(item.VIAGENS_REALIZADAS ?? item.viagens_realizadas ?? 0);
        return viagensPlan > 0 && viagensReal === 0;
    });

    const badgeSemCarregamento = document.getElementById('badge-total-sem-carregamento');
    if (badgeSemCarregamento) badgeSemCarregamento.innerText = linhasSemCarregamento.length.toLocaleString('pt-BR');

    const badgeNaoOperado = document.getElementById('badge-total-nao-operado');
    if (badgeNaoOperado) badgeNaoOperado.innerText = linhasNaoOperadas.length.toLocaleString('pt-BR');
}

function renderizarListaTopHistorico(idElemento, lista, formatador) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    if (!lista || lista.length === 0) {
        el.innerHTML = '<li class="text-muted small">Nenhum registro encontrado.</li>';
        return;
    }
    el.innerHTML = lista.map(item => {
        const cod = item.LINHA_CODIGO || item.linha_codigo || '-';
        const sentido = item.SENTIDO || item.sentido || '';
        return `<li><b>Linha ${cod}</b> <span class="text-muted">(${sentido})</span>: ${formatador(item)}</li>`;
    }).join('');
}

function zerarCardsEListasHistorico() {
    ['card-ipk-medio', 'card-irp-medio', 'card-custo-medio', 'card-arrecadacao-total', 'card-subsidio-total', 'card-demanda-oferta']
        .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '-'; });

    ['lista-top-ipk', 'lista-low-ipk', 'lista-top-carregamento', 'lista-longas-baixo-carregamento']
        .forEach(id => { 
            const el = document.getElementById(id); 
            if (el) el.innerHTML = '<li class="text-muted small">Sem dados.</li>'; 
        });

    const badgeTotal = document.getElementById('badge-total-sem-carregamento');
    if (badgeTotal) badgeTotal.innerText = '0';
}

// =========================================================================
// 11. EXPORTAÇÕES E GRÁFICO ANUAL
// =========================================================================
function exportarTabelaExcelHistorico() {
    if (!listaHistoricoFiltradaAtual || listaHistoricoFiltradaAtual.length === 0) return;

    const colunasAtivas = obterColunasAtivasHistorico();
    const dataPico = document.getElementById('select-data-historico')?.value || 'STU';

    const dadosExportacao = listaHistoricoFiltradaAtual.map(item => {
        const linhaFormatada = {};
        colunasAtivas.forEach(col => {
            const rotulo = (MAPA_ROTULOS_HISTORICO[col] || col).replace(/<br\s*[\/]?>/gi, ' ');
            let rawVal = item[col] ?? item[col.toLowerCase()] ?? item[col.toUpperCase()] ?? null;
            let val = (rawVal !== null && rawVal !== undefined && rawVal !== '') ? rawVal : '-';

            if (col.includes('ARRECADACAO') || col.includes('TARIFA') || col.includes('CUSTO') || col.includes('VALOR_SUBSIDIO') || col.includes('RECEITA')) {
                val = (typeof formatarMoeda === 'function') ? formatarMoeda(val) : val;
            } else if (col === 'IPK' || col === 'IRP') {
                const num = parseFloat(val);
                val = (!isNaN(num)) ? num.toFixed(2).replace('.', ',') : '-';
            }
            linhaFormatada[rotulo] = val;
        });
        return linhaFormatada;
    });

    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Indicadores_STU");
    XLSX.writeFile(wb, `indicadores_stu_${dataPico.replace(/\//g, '-')}.xlsx`);
}

function exportarTabelaExcelFrotaSTU() {
    if (!listaFrotaSTUFiltradaAtual || listaFrotaSTUFiltradaAtual.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(listaFrotaSTUFiltradaAtual);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Frota_STU");
    XLSX.writeFile(wb, `frota_stu.xlsx`);
}

async function carregarDadosAnuaisAPI(modal = 'stu') {
    const anoSelecionado = document.getElementById('select-ano-historico')?.value || '2026';
    const ctx = document.getElementById('graficoHistoricoMensal');
    if (!ctx) return;

    try {
        const resp = await fetch(`${URL_API_STU}/indicadores/historico-anual?ano=${anoSelecionado}&modal=${modal}`);
        const data = await resp.json();

        if (!data.sucesso || !data.dados || data.dados.length === 0) return;

        const labelsMeses = data.dados.map(d => d.mes_ano);
        const ipkValores = data.dados.map(d => parseFloat(d.ipk_medio || 0).toFixed(2));
        const custoValores = data.dados.map(d => parseFloat(d.custo_total || 0));
        const arrecadacaoValores = data.dados.map(d => parseFloat(d.arrecadacao_total || 0));
        const subsidioValores = data.dados.map(d => parseFloat(d.subsidio_total || 0));

        if (graficoHistoricoMensalInstance) graficoHistoricoMensalInstance.destroy();

        graficoHistoricoMensalInstance = new Chart(ctx, {
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
        console.error("❌ Erro ao carregar gráfico anual do STU:", e);
    }
}