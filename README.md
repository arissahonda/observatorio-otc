# 🚌 Observatório do Transporte Público Coletivo (OTPC)

Este repositório contém a arquitetura da plataforma de dados e dashboards para análise de indicadores de mobilidade e transporte público coletivo.

## 🏗️ Arquitetura da Solução

### 1. Ingestão e Processamento (ETL)
* **Extração**: Leitura de dados operacionais (bilhetagem, validações e dados espaciais).
* **Transformação**:
  * Sanitização e mascaramento de informações identificáveis (LGPD).
  * Agregação de dados operacionais por faixas horárias e regiões administrativas.
  * Padronização de geometrias espaciais no formato PostGIS (SRID 4674 / SIRGAS 2000).
* **Carga**: Armazenamento otimizado no banco de dados relacional em esquema dedicado (`bd_git`).

## 🛠️ Tecnologias Utilizadas

* **Linguagem**: Python 3.12
* **Banco de Dados**: PostgreSQL 15+ / PostGIS hospedado no Supabase
* **Bibliotecas**: Pandas, GeoPandas, SQLAlchemy, Psycopg2, Streamlit e FastAPI
