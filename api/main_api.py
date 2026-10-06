"""
Módulo: main_api.py
Descrição: API RESTful do Painel OTCP-DF com suporte a consultas de Frota, 
           Histórico Anual, camadas estáticas do Metrô e dados de faixa horária do Metrô.
"""

import datetime
import gzip
import json
import os
import tempfile
import traceback
import urllib.parse
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, Query, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from fpdf import FPDF
from sqlalchemy import create_engine, text
from dotenv import load_dotenv


# =============================================================================
# 1. CONFIGURAÇÃO DE AMBIENTE E BANCO DE DADOS
# =============================================================================
def carregar_configuracoes():
    pasta_api = os.path.dirname(os.path.abspath(__file__))
    pasta_raiz = os.path.abspath(os.path.join(pasta_api, ".."))
    
    caminhos = [
        os.path.join(pasta_api, "credenciais.env"),
        os.path.join(pasta_raiz, "credenciais.env"),
        os.path.join(pasta_api, ".env"),
        os.path.join(pasta_raiz, ".env"),
    ]
    for c in caminhos:
        if os.path.exists(c):
            load_dotenv(dotenv_path=c, override=True)
            return c
    return None

carregar_configuracoes()

def obter_engine_banco():
    carregar_configuracoes()
    u_d = os.getenv("DB_USER")
    p_d_raw = os.getenv("DB_PASS", "")
    p_d = urllib.parse.quote_plus(p_d_raw) if p_d_raw else ""
    h_d = os.getenv("DB_HOST")
    pt_d = os.getenv("DB_PORT", "5432")
    n_d = os.getenv("DB_NAME")

    if not h_d:
        return None

    url_conexao = f"postgresql+psycopg2://{u_d}:{p_d}@{h_d}:{pt_d}/{n_d}"
    return create_engine(url_conexao, pool_pre_ping=True)


# =============================================================================
# 1. VALIDADOR DE MODAL
# =============================================================================
def validar_modal(modal_str: str) -> str:
    """Garante suporte aos modais stpc, stpcr, brt e suas variações teóricas."""
    m = str(modal_str).strip().lower()
    modais_validos = ["stpc", "stpcr", "brt", "stpc_teorica", "stpcr_teorica"]
    return m if m in modais_validos else "stpc"


# =============================================================================
# 2. CLASSE GERADORA DE PDF
# =============================================================================
class RelatorioPDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 14)
        self.set_font('Helvetica', '', 10)
        self.cell(0, 6, 'Painel OTPC-DF | Relatório Operacional de Linhas', border=0, new_x="LMARGIN", new_y="NEXT", align='C')
        self.line(10, 22, 200, 22)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        data_str = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
        self.cell(0, 10, f'Gerado em {data_str} | Página {self.page_no()}', align='C')


# =============================================================================
# 3. VARIÁVEIS GLOBAIS DE CACHE EM MEMÓRIA RAM
# =============================================================================
CACHE_LINHAS_HOJE = {
    "conteudo_gzip": None,
    "timestamp": None
}

CACHE_HISTORICO_COMPLETO = {}
CACHE_HISTORICO_SIMPLIFICADO = {}
CACHE_HISTORICO_DIMENSIONAMENTO = {}


