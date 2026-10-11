"""
=============================================================================
Módulo: main_api.py
Descrição: API RESTful do Painel OTC conectada ao Supabase (Esquema bd_git).
           - Padronizado para utilizar estritamente a coluna de feição 'geom'.
           - Credenciais 100% ocultas e lidas via arquivo de ambiente (.env).
=============================================================================
"""

import datetime
import gzip
import json
import os
import traceback
import urllib.parse
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

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
        os.path.join(pasta_raiz, ".env")
    ]
    for c in caminhos:
        if os.path.exists(c):
            load_dotenv(dotenv_path=c, override=True)
            return c
    return None


def obter_engine_banco():
    carregar_configuracoes()
    
    u_d = os.getenv("DB_USER")
    p_d_raw = os.getenv("DB_PASS")
    p_d = urllib.parse.quote_plus(p_d_raw) if p_d_raw else ""
    h_d = os.getenv("DB_HOST")
    pt_d = os.getenv("DB_PORT", "5432")
    n_d = os.getenv("DB_NAME")

    if not h_d or not u_d:
        print("⚠️ [BANCO] Variáveis de conexão com o banco não encontradas no arquivo de ambiente!")
        return None

    url_conexao = f"postgresql+psycopg2://{u_d}:{p_d}@{h_d}:{pt_d}/{n_d}"
    return create_engine(url_conexao, pool_pre_ping=True)


def validar_modal(modal: str) -> str:
    if not modal:
        return "stu"
    return modal.lower().strip()


# =============================================================================
# 2. VARIÁVEIS GLOBAIS DE CACHE EM MEMÓRIA RAM
# =============================================================================
CACHE_LINHAS_HOJE = {
    "conteudo_gzip": None,
    "timestamp": None
}

CACHE_HISTORICO_COMPLETO = {}


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
                    'LINHA_CODIGO', sph."LINHA_CODIGO",
                    'LINHA_DENOMINACAO', sph."LINHA_DENOMINACAO",
                    'OPERADORA', sph."OPERADORA",
                    'BACIA_OPERACAO', sph."BACIA_OPERACAO",
                    'SENTIDO_TRADUZIDO', CASE 
                        WHEN CAST(sph."SENTIDO_JOIN" AS VARCHAR) = '1' THEN 'IDA'
                        WHEN CAST(sph."SENTIDO_JOIN" AS VARCHAR) = '2' THEN 'VOLTA'
                        WHEN CAST(sph."SENTIDO_JOIN" AS VARCHAR) = '3' THEN 'CIRCULAR'
                        ELSE CAST(sph."SENTIDO_JOIN" AS VARCHAR)
                    END,
                    'TIPO_DIA', sph."TIPO_DIA",
                    'FLG_DIA_ATUAL', sph."FLG_DIA_ATUAL",
                    'FROTA_PLANEJADA', sph."FROTA_PLANEJADA",
                    'VIAGENS_PLANEJADAS', sph."VIAGENS_PLANEJADAS",
                    'DURACAO', sph."DURACAO",
                    'HW_OPERADOR', sph."HW_OPERADOR",
                    'HW_PASSAGEIRO', sph."HW_PASSAGEIRO",
                    'EXTENSAO_KM', sph."EXTENSAO_KM",
                    'PRODUCAO_KM', sph."PRODUCAO_KM",
                    'FROTA_ALOCADA', sph."FROTA_ALOCADA",
                    'FROTA_REAPROVEITADA', sph."FROTA_REAPROVEITADA",
                    'TARIFA_USUARIO', sph."TARIFA_USUARIO",
                    'TARIFA_TECNICA', sph."TARIFA_TECNICA",
                    'ID_LINHA', sph."ID_LINHA",
                    'geojson_geom', CASE 
                        WHEN sph.geom IS NOT NULL THEN
                            ST_AsGeoJSON(
                                ST_Transform(ST_SetSRID(sph.geom, 31983), 4326),
                                5
                            )::json
                        ELSE NULL
                    END
                )
            ), '[]'::json)
        )::text AS json_completo
        FROM "bd_git"."snp_planejamento_hoje" sph
        WHERE CAST(sph."FLG_DIA_ATUAL" AS VARCHAR) = '1';
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
# 3. GERENCIADOR DE LIFESPAN
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 [STARTUP] Aquecendo e compactando cache das linhas de ônibus...")
    carregar_dados_no_cache()
    yield
    print("🛑 [SHUTDOWN] Encerrando API...")


