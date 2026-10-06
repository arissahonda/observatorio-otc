/**
 * Módulo: tabelas_utils.js
 * Descrição: Funções utilitárias compartilhadas para formatação de dados,
 *            redimensionamento de colunas e reordenação via Drag & Drop.
 */

// =========================================================================
// 1. FORMATADORES DE DADOS (LÓGICA PURA)
// =========================================================================

/** Formata valores numéricos para Moeda BRL (R$) */
function formatarMoeda(valor) {
    const num = parseFloat(valor);
    return (!isNaN(num) && num > 0) ? num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
}

/** Formata fração decimal (0.08) para Porcentagem (8,00%) */
function formatarPorcentagem(valor) {
    const num = parseFloat(valor);
    return (!isNaN(num)) ? `${(num * 100).toFixed(2).replace('.', ',')}%` : '-';
}

/** Formata distância em quilômetros */
function formatarKm(valor) {
    const num = parseFloat(valor);
    return (!isNaN(num) && num > 0) ? `${num.toFixed(2).replace('.', ',')} km` : '-';
}

/** Formata tempo/Headway em formato HH:mm */
function formatarHeadway(valor) {
    if (!valor || valor === '-' || valor === 'null' || valor === '00:00:00') return '-';
    const strVal = String(valor).trim();
    if (strVal.includes(':')) {
        const partes = strVal.split(':');
        return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
    }
    const minNum = parseFloat(strVal);
    if (!isNaN(minNum) && minNum > 0) {
        const hh = String(Math.floor(minNum / 60)).padStart(2, '0');
        const mm = String(Math.round(minNum % 60)).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    return '-';
}

// =========================================================================
// 2. INTERAÇÕES DE INTERFACE (COMPORTAMENTO)
// =========================================================================

/**
 * Torna as colunas de uma tabela redimensionáveis dinamicamente,
 * mantendo o layout fluido por padrão até que o utilizador a redimensione.
 */
function aplicarRedimensionamentoTabela(idCabecalho) {
    const colunas = document.querySelectorAll(`#${idCabecalho} th`);
    
    colunas.forEach(col => {
        if (col.querySelector('.resizer')) return;

        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        col.appendChild(resizer);

        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            
            // Pega a largura real exata calculada pelo navegador no momento do clique
            startWidth = col.offsetWidth;

            const onMouseMove = (ev) => {
                const novaLargura = startWidth + (ev.clientX - startX);
                
                // Aplica a nova largura em pixels apenas quando o utilizador arrasta
                if (novaLargura > 40) {
                    col.style.width = `${novaLargura}px`;
                    col.style.minWidth = `${novaLargura}px`;
                    col.style.maxWidth = `${novaLargura}px`;
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                resizer.classList.remove('resizing');
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            resizer.classList.add('resizing');
        });
    });
}

/** Torna as colunas de uma tabela reordenáveis por Drag & Drop */
function aplicarDragAndDropTabela(idCabecalho, callbackReordenar) {
    const cabecalho = document.getElementById(idCabecalho);
    if (!cabecalho) return;

    const ths = cabecalho.querySelectorAll('th');
    let thArrastado = null;

    ths.forEach((th, index) => {
        th.setAttribute('draggable', 'true');
        th.style.cursor = 'grab';

        th.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('resizer')) {
                e.preventDefault();
                return;
            }
            thArrastado = th;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            th.classList.add('opacity-50', 'bg-light');
        });

        th.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        th.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (th !== thArrastado) th.classList.add('border-start', 'border-3', 'border-primary');
        });

        th.addEventListener('dragleave', () => {
            th.classList.remove('border-start', 'border-3', 'border-primary');
        });

        th.addEventListener('drop', (e) => {
            e.preventDefault();
            th.classList.remove('border-start', 'border-3', 'border-primary');
            if (thArrastado && thArrastado !== th) {
                const idxOrigem = parseInt(e.dataTransfer.getData('text/plain'), 10);
                callbackReordenar(idxOrigem, index);
            }
        });

        th.addEventListener('dragend', () => {
            th.classList.remove('opacity-50', 'bg-light');
            ths.forEach(el => el.classList.remove('border-start', 'border-3', 'border-primary'));
        });
    });
}

/**
 * Converte uma string de data no formato DD/MM/YYYY para o nome do dia da semana.
 * Exemplo: "19/08/2026" -> "Quarta-feira"
 */
function obterDiaDaSemana(dataStr) {
    if (!dataStr) return "";
    
    const partes = dataStr.trim().split('/');
    if (partes.length === 3) {
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1; // Os meses no JavaScript variam de 0 a 11
        const ano = parseInt(partes[2], 10);
        
        const dataObj = new Date(ano, mes, dia);
        
        const diasSemana = [
            "Domingo", 
            "Segunda-feira", 
            "Terça-feira", 
            "Quarta-feira", 
            "Quinta-feira", 
            "Sexta-feira", 
            "Sábado"
        ];
        
        return diasSemana[dataObj.getDay()] || "";
    }
    return "";
}