def carregar_dados_no_cache():
    global CACHE_LINHAS_HOJE
    engine = obter_engine_banco()
    if not engine:
        return

    query = text("""
        SELECT json_build_object(
            'sucesso', true,
            'total_linhas', COUNT(*),
            'dados', COALESCE(json_agg(
                json_build_object(
                    'LINHA_CODIGO', sit."LINHA_CODIGO",
                    'LINHA_DENOMINACAO', sit."LINHA_DENOMINACAO",
                    'OPERADORA', sit."OPERADORA",
                    'BACIA_OPERACAO', sit."BACIA_OPERACAO",
                    'SENTIDO_TRADUZIDO', CASE 
                        WHEN CAST(sit."SENTIDO_JOIN" AS VARCHAR) = '1' THEN 'IDA'
                        WHEN CAST(sit."SENTIDO_JOIN" AS VARCHAR) = '2' THEN 'VOLTA'
                        WHEN CAST(sit."SENTIDO_JOIN" AS VARCHAR) = '3' THEN 'CIRCULAR'
                        ELSE CAST(sit."SENTIDO_JOIN" AS VARCHAR)
                    END,
                    'TIPO_DIA', sit."TIPO_DIA",
                    'FLG_DIA_ATUAL', sit."FLG_DIA_ATUAL",
                    'FROTA_PLANEJADA', sit."FROTA_PLANEJADA",
                    'VIAGENS_PLANEJADAS', sit."VIAGENS_PLANEJADAS",
                    'DURACAO', sit."DURACAO",
                    'HW_OPERADOR', sit."HW_OPERADOR",
                    'HW_PASSAGEIRO', sit."HW_PASSAGEIRO",
                    'EXTENSAO_KM', sit."EXTENSAO_KM",
                    'PRODUCAO_KM', sit."PRODUCAO_KM",
                    'FROTA_ALOCADA', sit."FROTA_ALOCADA",
                    'FROTA_REAPROVEITADA', sit."FROTA_REAPROVEITADA",
                    'TARIFA_USUARIO', sit."TARIFA_USUARIO",
                    'TARIFA_TECNICA', sit."TARIFA_TECNICA",
                    'ID_LINHA', sit."ID_LINHA",
                    'geojson_geom', ST_AsGeoJSON(
                        ST_Transform(ST_SetSRID(bdg.geometry, 31983), 4326),
                        5
                    )::json
                )
            ), '[]'::json)
        )::text AS json_completo
        FROM "painel_mobilidade"."snp_sit_planejamento_hoje" sit
        INNER JOIN "painel_mobilidade"."snp_bdg_itinerarios" bdg
            ON sit."ID_LINHA" = bdg."ID_LINHA"
        WHERE CAST(sit."FLG_DIA_ATUAL" AS VARCHAR) = '1';
    """)

    try:
        with engine.connect() as conn:
            resultado_str = conn.execute(query).scalar()
            if resultado_str:
                bytes_gzip = gzip.compress(resultado_str.encode('utf-8'))
                CACHE_LINHAS_HOJE["conteudo_gzip"] = bytes_gzip
                CACHE_LINHAS_HOJE["timestamp"] = datetime.datetime.now()
                tamanho_mb = len(bytes_gzip) / (1024 * 1024)
                print(f"✅ [STARTUP] Cache pré-compactado com sucesso! Tamanho final: {tamanho_mb:.2f} MB")
    except Exception as e:
        print(f"⚠️ [STARTUP] Falha ao aquecer cache inicial: {e}")


# =============================================================================
# 4. GERENCIADOR DE LIFESPAN
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 [STARTUP] Aquecendo e compactando cache das linhas de ônibus...")
    carregar_dados_no_cache()
    yield
    print("🛑 [SHUTDOWN] Encerrando API...")


