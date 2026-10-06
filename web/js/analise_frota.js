/**
 * Módulo: analise_frota.js
 * Descrição: Gestão da Frota Operacional com subseleção em cadeia entre múltiplos gráficos,
 *            suporte a gráficos de Transmissão e Operadoras, e explicação fixa de capacidade na barra lateral.
 */

(function () {
    const URL_API_FROTA = (typeof API_URL !== 'undefined') ? API_URL : "http://localhost:8000/api/v1";
    const ENDPOINT_SNAPSHOT_CADASTRO = `${URL_API_FROTA}/frota/snapshot-cadastro`;

    // Cache local de dados
    let dadosSnapshotCache = [];

    // Estado dos Filtros Interativos em Cadeia dos Gráficos (Subseleção Cumulativa)
    let filtroGraficoAtivo = {
        combustivel: null,  
        transmissao: null, 
        idade: null,        
        operadora: null,    
        tipoVeiculo: null   
    };

    // Instâncias Globais dos 5 Gráficos
    window.graficoCombustivelInstance = window.graficoCombustivelInstance || null;
    window.graficoTransmissaoInstance = window.graficoTransmissaoInstance || null;
    window.graficoIdadeInstance = window.graficoIdadeInstance || null;
    window.graficoOperadoraInstance = window.graficoOperadoraInstance || null;
    window.graficoTipoVeiculoInstance = window.graficoTipoVeiculoInstance || null;

    document.addEventListener('DOMContentLoaded', () => {
        iniciarModuloFrota();

        const abaFrotaBtn = document.getElementById('aba-frota-tab');
        if (abaFrotaBtn) {
            abaFrotaBtn.addEventListener('shown.bs.tab', () => {
                iniciarModuloFrota();
            });
        }
    });

    async function iniciarModuloFrota() {
        console.log("🚍 Módulo de Frota Iniciado!");
        await buscarDadosSnapshot();

        atualizarDataReferencia();
        popularFiltrosMultiplos(dadosSnapshotCache);
        aplicarFiltrosFrota();
    }

    async function buscarDadosSnapshot() {
        try {
            const resp = await fetch(ENDPOINT_SNAPSHOT_CADASTRO);
            const json = await resp.json();

            if (json.sucesso && Array.isArray(json.dados) && json.dados.length > 0) {
                dadosSnapshotCache = json.dados;
                return;
            }
        } catch (erro) {
            console.warn("⚠️ Conexão direta API indisponível. Carregando backup local...");
        }

        try {
            const resLocal = await fetch('dados_frota_cadastro.json');
            if (resLocal.ok) {
                const dados = await resLocal.json();
                dadosSnapshotCache = Array.isArray(dados) ? dados : (dados.dados || []);
            }
        } catch (e) {
            console.error("❌ Falha crítica ao carregar os dados da Frota.", e);
            dadosSnapshotCache = [];
        }
    }

    function atualizarDataReferencia() {
        const spanData = document.getElementById('span-data-ref');
        if (!spanData) return;

        if (dadosSnapshotCache && dadosSnapshotCache.length > 0) {
            const primeiro = dadosSnapshotCache[0];
            const dataBruta = primeiro.DATA_REFERENCIA || primeiro.data_referencia || "Atualizado";
            spanData.innerText = String(dataBruta).split(' ')[0];
        } else {
            spanData.innerText = "Indisponível";
        }
    }

    /**
     * Popula as opções fixas de filtro: STU e RURAL, além das Operadoras
     */
    function popularFiltrosMultiplos(dados) {
        const wrapBacia = document.getElementById('grupo-checkbox-bacia');
        const wrapOp = document.getElementById('grupo-checkbox-operadora');

        if (wrapBacia) {
            wrapBacia.innerHTML = `
                <div class="form-check m-0">
                    <input class="form-check-input chk-filtro-bacia" type="checkbox" value="STU" id="chk-sistema-stu" onchange="aplicarFiltrosFrota()">
                    <label class="form-check-label fw-bold" for="chk-sistema-stu">STU</label>
                </div>
                <div class="form-check m-0">
                    <input class="form-check-input chk-filtro-bacia" type="checkbox" value="RURAL" id="chk-sistema-rural" onchange="aplicarFiltrosFrota()">
                    <label class="form-check-label fw-bold" for="chk-sistema-rural">RURAL</label>
                </div>
            `;
        }

        if (!dados || dados.length === 0) return;

        const operadoras = [...new Set(dados.map(d => d.operadora || d.OPERADORA).filter(Boolean))].sort();

        if (wrapOp) {
            wrapOp.innerHTML = operadoras.map(o => `
                <div class="form-check m-0">
                    <input class="form-check-input chk-filtro-operadora" type="checkbox" value="${o}" id="chk-op-${o}" onchange="aplicarFiltrosFrota()">
                    <label class="form-check-label text-truncate" for="chk-op-${o}" title="${o}">${o}</label>
                </div>
            `).join('');
        }
    }

    function extrairNumeroBacia(v) {
        const val = String(v.bacia_id || v.BACIA_ID || v.bacia || v.BACIA || v.operadora || v.OPERADORA || "");
        const num = val.match(/\d+/);
        return num ? num[0] : "";
    }

    /**
     * Aplica os filtros ativos (Barra Lateral + Subseleções em Cadeia dos Gráficos)
     */
    function aplicarFiltrosFrota() {
        const busca = (document.getElementById('input-busca-frota')?.value || "").toUpperCase().trim();
        const vistoria = document.getElementById('select-vistoria-frota')?.value || "";
        const combustivel = document.getElementById('select-combustivel-frota')?.value || "";

        const sistemasSel = Array.from(document.querySelectorAll('.chk-filtro-bacia:checked')).map(c => c.value);
        const operadorasSel = Array.from(document.querySelectorAll('.chk-filtro-operadora:checked')).map(c => c.value);

        // Atualiza Badges de Filtros em Cadeia ativos no cabeçalho
        renderizarBadgesFiltrosGrafico();

        const baciasSTU = ['1', '2', '3', '4', '5'];
        const baciasRURAL = ['7'];

        const filtrados = dadosSnapshotCache.filter(v => {
            const prefixo = String(v.prefixo || v.PREFIXO || "").toUpperCase();
            const placa = String(v.nr_placa || v.NR_PLACA || "").toUpperCase();
            const numBacia = extrairNumeroBacia(v);
            const op = String(v.operadora || v.OPERADORA || "");
            const comb = String(v.tipo_combustivel || v.TIPO_COMBUSTIVEL || "").toUpperCase();
            const transmissao = String(v.transmissao || v.TRANSMISSAO || "").toUpperCase();
            const tipoVeiculo = String(v.tipo_veiculo || v.TIPO_VEICULO || "").toUpperCase();
            const sitVistoria = String(v.situacao_vistoria || v.SITUACAO_VISTORIA || "").toUpperCase();
            const diasVenc = parseInt(v.dias_para_vencimento ?? v.DIAS_PARA_VENCIMENTO ?? 999, 10);
            const idade = parseInt(v.idade_veiculo ?? v.IDADE_VEICULO ?? 0, 10);

            // 1. Filtro Texto (Prefixo ou Placa)
            const matchBusca = !busca || prefixo.includes(busca) || placa.includes(busca);

            // 2. Filtro agrupado por STU (1 a 5) e RURAL (7)
            let matchSistema = true;
            if (sistemasSel.length > 0) {
                const eSTU = baciasSTU.includes(numBacia);
                const eRURAL = baciasRURAL.includes(numBacia);

                const querSTU = sistemasSel.includes("STU");
                const querRURAL = sistemasSel.includes("");

                matchSistema = (querSTU && eSTU) || (querRURAL && eRURAL);
            }

            // 3. Filtro por Operadora da Barra Lateral
            const matchOp = operadorasSel.length === 0 || operadorasSel.includes(op);

            // 4. Filtro por Combustível da Barra Lateral
            let matchComb = !combustivel;
            if (combustivel === "ELÉTRICO") {
                matchComb = comb.includes("ELÉTR") || comb.includes("ELETRO");
            } else if (combustivel) {
                matchComb = comb.includes(combustivel);
            }

            // 5. Filtro por Vistoria
            let matchVist = true;
            if (vistoria === "REGULAR") {
                matchVist = diasVenc > 15 && (!sitVistoria.includes("VENCID"));
            } else if (vistoria === "A VENCER") {
                matchVist = diasVenc >= 0 && diasVenc <= 15;
            } else if (vistoria === "VENCIDA") {
                matchVist = diasVenc < 0 || sitVistoria.includes("VENCID");
            }

            // 6. Subseleção em Cadeia nos Gráficos (Interseção Lógica / AND)
            let matchGraficos = true;

            if (filtroGraficoAtivo.combustivel && comb !== filtroGraficoAtivo.combustivel.toUpperCase()) {
                matchGraficos = false;
            }
            if (filtroGraficoAtivo.transmissao && transmissao !== filtroGraficoAtivo.transmissao.toUpperCase()) {
                matchGraficos = false;
            }
            if (filtroGraficoAtivo.operadora && op !== filtroGraficoAtivo.operadora) {
                matchGraficos = false;
            }
            if (filtroGraficoAtivo.tipoVeiculo && tipoVeiculo !== filtroGraficoAtivo.tipoVeiculo.toUpperCase()) {
                matchGraficos = false;
            }
            if (filtroGraficoAtivo.idade) {
                const f = filtroGraficoAtivo.idade;
                let matchIdade = false;
                if (f === "0-3 anos" && idade <= 3) matchIdade = true;
                else if (f === "4-7 anos" && idade >= 4 && idade <= 7) matchIdade = true;
                else if (f === "8-10 anos" && idade >= 8 && idade <= 10) matchIdade = true;
                else if (f === "> 10 anos" && idade > 10) matchIdade = true;

                if (!matchIdade) matchGraficos = false;
            }

            return matchBusca && matchSistema && matchOp && matchComb && matchVist && matchGraficos;
        });

        atualizarKPIsEFilttrosFrota(filtrados);
        renderizarGraficosFrota(filtrados);
        renderizarTabelaFrota(filtrados);
    }

    /**
     * Renderiza as badges das subseleções ativas nos gráficos no topo
     */
    function renderizarBadgesFiltrosGrafico() {
        const container = document.getElementById('badge-filtro-grafico-ativo');
        if (!container) return;

        const ativos = Object.entries(filtroGraficoAtivo).filter(([_, v]) => v !== null);

        if (ativos.length === 0) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('d-none');
        const htmlBadges = ativos.map(([chave, val]) => `
            <span class="badge bg-warning text-dark border align-items-center gap-1" style="font-size: 0.75rem;">
                ${val}
                <button type="button" class="btn-close ms-1" style="font-size: 0.45rem;" onclick="removerFiltroGraficoEspecifico('${chave}')"></button>
            </span>
        `).join('');

        container.innerHTML = `
            <small class="fw-bold text-muted me-1">Subseleção:</small>
            ${htmlBadges}
            <button class="btn btn-sm btn-link p-0 text-danger fw-bold text-decoration-none ms-1" style="font-size: 0.75rem;" onclick="limparFiltroGrafico()">Limpar Todos</button>
        `;
    }

    function atualizarKPIsEFilttrosFrota(dados) {
        const cardTotal = document.getElementById('card-frota-total');
        const cardIdade = document.getElementById('card-frota-idade');
        const cardVencidas = document.getElementById('card-frota-vencidas');
        const cardAr = document.getElementById('card-frota-ar');
        const cardValorMedio = document.getElementById('card-frota-valor-medio');

        const badgeReg = document.getElementById('badge-vistoria-regular');
        const badgeAVenc = document.getElementById('badge-vistoria-avencer');
        const badgeVenc = document.getElementById('badge-vistoria-vencida');

        if (!dados || dados.length === 0) {
            if (cardTotal) cardTotal.innerText = "0";
            if (cardIdade) cardIdade.innerText = "0 anos";
            if (cardVencidas) cardVencidas.innerText = "0";
            if (cardAr) cardAr.innerText = "0%";
            if (cardValorMedio) cardValorMedio.innerText = "R$ 0,00";
            if (badgeReg) badgeReg.innerText = "0";
            if (badgeAVenc) badgeAVenc.innerText = "0";
            if (badgeVenc) badgeVenc.innerText = "0";
            return;
        }

        const total = dados.length;
        let somaIdade = 0, somaValor = 0, vencidas = 0, aVencer = 0, regulares = 0, comAr = 0;

        dados.forEach(v => {
            const idade = parseInt(v.idade_veiculo ?? v.IDADE_VEICULO ?? 0, 10);
            const valor = parseFloat(v.vl_compra_veiculo ?? v.VL_COMPRA_VEICULO ?? v.valor_veiculo ?? 0);
            const diasVenc = parseInt(v.dias_para_vencimento ?? v.DIAS_PARA_VENCIMENTO ?? 999, 10);
            const sit = String(v.situacao_vistoria ?? v.SITUACAO_VISTORIA ?? "").toUpperCase();
            const ar = String(v.ar_condicionado ?? v.AR_CONDICIONADO ?? "").toUpperCase();

            somaIdade += idade;
            somaValor += valor;

            if (diasVenc < 0 || sit.includes("VENCID")) vencidas++;
            else if (diasVenc <= 15) aVencer++;
            else regulares++;

            if (ar === "SIM" || ar === "TRUE" || v.ar_condicionado === true) comAr++;
        });

        const idadeMedia = (somaIdade / total).toFixed(1);
        const valorMedio = somaValor / total;
        const pctAr = ((comAr / total) * 100).toFixed(0);

        if (cardTotal) cardTotal.innerText = total.toLocaleString('pt-BR');
        if (cardIdade) cardIdade.innerText = `${idadeMedia} anos`;
        if (cardVencidas) cardVencidas.innerText = vencidas.toLocaleString('pt-BR');
        if (cardAr) cardAr.innerText = `${pctAr}%`;
        if (cardValorMedio) cardValorMedio.innerText = valorMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (badgeReg) badgeReg.innerText = regulares.toLocaleString('pt-BR');
        if (badgeAVenc) badgeAVenc.innerText = aVencer.toLocaleString('pt-BR');
        if (badgeVenc) badgeVenc.innerText = vencidas.toLocaleString('pt-BR');
    }

    /**
     * Renderização dos 5 gráficos interativos
     */
    function renderizarGraficosFrota(dados) {
        const ctxComb = document.getElementById('graficoCombustivelFrotaModulo');
        const ctxTrans = document.getElementById('graficoTransmissaoFrotaModulo');
        const ctxIdade = document.getElementById('graficoIdadeFrotaModulo');
        const ctxOp = document.getElementById('graficoOperadoraFrotaModulo');
        const ctxTipo = document.getElementById('graficoTipoVeiculoFrotaModulo');

        // 1. Gráfico de Combustível (Doughnut)
        if (ctxComb) {
            const contagemComb = {};
            dados.forEach(v => {
                const comb = v.tipo_combustivel || v.TIPO_COMBUSTIVEL || "OUTROS";
                contagemComb[comb] = (contagemComb[comb] || 0) + 1;
            });

            if (window.graficoCombustivelInstance) window.graficoCombustivelInstance.destroy();
            window.graficoCombustivelInstance = new Chart(ctxComb, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(contagemComb),
                    datasets: [{
                        data: Object.values(contagemComb),
                        backgroundColor: ['#198754', '#0d6efd', '#ffc107', '#6f42c1', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                    onClick: (evt, el, chart) => {
                        if (el.length > 0) tratarCliqueGrafico('combustivel', chart.data.labels[el[0].index]);
                    }
                }
            });
        }

        // 2. Gráfico de Transmissão (Doughnut)
        if (ctxTrans) {
            const contagemTrans = {};
            dados.forEach(v => {
                const trans = v.transmissao || v.TRANSMISSAO || "MANUAL";
                contagemTrans[trans] = (contagemTrans[trans] || 0) + 1;
            });

            if (window.graficoTransmissaoInstance) window.graficoTransmissaoInstance.destroy();
            window.graficoTransmissaoInstance = new Chart(ctxTrans, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(contagemTrans),
                    datasets: [{
                        data: Object.values(contagemTrans),
                        backgroundColor: ['#0d6efd', '#6c757d', '#17a2b8']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                    onClick: (evt, el, chart) => {
                        if (el.length > 0) tratarCliqueGrafico('transmissao', chart.data.labels[el[0].index]);
                    }
                }
            });
        }

        // 3. Gráfico de Idade (Barras Verticais)
        if (ctxIdade) {
            const faixasIdade = { "0-3 anos": 0, "4-7 anos": 0, "8-10 anos": 0, "> 10 anos": 0 };
            dados.forEach(v => {
                const id = parseInt(v.idade_veiculo ?? v.IDADE_VEICULO ?? 0, 10);
                if (id <= 3) faixasIdade["0-3 anos"]++;
                else if (id <= 7) faixasIdade["4-7 anos"]++;
                else if (id <= 10) faixasIdade["8-10 anos"]++;
                else faixasIdade["> 10 anos"]++;
            });

            if (window.graficoIdadeInstance) window.graficoIdadeInstance.destroy();
            window.graficoIdadeInstance = new Chart(ctxIdade, {
                type: 'bar',
                data: {
                    labels: Object.keys(faixasIdade),
                    datasets: [{
                        label: 'Veículos',
                        data: Object.values(faixasIdade),
                        backgroundColor: '#198754'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { font: { size: 10 } } },
                        x: { ticks: { font: { size: 10 } } }
                    },
                    onClick: (evt, el, chart) => {
                        if (el.length > 0) tratarCliqueGrafico('idade', chart.data.labels[el[0].index]);
                    }
                }
            });
        }

        // 4. Gráfico de Operadoras (Barras Horizontais)
        if (ctxOp) {
            const contagemOp = {};
            dados.forEach(v => {
                const op = v.operadora || v.OPERADORA || "NÃO INFORMADA";
                contagemOp[op] = (contagemOp[op] || 0) + 1;
            });

            const ordOp = Object.entries(contagemOp).sort((a, b) => b[1] - a[1]);

            if (window.graficoOperadoraInstance) window.graficoOperadoraInstance.destroy();
            window.graficoOperadoraInstance = new Chart(ctxOp, {
                type: 'bar',
                data: {
                    labels: ordOp.map(p => p[0]),
                    datasets: [{
                        label: 'Veículos',
                        data: ordOp.map(p => p[1]),
                        backgroundColor: '#ffc107'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { font: { size: 9 } } },
                        y: { ticks: { font: { size: 9 } } }
                    },
                    onClick: (evt, el, chart) => {
                        if (el.length > 0) tratarCliqueGrafico('operadora', chart.data.labels[el[0].index]);
                    }
                }
            });
        }

        // 5. Gráfico de Tipo de Veículo (Barras Horizontais)
        if (ctxTipo) {
            const contagemTipo = {};
            dados.forEach(v => {
                const tipo = v.tipo_veiculo || v.TIPO_VEICULO || "NÃO INFORMADO";
                contagemTipo[tipo] = (contagemTipo[tipo] || 0) + 1;
            });

            const ordTipo = Object.entries(contagemTipo).sort((a, b) => b[1] - a[1]);

            if (window.graficoTipoVeiculoInstance) window.graficoTipoVeiculoInstance.destroy();
            window.graficoTipoVeiculoInstance = new Chart(ctxTipo, {
                type: 'bar',
                data: {
                    labels: ordTipo.map(p => p[0]),
                    datasets: [{
                        label: 'Quantidade',
                        data: ordTipo.map(p => p[1]),
                        backgroundColor: '#0d6efd'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { font: { size: 9 } } },
                        y: { ticks: { font: { size: 9 } } }
                    },
                    onClick: (evt, el, chart) => {
                        if (el.length > 0) tratarCliqueGrafico('tipoVeiculo', chart.data.labels[el[0].index]);
                    }
                }
            });
        }
    }

    /**
     * Alterna o estado da subseleção cumulativa em cadeia ao clicar num gráfico
     */
    function tratarCliqueGrafico(tipo, valor) {
        if (filtroGraficoAtivo[tipo] === valor) {
            filtroGraficoAtivo[tipo] = null; // desativa se clicar de novo na mesma barra/fatia
        } else {
            filtroGraficoAtivo[tipo] = valor; // adiciona ou substitui o filtro nessa dimensão
        }
        aplicarFiltrosFrota();
    }

    window.removerFiltroGraficoEspecifico = function(tipo) {
        filtroGraficoAtivo[tipo] = null;
        aplicarFiltrosFrota();
    };

    window.limparFiltroGrafico = function() {
        Object.keys(filtroGraficoAtivo).forEach(k => filtroGraficoAtivo[k] = null);
        aplicarFiltrosFrota();
    };

    function renderizarTabelaFrota(dados) {
        const corpo = document.getElementById('corpo-tabela-frota-modulo');
        if (!corpo) return;

        if (!dados || dados.length === 0) {
            corpo.innerHTML = '<tr><td colspan="13" class="text-center text-muted py-3">Nenhum veículo encontrado com os filtros aplicados.</td></tr>';
            return;
        }

        corpo.innerHTML = dados.map(v => {
            const prefixo = v.prefixo || v.PREFIXO || '-';
            const placa = v.nr_placa || v.NR_PLACA || '-';
            const operadora = v.operadora || v.OPERADORA || '-';
            const marca = v.marca || v.MARCA || '';
            const modelo = v.modelo || v.MODELO || '';
            const ano = v.ano_fabricacao || v.ANO_FABRICACAO || '-';
            const idade = v.idade_veiculo ?? v.IDADE_VEICULO ?? 0;
            const transmissao = v.transmissao || v.TRANSMISSAO || 'MANUAL';
            const comb = v.tipo_combustivel || v.TIPO_COMBUSTIVEL || 'DIESEL';
            const ar = (v.ar_condicionado || v.AR_CONDICIONADO);
            const temAr = (ar === 'SIM' || ar === true || ar === 'TRUE');
            const diasVenc = parseInt(v.dias_para_vencimento ?? v.DIAS_PARA_VENCIMENTO ?? 999, 10);
            const sitVistoria = String(v.situacao_vistoria || v.SITUACAO_VISTORIA || 'REGULAR').toUpperCase();
            const capFinal = v.capacidade_final || v.CAPACIDADE_FINAL || v.capacidade_calculada || '-';

            const valor = parseFloat(v.vl_compra_veiculo ?? v.VL_COMPRA_VEICULO ?? v.valor_veiculo ?? 0);
            const valorFormatado = valor ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

            let badgeVistoria = '<span class="badge bg-success">Regular</span>';
            if (diasVenc < 0 || sitVistoria.includes("VENCID")) {
                badgeVistoria = '<span class="badge bg-danger">Vencida</span>';
            } else if (diasVenc <= 15) {
                badgeVistoria = '<span class="badge bg-warning text-dark">A Vencer</span>';
            }

            return `
                <tr>
                    <td><strong>${prefixo}</strong></td>
                    <td>${placa}</td>
                    <td>${operadora}</td>
                    <td>${marca} ${modelo}</td>
                    <td>${ano}</td>
                    <td>${idade}a</td>
                    <td><span class="badge bg-light text-dark border">${transmissao}</span></td>
                    <td><span class="badge bg-secondary">${comb}</span></td>
                    <td>${temAr ? '❄ Sim' : '❌ Não'}</td>
                    <td>${badgeVistoria}</td>
                    <td class="${diasVenc < 0 ? 'text-danger fw-bold' : ''}">${diasVenc} dias</td>
                    <td><strong>${capFinal} pass.</strong></td>
                    <td><span class="fw-bold text-success">${valorFormatado}</span></td>
                </tr>
            `;
        }).join('');
    }

    // Exportar funções globais
    window.iniciarModuloFrota = iniciarModuloFrota;
    window.aplicarFiltrosFrota = aplicarFiltrosFrota;

    window.alternarTodosFiltros = function(idContainer) {
        const checkboxes = document.querySelectorAll(`#${idContainer} input[type="checkbox"]`);
        if (checkboxes.length === 0) return;

        const todosMarcados = Array.from(checkboxes).every(c => c.checked);
        checkboxes.forEach(c => c.checked = !todosMarcados);
        aplicarFiltrosFrota();
    };

    window.limparFiltrosFrota = function() {
        if (document.getElementById('input-busca-frota')) document.getElementById('input-busca-frota').value = '';
        if (document.getElementById('select-vistoria-frota')) document.getElementById('select-vistoria-frota').value = '';
        if (document.getElementById('select-combustivel-frota')) document.getElementById('select-combustivel-frota').value = '';

        document.querySelectorAll('.chk-filtro-bacia, .chk-filtro-operadora').forEach(c => c.checked = false);
        limparFiltroGrafico();
    };

    window.exportarTabelaExcelFrota = function() {
        const tabela = document.getElementById('tabela-frota-modulo');
        if (!tabela) return;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(tabela);
        XLSX.utils.book_append_sheet(wb, ws, "Frota_Cadastrada");
        XLSX.writeFile(wb, `analise_frota_cadastral.xlsx`);
    };

})();