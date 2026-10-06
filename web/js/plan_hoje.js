/**
 * Módulo: plan_hoje.js
 * Descrição: Gerencia o carregamento de dados, geração dinâmica de colunas,
 *            filtros combinados, agregação da Produção (KM), reordenação por
 *            Drag & Drop e atualização da tabela no Planejamento do Dia.
 */

// 1. Inicializa o mapa reutilizando as funções do mapa_base.js
const mapa1 = inicializarMapaBase('mapa');

let camadaGeralLinhas = null;
let dadosBrutosMapa1 = [];
let listaLinhasFiltradasAtual = [];
let ordemColunasCustomizadaPlanejamento = [];

// Ativa os controles de seleção por retângulo e Pan com botão direito
if (mapa1) {
    ativarControlesMouseMapa(mapa1, filtrarPorAreaMapa1, limparSelecaoAreaMapa1);
}

// =========================================================================
// 2. DICIONÁRIO COMPLETO E CONFIGURAÇÃO DE COLUNAS
// =========================================================================
const MAPA_ROTULOS = {
    LINHA_CODIGO: 'Código',
    LINHA_DENOMINACAO: 'Denominação',
    OPERADORA: 'Operadora',
    BACIA_OPERACAO: 'Operação',
    SENTIDO_JOIN: 'Sentido',
    TIPO_DIA: 'Dias da<br>Semana',
    FROTA_PLANEJADA: 'Frota<br>Planejada',
    FROTA_ALOCADA: 'Frota<br>Alocada',
    FROTA_REAPROVEITADA: 'Frota<br>Reaproveitada',
    VIAGENS_PLANEJADAS: 'Viagens<br>Planejadas',
    DURACAO: 'Duração<br>Média',
    HW_OPERADOR: 'Headway do<br>operador',
    HW_PASSAGEIRO: 'Headway do<br>passageiro',
    EXTENSAO_KM: 'Extensão<br>(km)',
    PRODUCAO_KM: 'Produção<br>(km)',
    TARIFA_USUARIO: 'Tarifa<br>Usuário',
    TARIFA_TECNICA: 'Tarifa<br>Técnica'
};

const LISTA_COLUNAS_PLANEJAMENTO = [
    { chave: 'LINHA_DENOMINACAO', checado: false },
    { chave: 'OPERADORA', checado: true },
    { chave: 'BACIA_OPERACAO', checado: true },
    { chave: 'SENTIDO_JOIN', checado: true },
    { chave: 'TIPO_DIA', checado: true },
    { chave: 'FROTA_PLANEJADA', checado: true },
    { chave: 'FROTA_ALOCADA', checado: false },
    { chave: 'FROTA_REAPROVEITADA', checado: false },
    { chave: 'VIAGENS_PLANEJADAS', checado: true },
    { chave: 'DURACAO', checado: true },
    { chave: 'HW_OPERADOR', checado: false },
    { chave: 'HW_PASSAGEIRO', checado: false },
    { chave: 'EXTENSAO_KM', checado: true },
    { chave: 'PRODUCAO_KM', checado: false },   
    { chave: 'TARIFA_USUARIO', checado: true },
    { chave: 'TARIFA_TECNICA', checado: false }
];

/**
 * Alterna todos os checkboxes do Planejamento do Dia
 */
function alternarTodosPlanejamento(marcado) {
    const checkboxes = document.querySelectorAll('.chk-coluna-plan:not(:disabled)');
    checkboxes.forEach(chk => {
        chk.checked = marcado;
    });
    atualizarTabelaDinamica();
}

/**
 * Gera os checkboxes no Planejamento com a opção "Marcar / Desmarcar Todos"
 */