# =============================================================================
# 5. APLICAÇÃO FASTAPI
# =============================================================================
app = FastAPI(
    title="API Painel OTPC-DF", 
    version="2.5.0",
    lifespan=lifespan
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# 6. ENDPOINTS DE MAPA E CACHE
# =============================================================================

@app.get("/api/v1/mapa/linhas-hoje")
def obter_linhas_mapa_hoje():
    global CACHE_LINHAS_HOJE

    if CACHE_LINHAS_HOJE["conteudo_gzip"] is not None:
        return Response(
            content=CACHE_LINHAS_HOJE["conteudo_gzip"], 
            media_type="application/json",
            headers={"Content-Encoding": "gzip"}
        )

    carregar_dados_no_cache()
    
    if CACHE_LINHAS_HOJE["conteudo_gzip"] is not None:
        return Response(
            content=CACHE_LINHAS_HOJE["conteudo_gzip"], 
            media_type="application/json",
            headers={"Content-Encoding": "gzip"}
        )
    
    return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Erro ao carregar dados do mapa."})


@app.get("/api/v1/mapa/limpar-cache-linhas")
def limpar_cache_linhas():
    global CACHE_LINHAS_HOJE, CACHE_HISTORICO_COMPLETO, CACHE_HISTORICO_SIMPLIFICADO, CACHE_HISTORICO_DIMENSIONAMENTO
    CACHE_LINHAS_HOJE["conteudo_gzip"] = None
    CACHE_LINHAS_HOJE["timestamp"] = None
    CACHE_HISTORICO_COMPLETO.clear()
    CACHE_HISTORICO_SIMPLIFICADO.clear()
    CACHE_HISTORICO_DIMENSIONAMENTO.clear()
    return {"sucesso": True, "mensagem": "Cache de memória RAM limpo com sucesso!"}


# =============================================================================
# 7. ENDPOINTS DE FROTA (HISTÓRICO PICO E SNAPSHOT CADASTRO)
# =============================================================================

@app.get("/api/v1/frota/historico-pico")
def obter_historico_frota_pico(data_pico: str = Query(None)):
    """
    Retorna os dados da frota no pico para integração com o painel Planejado vs Operado.
    Consulta a tabela: hist_sit_frota_pico
    """
    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    params = {}
    filtro_sql = ""
    if data_pico:
        filtro_sql = 'WHERE REPLACE(TRIM(CAST("DATA_REFERENCIA" AS VARCHAR)), \' \', \'\') ILIKE REPLACE(:data_pico, \' \', \'\')'
        params["data_pico"] = data_pico.strip()

    query = text(f"""
        SELECT json_build_object(
            'sucesso', true,
            'total_registros', COUNT(*),
            'dados', COALESCE(json_agg(to_jsonb(f.*)), '[]'::json)
        )::text AS json_completo
        FROM "painel_mobilidade"."hist_sit_frota_pico" f
        {filtro_sql};
    """)

    try:
        with engine.connect() as conn:
            resultado_json = conn.execute(query, params).scalar()
            if resultado_json:
                return Response(content=resultado_json, media_type="application/json")
            return JSONResponse(status_code=404, content={"sucesso": False, "erro": "Nenhum registro de frota no pico encontrado."})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})


@app.get("/api/v1/frota/snapshot-cadastro")
def obter_cadastro_frota_snapshot(
    operadora: str = Query(None),
    situacao_vistoria: str = Query(None),
    tipo_combustivel: str = Query(None)
):
    """
    Retorna os dados cadastrais da frota atualizada diariamente.
    Consulta a tabela: snp_sit_frota_cadastro
    """
    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    params = {}
    filtros_sql = []

    if operadora:
        filtros_sql.append('f."operadora" ILIKE :operadora')
        params["operadora"] = f"%{operadora}%"

    if situacao_vistoria:
        filtros_sql.append('f."situacao_vistoria" ILIKE :situacao_vistoria')
        params["situacao_vistoria"] = f"%{situacao_vistoria}%"

    if tipo_combustivel:
        filtros_sql.append('f."tipo_combustivel" ILIKE :tipo_combustivel')
        params["tipo_combustivel"] = f"%{tipo_combustivel}%"

    clausula_where = ("WHERE " + " AND ".join(filtros_sql)) if filtros_sql else ""

    query = text(f"""
        SELECT json_build_object(
            'sucesso', true,
            'total_registros', COUNT(*),
            'dados', COALESCE(json_agg(to_jsonb(f.*)), '[]'::json)
        )::text AS json_completo
        FROM "painel_mobilidade"."snp_sit_frota_cadastro" f
        {clausula_where};
    """)

    try:
        with engine.connect() as conn:
            resultado_json = conn.execute(query, params).scalar()
            if resultado_json:
                return Response(content=resultado_json, media_type="application/json")
            return JSONResponse(status_code=404, content={"sucesso": False, "erro": "Nenhum registro no cadastro de frota encontrado."})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})
    

