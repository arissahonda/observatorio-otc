/**
 * Módulo: exportacao.js
 * Descrição: Gerencia a exportação dos dados da tabela para arquivo Excel (.xlsx)
 *            respeitando as colunas visíveis e as regras de agregação.
 */

function exportarTabelaExcelMapa1() {
    // 1. Verifica se existem dados carregados na tela
    if (!listaLinhasFiltradasAtual || listaLinhasFiltradasAtual.length === 0) {
        alert("Não há dados na tabela para exportar.");
        return;
    }

    // 2. Obtém as colunas atualmente ativas no painel lateral
    const colunasAtivas = obterColunasAtivas();

    // 3. Obtém os dados consolidados (exatamente como estão na tabela)
    const dadosConsolidados = agregarEDesduplicarDados(listaLinhasFiltradasAtual, colunasAtivas);

    if (dadosConsolidados.length === 0) {
        alert("Nenhum registro encontrado para exportação.");
        return;
    }

    // 4. Mapeia apenas as colunas selecionadas com rótulos limpos (sem <br>)
    const dadosExcel = dadosConsolidados.map(item => {
        const linhaExcel = {};

        colunasAtivas.forEach(col => {
            // Limpa as quebras de linha <br> dos nomes das colunas
            const rotuloSemBr = (MAPA_ROTULOS[col] || col).replace(/<br\s*[\/]?>/gi, ' ');
            let val = item[col] ?? '-';

            // Formatação de valores para a planilha
            if (col === 'HW_OPERADOR' || col === 'HW_PASSAGEIRO') {
                val = formatarHeadway(val);
            } else if (col === 'TARIFA_USUARIO' || col === 'TARIFA_TECNICA') {
                const numTarifa = parseFloat(val);
                val = (!isNaN(numTarifa) && numTarifa > 0) ? numTarifa : 0;
            } else if (col === 'EXTENSAO_KM' || col === 'PRODUCAO_KM') {
                const numKm = parseFloat(val);
                val = (!isNaN(numKm) && numKm > 0) ? Number(numKm.toFixed(2)) : 0;
            }

            linhaExcel[rotuloSemBr] = val;
        });

        return linhaExcel;
    });

    // 5. Cria a planilha com SheetJS (XLSX)
    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planejamento_Hoje");

    // 6. Faz o download do arquivo Excel
    XLSX.writeFile(wb, "planejamento_linhas_otcp.xlsx");
}