function gerarCheckboxesColunasPlanejamento() {
    const container = document.getElementById('grupo-checkbox-colunas');
    if (!container) return;

    let html = `
        <div class="form-check m-0 mb-2 pb-1 border-bottom">
            <input class="form-check-input" type="checkbox" id="chk-todos-plan" onchange="alternarTodosPlanejamento(this.checked)">
            <label class="form-check-label fw-bold text-primary small" for="chk-todos-plan">
                Marcar / Desmarcar Todos
            </label>
        </div>
        <div class="form-check m-0 mb-1">
            <input class="form-check-input chk-coluna-plan" type="checkbox" value="LINHA_CODIGO" id="chk-plan-LINHA_CODIGO" checked disabled>
            <label class="form-check-label text-truncate" for="chk-plan-LINHA_CODIGO">Código</label>
        </div>
    `;

    LISTA_COLUNAS_PLANEJAMENTO.forEach(col => {
        const rotuloSemBr = (MAPA_ROTULOS[col.chave] || col.chave).replace(/<br\s*[\/]?>/gi, ' ');
        const idChk = `chk-plan-${col.chave}`;
        const checkedAttr = col.checado ? 'checked' : '';

        html += `
            <div class="form-check m-0 mb-1">
                <input class="form-check-input chk-coluna-plan" type="checkbox" value="${col.chave}" id="${idChk}" ${checkedAttr} onchange="atualizarTabelaDinamica()">
                <label class="form-check-label text-truncate" for="${idChk}" title="${rotuloSemBr}">${rotuloSemBr}</label>
            </div>
        `;
    });

    container.innerHTML = html;
}

function obterColunasAtivas() {
    const marcadas = new Set(['LINHA_CODIGO']);
    const checkboxes = document.querySelectorAll('.chk-coluna-plan');

    checkboxes.forEach(chk => {
        if (chk.checked && chk.value !== 'LINHA_CODIGO') {
            marcadas.add(chk.value);
        }
    });

    if (ordemColunasCustomizadaPlanejamento.length > 0) {
        const filtradas = ordemColunasCustomizadaPlanejamento.filter(col => marcadas.has(col));
        marcadas.forEach(col => {
            if (!filtradas.includes(col)) filtradas.push(col);
        });
        ordemColunasCustomizadaPlanejamento = filtradas;
        return ordemColunasCustomizadaPlanejamento;
    }

    ordemColunasCustomizadaPlanejamento = Array.from(marcadas);
    return ordemColunasCustomizadaPlanejamento;
}

function reordenarColunasPlanejamento(origemIdx, destinoIdx) {
    const colunas = obterColunasAtivas();
    const [colunaRemovida] = colunas.splice(origemIdx, 1);
    colunas.splice(destinoIdx, 0, colunaRemovida);

    ordemColunasCustomizadaPlanejamento = colunas;
    preencherTabelaMapa1(listaLinhasFiltradasAtual);
}

// =========================================================================
// 3. REDIMENSIONADOR DO PAINEL (DIVISOR)
// =========================================================================
const divisor = document.getElementById('divisor-redimensionavel');
const conteudoSuperior = document.getElementById('conteudo-superior');
const overlay = document.getElementById('overlay-redimensionamento');
let arrastandoDivisor = false;

if (divisor) {
    divisor.addEventListener('mousedown', () => {
        arrastandoDivisor = true;
        divisor.classList.add('arrastando');
        if (overlay) overlay.style.display = 'block';
    });

    window.addEventListener('mousemove', (e) => {
        if (!arrastandoDivisor) return;
        const containerHeight = document.getElementById('container-principal').clientHeight - 60;
        const newHeight = e.clientY - 60;
        if (newHeight > 100 && newHeight < containerHeight - 100) {
            conteudoSuperior.style.height = `${newHeight}px`;
            if (mapa1) mapa1.invalidateSize();
        }
    });

    window.addEventListener('mouseup', () => {
        if (arrastandoDivisor) {
            arrastandoDivisor = false;
            divisor.classList.remove('arrastando');
            if (overlay) overlay.style.display = 'none';
            if (mapa1) mapa1.invalidateSize();
        }
    });
}

// =========================================================================
// 4. CARREGAMENTO DOS DADOS DA API
// =========================================================================
async function carregarLinhasIniciaisMapa1() {
    try {
        const resp = await fetch(`${API_URL}/mapa/linhas-hoje`);
        const data = await resp.json();

        if (data.sucesso && data.dados) {
            dadosBrutosMapa1 = data.dados;
            document.getElementById('qtd-total-linhas').textContent = data.total_linhas;
            document.getElementById('qtd-linhas-selecionadas').textContent = data.total_linhas;

            preencherSelectOperadoras(data.dados);
            preencherCheckboxesOperacoes(data.dados);

            const featuresGeoJSON = data.dados
                .filter(d => d.geojson_geom)
                .map(d => ({
                    type: "Feature",
                    geometry: d.geojson_geom,
                    properties: d
                }));

            if (camadaGeralLinhas) mapa1.removeLayer(camadaGeralLinhas);

            camadaGeralLinhas = L.geoJSON({ type: "FeatureCollection", features: featuresGeoJSON }, {
                style: { color: '#0d6efd', weight: 3, opacity: 0.6 },
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(`<b>${feature.properties.LINHA_CODIGO}</b> - ${feature.properties.LINHA_DENOMINACAO}`);
                }
            }).addTo(mapa1);

            camadaGeralLinhas.bringToFront();
            preencherTabelaMapa1(data.dados);
        }
    } catch (e) {
        console.error("Erro ao carregar linhas:", e);
    }
}