# =============================================================================
# 8. ENDPOINTS DE INDICADORES HISTÓRICOS, ANUAIS E METRÔ
# =============================================================================

# =============================================================================
# 8.1 ENDPOINT DE DATAS DISPONÍVEIS
# =============================================================================
@app.get("/api/v1/indicadores/datas-disponiveis")
def obter_datas_disponiveis(tabela: str = Query("pico"), modal: str = Query("stpc")):
    """
    Retorna as datas disponíveis garantindo o mapeamento direto e exclusivo da tabela 
    correspondente ao modal e painel solicitado.
    """
    modal_limpo = validar_modal(modal)
    modal_base = modal_limpo.replace("_teorica", "")

    # Mapeamento estrito de tabelas sem fallback cruzado
    if "teorica" in modal_limpo or tabela == "pico_teorica":
        nome_tabela_sql = f"hist_ind_simplificado_pico_{modal_base}"
    elif tabela == "dimensionamento":
        nome_tabela_sql = f"hist_analise_dime_pico_{modal_base}"
    elif tabela in ["metro", "tdmax"]:
        nome_tabela_sql = f"hist_tdmax_faixa_horaria_{modal_base}"
    else:
        # Painel "Planejado vs Operado" (Histórico Consolidado Real)
        nome_tabela_sql = f"hist_ind_consolidados_pico_{modal_base}"

    col_data = "DATA_REFERENCIA" if tabela in ["metro", "tdmax"] else "DATA_PICO"

    engine = obter_engine_banco()
    if not engine:
        return {"sucesso": False, "datas": [], "erro": "Sem conexão com o banco de dados."}

    query = text(f"""
        SELECT "{col_data}" AS data_disponivel
        FROM "painel_mobilidade"."{nome_tabela_sql}"
        WHERE "{col_data}" IS NOT NULL AND TRIM(CAST("{col_data}" AS VARCHAR)) != ''
        GROUP BY "{col_data}"
        ORDER BY 
            CASE 
                WHEN CAST("{col_data}" AS VARCHAR) ~ '^\\d{{2}}/\\d{{2}}/\\d{{4}}$' THEN TO_DATE(CAST("{col_data}" AS VARCHAR), 'DD/MM/YYYY')
                ELSE NULL 
            END DESC NULLS LAST,
            "{col_data}" DESC;
    """)

    try:
        with engine.connect() as conn:
            res = conn.execute(query).fetchall()
            datas = [row[0] for row in res if row[0]]
            return {"sucesso": True, "modal": modal_limpo, "datas": datas}
    except Exception as e:
        print(f"❌ [ERRO API DATAS] Tabela {nome_tabela_sql}: {e}")
        return {"sucesso": False, "datas": [], "erro": str(e)}
    
# =============================================================================
# 8.2 ENDPOINT DE HISTÓRICO ANUAL
# =============================================================================
@app.get("/api/v1/indicadores/historico-anual")
def obter_historico_anual(
    ano: str = Query("2026"), 
    modal: str = Query("stpc")
):
    modal_limpo = validar_modal(modal)
    engine = obter_engine_banco()
    
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    if "teorica" in modal_limpo:
        modal_base = modal_limpo.replace("_teorica", "")
        nome_tabela = f"hist_ind_simplificado_pico_{modal_base}"
    else:
        nome_tabela = f"hist_ind_consolidados_pico_{modal_limpo}"

    query = text(f"""
        SELECT 
            TO_CHAR(TO_DATE(TRIM(CAST(hist."DATA_PICO" AS VARCHAR)), 'DD/MM/YYYY'), 'MM/YYYY') AS mes_ano,
            ROUND(AVG(CAST(hist."IPK" AS NUMERIC)), 2) AS ipk_medio,
            SUM(CAST(hist."CUSTO_SERVICO" AS NUMERIC)) AS custo_total,
            SUM(CAST(hist."ARRECADACAO_DIA" AS NUMERIC)) AS arrecadacao_total,
            SUM(CAST(hist."VALOR_SUBSIDIO" AS NUMERIC)) AS subsidio_total,
            SUM(CAST(hist."TOTAL_PASSAGEIROS" AS NUMERIC)) AS passageiros_total
        FROM "painel_mobilidade"."{nome_tabela}" hist
        WHERE TRIM(CAST(hist."DATA_PICO" AS VARCHAR)) LIKE :ano_pattern
        GROUP BY TO_CHAR(TO_DATE(TRIM(CAST(hist."DATA_PICO" AS VARCHAR)), 'DD/MM/YYYY'), 'MM/YYYY')
        ORDER BY mes_ano ASC;
    """)

    try:
        with engine.connect() as conn:
            resultado = conn.execute(query, {"ano_pattern": f"%/{ano}"}).mappings().fetchall()
            return {"sucesso": True, "modal": modal_limpo, "ano": ano, "dados": [dict(r) for r in resultado]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})