# =============================================================================
# 4. APLICAÇÃO FASTAPI
# =============================================================================
app = FastAPI(
    title="API Painel OTC", 
    version="2.7.0",
    lifespan=lifespan
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Origens que têm permissão de consultar a API
origens_permitidas = [
    "http://127.0.0.1:5500",           
    "http://localhost:5500",                 
    "https://arissahonda.github.io",  
    "https://observatorio-otc-web.vercel.app/"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_permitidas,         
    allow_credentials=True,
    allow_methods=["GET"],                 
    allow_headers=["*"],
)


# =============================================================================
# 5. ENDPOINTS DE MAPA E CACHE
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
    global CACHE_LINHAS_HOJE, CACHE_HISTORICO_COMPLETO
    CACHE_LINHAS_HOJE["conteudo_gzip"] = None
    CACHE_LINHAS_HOJE["timestamp"] = None
    CACHE_HISTORICO_COMPLETO.clear()
    return {"sucesso": True, "mensagem": "Cache de memória RAM limpo com sucesso!"}


# =============================================================================
# 6. ENDPOINTS DE FROTA (HISTÓRICO PICO E SNAPSHOT CADASTRO)
# =============================================================================

@app.get("/api/v1/frota/historico-pico")
def obter_historico_frota_pico(data_pico: str = Query(None)):
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
        FROM "bd_git"."hist_frota_pico" f
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
        FROM "bd_git"."snp_frota_cadastro" f
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
# 7. ENDPOINTS DE INDICADORES HISTÓRICOS, ANUAIS E METRÔ
# =============================================================================

@app.get("/api/v1/indicadores/datas-disponiveis")
def obter_datas_disponiveis(tabela: str = Query("pico"), modal: str = Query("stu")):
    modal_limpo = validar_modal(modal)

    if "teorica" in modal_limpo or tabela == "pico_teorica":
        nome_tabela_sql = "hist_ind_simplificado_pico_stu"
    elif tabela in ["metro"]:
        nome_tabela_sql = "hist_faixa_horaria_metro"
    else:
        nome_tabela_sql = "hist_ind_consolidados_pico_stu"

    col_data = "DATA_REFERENCIA" if tabela in ["metro"] else "DATA_PICO"

    engine = obter_engine_banco()
    if not engine:
        return {"sucesso": False, "datas": [], "erro": "Sem conexão com o banco de dados."}

    query = text(f"""
        SELECT "{col_data}" AS data_disponivel
        FROM "bd_git"."{nome_tabela_sql}"
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


@app.get("/api/v1/indicadores/historico-anual")
def obter_historico_anual(
    ano: str = Query("2026"), 
    modal: str = Query("stu")
):
    modal_limpo = validar_modal(modal)
    engine = obter_engine_banco()
    
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    if "teorica" in modal_limpo:
        nome_tabela = "hist_ind_simplificado_pico_stu"
    else:
        nome_tabela = "hist_ind_consolidados_pico_stu"

    query = text(f"""
        SELECT 
            TO_CHAR(TO_DATE(TRIM(CAST(hist."DATA_PICO" AS VARCHAR)), 'DD/MM/YYYY'), 'MM/YYYY') AS mes_ano,
            ROUND(AVG(CAST(hist."IPK" AS NUMERIC)), 2) AS ipk_medio,
            SUM(CAST(hist."CUSTO_SERVICO" AS NUMERIC)) AS custo_total,
            SUM(CAST(hist."ARRECADACAO_DIA" AS NUMERIC)) AS arrecadacao_total,
            SUM(CAST(hist."VALOR_SUBSIDIO" AS NUMERIC)) AS subsidio_total,
            SUM(CAST(hist."TOTAL_PASSAGEIROS" AS NUMERIC)) AS passageiros_total
        FROM "bd_git"."{nome_tabela}" hist
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


@app.get("/api/v1/indicadores/metro-faixa-horaria")
def obter_metro_faixa_horaria(data_pico: str = Query(...)):
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
            SUM(COALESCE(CAST("TOTAL_ESTUDANTES" AS NUMERIC), 0)) AS total_estudantes,
            SUM(COALESCE(CAST("TOTAL_PAGANTES" AS NUMERIC), 0)) AS total_pagantes,
            SUM(COALESCE(CAST("TOTAL_GRATUIDADES" AS NUMERIC), 0)) AS total_gratuidades,
            SUM(COALESCE(CAST("TOTAL_INTEGRACOES" AS NUMERIC), 0)) AS total_integracoes,
            SUM(COALESCE(CAST("TOTAL_PASSAGEIROS" AS NUMERIC), 0)) AS total_passageiros,
            SUM(COALESCE(CAST("ARRECADACAO_DIA" AS NUMERIC), 0)) AS arrecadacao_dia
        FROM "bd_git"."hist_faixa_horaria_metro"
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


@app.get("/api/v1/indicadores/historico-completo")
def obter_historico_completo(
    data: str = Query(...), 
    modal: str = Query("stu")
):
    data_limpa = data.strip() if data else ""
    modal_limpo = modal.lower().strip() if modal else "stu"
    chave_cache = f"{data_limpa}_{modal_limpo}"

    if chave_cache in CACHE_HISTORICO_COMPLETO:
        return Response(content=CACHE_HISTORICO_COMPLETO[chave_cache], media_type="application/json")

    engine = obter_engine_banco()
    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    # Seleção da tabela com base no modal recebido
    if "teorica" in modal_limpo:
        nome_tabela = "hist_ind_simplificado_pico_stu"
    else:
        nome_tabela = "hist_ind_consolidados_pico_stu"

    # Consulta SQL ajustada estritamente para a coluna padronizada 'geom'
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
                    (to_jsonb(hist.*) - 'geom') || jsonb_build_object(
                        'ID_LINHA', hist."ID_LINHA",
                        'geojson_geom', CASE 
                            WHEN hist.geom IS NOT NULL THEN
                                ST_AsGeoJSON(
                                    ST_Transform(
                                        ST_SetSRID(
                                            ST_SimplifyPreserveTopology(
                                                ST_MakeValid(hist.geom), 
                                                10
                                            ), 
                                            31983
                                        ), 
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
        FROM "bd_git"."{nome_tabela}" hist
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
# 8. CAMADAS ESPACIAIS DE APOIO
# =============================================================================

@app.get("/api/v1/mapa/camada-estatica/{nome_tabela}")
def obter_camada_estatica(nome_tabela: str):
    tabelas_permitidas = [
        "tb_regioes_administrativas",
        "tb_ponto_parada_v2025",
        "tb_terminais",
        "tb_estacao_metro",
        "tb_linha_metro"
    ]

    if nome_tabela not in tabelas_permitidas:
        return JSONResponse(status_code=400, content={"sucesso": False, "erro": "Tabela não permitida."})

    engine = obter_engine_banco()

    if not engine:
        return JSONResponse(status_code=500, content={"sucesso": False, "erro": "Sem conexão com o banco de dados."})

    query = text(f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Transform(ST_SetSRID("geom", 31983), 4326))::json,
                    'properties', to_jsonb(t.*) - 'geom'
                )
            ), '[]'::json)
        )::text AS geojson_completo
        FROM "bd_git"."{nome_tabela}" t;
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