// =========================================================================
// 5. AGREGAÇÃO E CONSOLIDAÇÃO DE DADOS
// =========================================================================
function agregarEDesduplicarDados(listaBruta, colunasAtivas) {
    const incluiSentido = colunasAtivas.includes('SENTIDO_JOIN');

    const extensoesPorSentido = {};
    listaBruta.forEach(item => {
        const cod = item.LINHA_CODIGO || '';
        const sent = item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || 'CIRCULAR';
        const chaveLS = `${cod}_${sent}`;
        if (!extensoesPorSentido[chaveLS]) {
            extensoesPorSentido[chaveLS] = { 
                codigo: cod, 
                extensao: parseFloat(item.EXTENSAO_KM) || 0 
            };
        }
    });

    const frotaPorOperadoraEEquipamento = {};
    listaBruta.forEach(item => {
        const cod = item.LINHA_CODIGO || '';
        const op = item.OPERADORA || 'SEM_OPERADORA';
        const frot = item.FROTA_PLANEJADA || 'PADRAO';
        const sent = item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || 'CIRCULAR';

        const chaveSubgrupo = `${cod}___${op}___${frot}`;

        if (!frotaPorOperadoraEEquipamento[chaveSubgrupo]) {
            frotaPorOperadoraEEquipamento[chaveSubgrupo] = { porSentido: {} };
        }

        const sub = frotaPorOperadoraEEquipamento[chaveSubgrupo];
        if (!sub.porSentido[sent]) {
            sub.porSentido[sent] = {
                alocada: parseInt(item.FROTA_ALOCADA, 10) || 0,
                reaproveitada: parseInt(item.FROTA_REAPROVEITADA, 10) || 0
            };
        } else {
            sub.porSentido[sent].alocada = Math.max(sub.porSentido[sent].alocada, parseInt(item.FROTA_ALOCADA, 10) || 0);
            sub.porSentido[sent].reaproveitada = Math.max(sub.porSentido[sent].reaproveitada, parseInt(item.FROTA_REAPROVEITADA, 10) || 0);
        }
    });

    const frotaLiquidada = {};
    Object.keys(frotaPorOperadoraEEquipamento).forEach(chaveSub => {
        const sub = frotaPorOperadoraEEquipamento[chaveSub];
        const sentidos = Object.keys(sub.porSentido);

        if (incluiSentido) {
            sentidos.forEach(s => {
                frotaLiquidada[`${chaveSub}___${s}`] = {
                    alocada: sub.porSentido[s].alocada,
                    reaproveitada: sub.porSentido[s].reaproveitada
                };
            });
        } else {
            let maxAlocada = 0;
            let maxReaproveitada = 0;
            sentidos.forEach(s => {
                if (sub.porSentido[s].alocada > maxAlocada) maxAlocada = sub.porSentido[s].alocada;
                if (sub.porSentido[s].reaproveitada > maxReaproveitada) maxReaproveitada = sub.porSentido[s].reaproveitada;
            });
            frotaLiquidada[chaveSub] = {
                alocada: maxAlocada,
                reaproveitada: maxReaproveitada
            };
        }
    });

    const dimensoesPossiveis = [
        'LINHA_CODIGO', 'OPERADORA', 'BACIA_OPERACAO', 'BACIA_ID', 
        'SENTIDO_JOIN', 'TIPO_DIA', 'FROTA_PLANEJADA', 'ID_TIPO_ONIBUS'
    ];
    const dimensoesAtivas = dimensoesPossiveis.filter(col => colunasAtivas.includes(col));

    const grupos = {};
    listaBruta.forEach(item => {
        const cod = item.LINHA_CODIGO || '';
        let partesChave = dimensoesAtivas.map(d => {
            if (d === 'SENTIDO_JOIN') return item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || '-';
            return item[d] || '-';
        });

        const chaveGrupo = partesChave.length > 0 ? partesChave.join('___') : cod;

        const vPlan = parseInt(item.VIAGENS_PLANEJADAS, 10) || 0;
        const extKm = parseFloat(item.EXTENSAO_KM) || 0;
        const prodIndividual = parseFloat(item.PRODUCAO_KM) || (vPlan * extKm);

        if (!grupos[chaveGrupo]) {
            grupos[chaveGrupo] = { 
                ...item, 
                SENTIDO_JOIN: incluiSentido ? (item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || '-') : '-',
                VIAGENS_PLANEJADAS: 0,
                PRODUCAO_KM: 0,
                FROTA_ALOCADA: 0, 
                FROTA_REAPROVEITADA: 0,
                TARIFA_USUARIO: parseFloat(item.TARIFA_USUARIO) || 0,
                TARIFA_TECNICA: parseFloat(item.TARIFA_TECNICA) || 0
            };
        }

        grupos[chaveGrupo].VIAGENS_PLANEJADAS += vPlan;
        grupos[chaveGrupo].PRODUCAO_KM += prodIndividual;
    });

    Object.keys(grupos).forEach(chaveGrupo => {
        const g = grupos[chaveGrupo];

        const itensDoGrupo = listaBruta.filter(item => {
            const cod = item.LINHA_CODIGO || '';
            let partes = dimensoesAtivas.map(d => {
                if (d === 'SENTIDO_JOIN') return item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || '-';
                return item[d] || '-';
            });
            const ch = partes.length > 0 ? partes.join('___') : cod;
            return ch === chaveGrupo;
        });

        const chavesSubAtreladas = new Set();
        itensDoGrupo.forEach(item => {
            const cod = item.LINHA_CODIGO || '';
            const op = item.OPERADORA || 'SEM_OPERADORA';
            const frot = item.FROTA_PLANEJADA || 'PADRAO';
            const sent = item.SENTIDO_TRADUZIDO || item.SENTIDO_JOIN || 'CIRCULAR';

            if (incluiSentido) {
                chavesSubAtreladas.add(`${cod}___${op}___${frot}___${sent}`);
            } else {
                chavesSubAtreladas.add(`${cod}___${op}___${frot}`);
            }
        });

        let somaAlocada = 0;
        let somaReaproveitada = 0;
        chavesSubAtreladas.forEach(chSub => {
            if (frotaLiquidada[chSub]) {
                somaAlocada += frotaLiquidada[chSub].alocada;
                somaReaproveitada += frotaLiquidada[chSub].reaproveitada;
            }
        });

        g.FROTA_ALOCADA = somaAlocada;
        g.FROTA_REAPROVEITADA = somaReaproveitada;

        let extensaoFinal = 0;
        if (incluiSentido) {
            const chaveLS = `${g.LINHA_CODIGO}_${g.SENTIDO_JOIN}`;
            extensaoFinal = extensoesPorSentido[chaveLS] ? extensoesPorSentido[chaveLS].extensao : 0;
        } else {
            Object.values(extensoesPorSentido)
                .filter(ls => ls.codigo === g.LINHA_CODIGO)
                .forEach(ls => extensaoFinal += ls.extensao);
        }
        g.EXTENSAO_KM = extensaoFinal;
    });

    return Object.values(grupos);
}