# =============================================================================
# 8.3 ENDPOINT METRÔ POR FAIXA HORÁRIA
# =============================================================================
@app.get("/api/v1/indicadores/metro-faixa-horaria")
def obter_metro_faixa_horaria(data_pico: str = Query(...)):
    """Retorna os dados detalhados de faixa horária do Metrô por estação."""
    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    data_limpa = data_pico.strip() if data_pico else ""

    query = text("""
        SELECT 
            "INTERVALO",
            TRIM(CAST("LINHA_CODIGO" AS VARCHAR)) AS "LINHA_CODIGO",
            COALESCE("LINHA_DENOMINACAO", 'Estação Desconhecida') AS "ESTACAO",
            SUM(COALESCE(CAST("COMUM_NORMAL" AS NUMERIC), 0)) AS comum_normal,
            SUM(COALESCE(CAST("COMUM_INTEGRACAO" AS NUMERIC), 0)) AS comum_integracao,
            SUM(COALESCE(CAST("VT_NORMAL" AS NUMERIC), 0)) AS vt_normal,
            SUM(COALESCE(CAST("VT_INTEGRACAO" AS NUMERIC), 0)) AS vt_integracao,
            SUM(COALESCE(CAST("PAGANTES" AS NUMERIC), 0)) AS pagantes,
            SUM(COALESCE(CAST("CONTACTLESS" AS NUMERIC), 0)) AS contactless,
            SUM(COALESCE(CAST("PNE" AS NUMERIC), 0)) AS pne,
            SUM(COALESCE(CAST("PNE_ACOMPANHANTE" AS NUMERIC), 0)) AS pne_acompanhante,
            SUM(COALESCE(CAST("GRATUITOS" AS NUMERIC), 0)) AS gratuitos,
            SUM(COALESCE(CAST("IDOSO" AS NUMERIC), 0)) AS idoso,
            SUM(COALESCE(CAST("CRIANCA" AS NUMERIC), 0)) AS crianca,
            SUM(COALESCE(CAST("FUNCIONARIOS" AS NUMERIC), 0)) AS funcionarios,
            SUM(COALESCE(CAST("VIOLENCIA_DOMESTICA" AS NUMERIC), 0)) AS violencia_domestica,
            SUM(COALESCE(CAST("TOTAL_ESTUDANTES" AS NUMERIC), 0)) AS total_estudantes,
            SUM(COALESCE(CAST("TOTAL_PAGANTES" AS NUMERIC), 0)) AS total_pagantes,
            SUM(COALESCE(CAST("TOTAL_GRATUIDADES" AS NUMERIC), 0)) AS total_gratuidades,
            SUM(COALESCE(CAST("TOTAL_INTEGRACOES" AS NUMERIC), 0)) AS total_integracoes,
            SUM(COALESCE(CAST("TOTAL_PASSAGEIROS" AS NUMERIC), 0)) AS total_passageiros,
            SUM(COALESCE(CAST("ARRECADACAO_DIA" AS NUMERIC), 0)) AS arrecadacao_dia
        FROM "painel_mobilidade"."hist_tdmax_faixa_horaria_metro"
        WHERE REPLACE(TRIM(CAST("DATA_REFERENCIA" AS VARCHAR)), ' ', '') ILIKE REPLACE(:data_pico, ' ', '')
        GROUP BY "INTERVALO", "LINHA_CODIGO", "LINHA_DENOMINACAO"
        ORDER BY "INTERVALO" ASC;
    """)

    try:
        with engine.connect() as conn:
            resultado = conn.execute(query, {"data_pico": data_limpa}).mappings().fetchall()
            return {"sucesso": True, "dados": [dict(r) for r in resultado]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})


# =============================================================================
# 8.4 ENDPOINT DE HISTÓRICO COMPLETO (SEPARAÇÃO ESTRITA POR PAINEL)
# =============================================================================
@app.get("/api/v1/indicadores/historico-completo")
def obter_historico_completo(
    data: str = Query(...), 
    modal: str = Query("stpc")
):
    """
    Retorna os indicadores consolidados históricos ou teóricos.
    Mapeia diretamente para a tabela específica de cada painel sem realizar fallbacks.
    """
    data_limpa = data.strip() if data else ""
    modal_limpo = validar_modal(modal)
    chave_cache = f"{data_limpa}_{modal_limpo}"

    # Retorna do cache em memória se a consulta já tiver sido realizada
    if chave_cache in CACHE_HISTORICO_COMPLETO:
        return Response(content=CACHE_HISTORICO_COMPLETO[chave_cache], media_type="application/json")

    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    # Definição direta da tabela alvo com base no modal recebido
    if "teorica" in modal_limpo:
        modal_base = modal_limpo.replace("_teorica", "")
        nome_tabela = f"hist_ind_simplificado_pico_{modal_base}"
    else:
        nome_tabela = f"hist_ind_consolidados_pico_{modal_limpo}"

    query = text(f"""
        SELECT json_build_object(
            'sucesso', true,
            'tipo_visao', 'COMPLETA',
            'modal', :modal,
            'data_pico', :data_pico,
            'total_registros', COUNT(*),
            'total_passageiros', COALESCE(SUM(hist."TOTAL_PASSAGEIROS"), 0),
            'dados', COALESCE(
                json_agg(
                    (to_jsonb(hist.*) - 'geometry') || jsonb_build_object(
                        'ID_LINHA', hist."ID_LINHA",
                        'geojson_geom', CASE 
                            WHEN hist.geometry IS NOT NULL THEN
                                ST_AsGeoJSON(
                                    ST_Transform(
                                        ST_SetSRID(ST_SimplifyPreserveTopology(ST_MakeValid(hist.geometry), 10), 31983), 
                                        4326
                                    ), 4
                                )::jsonb
                            ELSE NULL
                        END
                    )
                ), 
                '[]'::json
            )
        )::text AS json_completo
        FROM "painel_mobilidade"."{nome_tabela}" hist
        WHERE REPLACE(TRIM(CAST(hist."DATA_PICO" AS VARCHAR)), ' ', '') ILIKE REPLACE(:data_pico, ' ', '');
    """)

    try:
        with engine.connect() as conn:
            resultado_json = conn.execute(query, {"data_pico": data_limpa, "modal": modal_limpo}).scalar()
            if resultado_json:
                CACHE_HISTORICO_COMPLETO[chave_cache] = resultado_json
                return Response(content=resultado_json, media_type="application/json")
            
            return JSONResponse(
                status_code=404, 
                content={"sucesso": False, "erro": f"Nenhum dado encontrado na tabela '{nome_tabela}' para a data {data_limpa}."}
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})