function atualizarTabelaDinamica() {
    preencherTabelaMapa1(listaLinhasFiltradasAtual);
}

// =========================================================================
// 6. RENDERIZAÇÃO DA TABELA (USANDO TABELAS_UTILS.JS)
// =========================================================================

// 2. ATUALIZAÇÃO DA RENDERIZAÇÃO DA TABELA E CÁLCULO DOS AGREGADORES
function preencherTabelaMapa1(lista) {
    listaLinhasFiltradasAtual = lista || [];
    
    const tbody = document.getElementById('corpo-tabela-linha');
    const thead = document.getElementById('cabecalho-tabela-linha');
    const badgeViagens = document.getElementById('badge-total-viagens');
    const badgeLinhas = document.getElementById('badge-total-linhas');
    const badgeFrota = document.getElementById('badge-total-frota');
    const badgeProducao = document.getElementById('badge-total-producao');
    const colunasAtivas = obterColunasAtivas();

    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="21" class="text-center text-muted py-4">Nenhuma linha encontrada.</td></tr>';
        if (badgeLinhas) badgeLinhas.classList.add('d-none');
        if (badgeViagens) badgeViagens.classList.add('d-none');
        if (badgeFrota) badgeFrota.classList.add('d-none');
        if (badgeProducao) badgeProducao.classList.add('d-none');
        return;
    }

    const dadosConsolidados = agregarEDesduplicarDados(lista, colunasAtivas);

    if (thead) {
        let htmlHeader = '<tr>';
        colunasAtivas.forEach(col => {
            htmlHeader += `<th>${MAPA_ROTULOS[col] || col}</th>`;
        });
        htmlHeader += '</tr>';
        thead.innerHTML = htmlHeader;
    }

    // Variáveis acumuladoras dos totais
    let totalViagens = 0;
    let totalFrotaAlocada = 0;
    let totalProducaoKm = 0;
    const codigosUnicos = new Set(dadosConsolidados.map(p => p.LINHA_CODIGO)).size;
    let htmlBody = '';

    dadosConsolidados.forEach(p => {
        totalViagens += (parseInt(p.VIAGENS_PLANEJADAS, 10) || 0);
        totalFrotaAlocada += (parseInt(p.FROTA_ALOCADA, 10) || 0);
        totalProducaoKm += (parseFloat(p.PRODUCAO_KM) || 0);

        htmlBody += '<tr>';

        colunasAtivas.forEach(col => {
            let val = p[col] ?? '-';

            // Formatações utilitárias
            if (col === 'LINHA_CODIGO') {
                val = `<span class="badge bg-primary">${val}</span>`;
            } 
            else if (col === 'HW_OPERADOR' || col === 'HW_PASSAGEIRO' || col === 'DURACAO') {
                val = formatarHeadway(val);
            }
            else if (col === 'TARIFA_USUARIO' || col === 'TARIFA_TECNICA') {
                val = formatarMoeda(val);
            }
            else if (col === 'EXTENSAO_KM' || col === 'PRODUCAO_KM') {
                val = formatarKm(val);
            }
            else if (col.includes('FROTA') || col.includes('VIAGENS')) {
                if (val !== '-' && val !== null && val !== '') {
                    const numInt = parseInt(val, 10);
                    val = (!isNaN(numInt)) ? numInt.toLocaleString('pt-BR') : val;
                }
            }

            htmlBody += `<td>${val}</td>`;
        });

        htmlBody += '</tr>';
    });

    tbody.innerHTML = htmlBody;

    // Atualização e exibição dos badges de agregação
    if (badgeLinhas) {
        badgeLinhas.innerHTML = `Total de linhas: <b>${codigosUnicos.toLocaleString('pt-BR')}</b>`;
        badgeLinhas.classList.remove('d-none');
    }
    if (badgeViagens) {
        badgeViagens.innerHTML = `Total de viagens: <b>${totalViagens.toLocaleString('pt-BR')}</b>`;
        badgeViagens.classList.remove('d-none');
    }
    if (badgeFrota) {
        badgeFrota.innerHTML = `Frota alocada: <b>${totalFrotaAlocada.toLocaleString('pt-BR')}</b>`;
        badgeFrota.classList.remove('d-none');
    }
    if (badgeProducao) {
        badgeProducao.innerHTML = `Produção: <b>${totalProducaoKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</b>`;
        badgeProducao.classList.remove('d-none');
    }

    const btnExcel = document.getElementById('btn-exportar-excel');
    if (btnExcel) {
        btnExcel.disabled = (!lista || lista.length === 0);
    }

    aplicarRedimensionamentoTabela('cabecalho-tabela-linha');
    aplicarDragAndDropTabela('cabecalho-tabela-linha', reordenarColunasPlanejamento);
}