# =============================================================================
# 8.5 ENDPOINT DE DIMENSIONAMENTO DO PICO
# =============================================================================
@app.get("/api/v1/indicadores/historico-dimensionamento-pico")
def obter_historico_dimensionamento_pico(
    data: str = Query(...),
    modal: str = Query("stpc"),
    bacia_id: str = Query(None),
    operadora: str = Query(None),
    linha_codigo: str = Query(None),
    flg_sem_carregamento: str = Query(None)
):
    """
    Retorna os dados de análise de dimensionamento por faixa horária/pico
    para os modais STPC, STPCR e BRT sem realizar cruzamentos externos,
    preservando 100% das colunas nativas da tabela.
    """
    data_limpa = data.strip() if data else ""
    modal_limpo = validar_modal(modal)
    chave_cache = f"{data_limpa}_{modal_limpo}_{bacia_id}_{operadora}_{linha_codigo}_{flg_sem_carregamento}"

    # Retorna o resultado direto do cache em memória se disponível
    if chave_cache in CACHE_HISTORICO_DIMENSIONAMENTO:
        return Response(content=CACHE_HISTORICO_DIMENSIONAMENTO[chave_cache], media_type="application/json")

    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    # Seleção dinâmica da tabela de acordo com o modal solicitado (stpc, stpcr ou brt)
    nome_tabela = f"hist_analise_dim_pico_{modal_limpo}"

    params = {"data_pico": data_limpa, "modal": modal_limpo}
    filtros_sql = ""

    if bacia_id:
        filtros_sql += ' AND hist."BACIA_ID" = :bacia_id'
        params["bacia_id"] = bacia_id

    if operadora:
        filtros_sql += ' AND hist."OPERADORA" ILIKE :operadora'
        params["operadora"] = f"%{operadora}%"

    if linha_codigo:
        filtros_sql += ' AND hist."LINHA_CODIGO" = :linha_codigo'
        params["linha_codigo"] = linha_codigo

    if flg_sem_carregamento:
        filtros_sql += ' AND hist."FLG_SEM_CARREGAMENTO" = :flg_sem_carregamento'
        params["flg_sem_carregamento"] = flg_sem_carregamento.strip()

    # Consulta direta na tabela do modal sem JOINs externos
    query = text(f"""
        SELECT json_build_object(
            'sucesso', true,
            'tipo_visao', 'DIMENSIONAMENTO_PICO',
            'modal', :modal,
            'data_pico', :data_pico,
            'total_registros', COUNT(*),
            'total_passageiros', COALESCE(SUM(hist."TOTAL_PASSAGEIROS"), 0),
            'dados', COALESCE(
                json_agg(to_jsonb(hist.*)), 
                '[]'::json
            )
        )::text AS json_completo
        FROM "painel_mobilidade"."{nome_tabela}" hist
        WHERE REPLACE(TRIM(CAST(hist."DATA_PICO" AS VARCHAR)), ' ', '') ILIKE REPLACE(:data_pico, ' ', '')
        {filtros_sql};
    """)

    try:
        with engine.connect() as conn:
            resultado_json = conn.execute(query, params).scalar()
            if resultado_json:
                CACHE_HISTORICO_DIMENSIONAMENTO[chave_cache] = resultado_json
                return Response(content=resultado_json, media_type="application/json")
            return JSONResponse(status_code=404, content={"sucesso": False, "erro": f"Nenhum dado encontrado para a data {data_limpa} no modal {modal_limpo.upper()}."})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})