// =========================================================================
// 7. FILTROS COMBINADOS
// =========================================================================
function preencherSelectOperadoras(dados) {
    const operadoras = [...new Set(dados.map(d => d.OPERADORA).filter(Boolean))].sort();
    let opts = '<option value="">Todas as Operadoras</option>';
    operadoras.forEach(op => { opts += `<option value="${op}">${op}</option>`; });
    const select = document.getElementById('select-operadora-mapa1');
    if (select) select.innerHTML = opts;
}

function preencherCheckboxesOperacoes(dados) {
    const operacoes = [...new Set(dados.map(d => d.BACIA_OPERACAO).filter(Boolean))].sort();
    const container = document.getElementById('grupo-checkbox-operacoes');
    if (!container) return;

    if (operacoes.length === 0) {
        container.innerHTML = '<span class="text-muted small">Nenhuma operação encontrada.</span>';
        return;
    }

    let html = '';
    operacoes.forEach((op, index) => {
        const idChk = `chk-op-${index}`;
        html += `
            <div class="form-check m-0">
                <input class="form-check-input chk-operacao" type="checkbox" value="${op}" id="${idChk}" onchange="aplicarFiltrosCombinadosMapa1()">
                <label class="form-check-label text-truncate" for="${idChk}" title="${op}">${op}</label>
            </div>
        `;
    });
    container.innerHTML = html;
}