# =============================================================================
# 8.6 ENDPOINT DE CARREGAMENTO POR FAIXA HORÁRIA
# =============================================================================
@app.get("/api/v1/indicadores/carregamento-faixa-horaria")
def obter_carregamento_faixa_horaria(
    data_pico: str = Query(...),
    modal: str = Query("stpc"),
    bacia_id: str = Query(None),
    operadora: str = Query(None),
    linha_codigo: str = Query(None)
):
    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    data_limpa = data_pico.strip() if data_pico else ""
    modal_limpo = validar_modal(modal)
    nome_tabela = f"historico_tdmax_faixa_horaria_{modal_limpo}"

    params = {"data_pico": data_limpa}
    filtros_sql = ""

    if bacia_id:
        filtros_sql += ' AND hist."BACIA_ID" = :bacia_id'
        params["bacia_id"] = bacia_id
    
    if operadora:
        filtros_sql += ' AND hist."OPERADORA" ILIKE :operadora'
        params["operadora"] = f"%{operadora}%"
        
    if linha_codigo:
        filtros_sql += ' AND hist."LINHA_CODIGO" = :linha_codigo'
        params["linha_codigo"] = linha_codigo

    query = text(f"""
        SELECT 
            hist."INTERVALO",
            COALESCE(hist."ID_LINHA", sit."ID_LINHA") AS "ID_LINHA",
            SUM(COALESCE(CAST(hist."TOTAL_PASSAGEIROS" AS NUMERIC), 0)) AS total_passageiros,
            SUM(COALESCE(CAST(hist."TOTAL_PAGANTES" AS NUMERIC), 0)) AS total_pagantes,
            SUM(COALESCE(CAST(hist."TOTAL_ESTUDANTES" AS NUMERIC), 0)) AS total_estudantes,
            SUM(COALESCE(CAST(hist."TOTAL_GRATUIDADES" AS NUMERIC), 0)) AS total_gratuidades,
            SUM(COALESCE(CAST(hist."TOTAL_INTEGRACOES" AS NUMERIC), 0)) AS total_integracoes,
            SUM(COALESCE(CAST(hist."ARRECADACAO_DIA" AS NUMERIC), 0)) AS arrecadacao_dia,
            SUM(COALESCE(CAST(hist."VIAGENS_TDMAX" AS NUMERIC), 0)) AS viagens_tdmax
        FROM "painel_mobilidade"."{nome_tabela}" hist
        LEFT JOIN "painel_mobilidade"."snapshot_sit_planejamento_pico" sit
            ON CAST(hist."ID_LINHA" AS VARCHAR) = CAST(sit."ID_LINHA" AS VARCHAR)
        WHERE REPLACE(TRIM(CAST(hist."DATA_REFERENCIA" AS VARCHAR)), ' ', '') ILIKE REPLACE(:data_pico, ' ', '')
        {filtros_sql}
        GROUP BY hist."INTERVALO", COALESCE(hist."ID_LINHA", sit."ID_LINHA")
        ORDER BY hist."INTERVALO" ASC;
    """)

    try:
        with engine.connect() as conn:
            resultado = conn.execute(query, params).mappings().fetchall()
            return {"sucesso": True, "modal": modal_limpo, "dados": [dict(r) for r in resultado]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})


# =============================================================================
# 9. CAMADAS ESPACIAIS E EXPORTAÇÃO
# =============================================================================

@app.get("/api/v1/mapa/camada-estatica/{nome_tabela}")
def obter_camada_estatica(nome_tabela: str):
    """Retorna o GeoJSON das camadas estáticas (incluindo estações e linhas do Metrô)."""
    colunas_geometria = {
        "tb_regioes_administrativas": "geom",
        "tb_ponto_parada_v2025": "geom",
        "tb_terminais": "geometry",
        "tb_catracas": "geometry",
        "tb_estacao_metro": "geom",
        "tb_linha_metro": "geom"
    }

    if nome_tabela not in colunas_geometria:
        return JSONResponse(status_code=400, content={"sucesso": False, "erro": "Tabela não permitida."})

    col_geom = colunas_geometria[nome_tabela]
    engine = obter_engine_banco()

    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    query = text(f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Transform(ST_SetSRID("{col_geom}", 31983), 4326))::json,
                    'properties', to_jsonb(t.*) - '{col_geom}'
                )
            ), '[]'::json)
        )::text AS geojson_completo
        FROM "painel_mobilidade"."{nome_tabela}" t;
    """)

    try:
        with engine.connect() as conn:
            resultado_geojson = conn.execute(query).scalar()
            return Response(content=resultado_geojson, media_type="application/json")
    except Exception as e:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": str(e)})


# =============================================================================
# PONTO DE ENTRADA DO SERVIDOR FASTAPI
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main_api:app", host="0.0.0.0", port=8000, reload=True)