function obterOperacoesSelecionadas() {
    const checkboxes = document.querySelectorAll('.chk-operacao');
    const selecionadas = [];
    checkboxes.forEach(chk => {
        if (chk.checked) selecionadas.push(chk.value.toLowerCase());
    });
    return selecionadas;
}

function alternarTodasOperacoes() {
    const checkboxes = document.querySelectorAll('.chk-operacao');
    if (checkboxes.length === 0) return;
    
    const algumDesmarcado = Array.from(checkboxes).some(chk => !chk.checked);
    checkboxes.forEach(chk => { chk.checked = algumDesmarcado; });
    
    aplicarFiltrosCombinadosMapa1();
}

function aplicarFiltrosCombinadosMapa1() {
    const opSel = (document.getElementById('select-operadora-mapa1')?.value || '').toLowerCase();
    const operacoesSel = obterOperacoesSelecionadas();
    const valorRaw = (document.getElementById('input-filtrar-linha')?.value || '').trim().toLowerCase();
    const codigos = valorRaw ? valorRaw.split(',').map(c => c.trim()) : [];

    const filtrados = dadosBrutosMapa1.filter(d => {
        const matchOperadora = !opSel || ((d.OPERADORA || '').toLowerCase() === opSel);
        const opRegistro = (d.BACIA_OPERACAO || '').toLowerCase();
        const matchOperacao = operacoesSel.length === 0 || operacoesSel.includes(opRegistro);
        const matchLinha = codigos.length === 0 || codigos.includes((d.LINHA_CODIGO || '').toLowerCase());
        
        return matchOperadora && matchOperacao && matchLinha;
    });

    if (camadaGeralLinhas) {
        const codigosFiltrados = new Set(filtrados.map(f => f.LINHA_CODIGO));
        camadaGeralLinhas.eachLayer(layer => {
            const codLayer = layer.feature.properties.LINHA_CODIGO;
            if (codigosFiltrados.has(codLayer)) {
                layer.setStyle({ color: '#0d6efd', weight: 3, opacity: 0.6 });
            } else {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }

    document.getElementById('qtd-linhas-selecionadas').textContent = filtrados.length;
    preencherTabelaMapa1(filtrados);
}

function filtrarPorOperadoraMapa1() { aplicarFiltrosCombinadosMapa1(); }
function filtrarLinhaEspecifica() { aplicarFiltrosCombinadosMapa1(); }

function limparFiltrosMapa1() {
    if (document.getElementById('input-filtrar-linha')) document.getElementById('input-filtrar-linha').value = '';
    if (document.getElementById('select-operadora-mapa1')) document.getElementById('select-operadora-mapa1').value = '';
    
    const checkboxesOp = document.querySelectorAll('.chk-operacao');
    checkboxesOp.forEach(chk => { chk.checked = false; });

    limparSelecaoAreaMapa1();
}

function filtrarPorAreaMapa1(bounds) {
    const linhasFiltradas = [];

    if (camadaGeralLinhas) {
        camadaGeralLinhas.eachLayer(layer => {
            const interseca = linhaIntersecaRetangulo(layer.feature.geometry, bounds);

            if (interseca) {
                layer.setStyle({ color: '#dc3545', weight: 6, opacity: 1 });
                linhasFiltradas.push(layer.feature.properties);
            } else {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }

    document.getElementById('qtd-linhas-selecionadas').textContent = linhasFiltradas.length;
    preencherTabelaMapa1(linhasFiltradas);
}

function limparSelecaoAreaMapa1() {
    if (camadaGeralLinhas) {
        camadaGeralLinhas.eachLayer(layer => {
            layer.setStyle({ color: '#0d6efd', weight: 3, opacity: 0.6 });
        });
    }
    document.getElementById('qtd-linhas-selecionadas').textContent = dadosBrutosMapa1.length;
    preencherTabelaMapa1(dadosBrutosMapa1);
}

document.addEventListener("DOMContentLoaded", () => {
    gerarCheckboxesColunasPlanejamento();
    carregarLinhasIniciaisMapa1();
});