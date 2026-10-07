/**
 * Configuração Global da API - OTPC
 * Centraliza o endereço do backend para todos os módulos do sistema.
 */
const API_URL = (typeof window.ENV_API_URL !== 'undefined') 
    ? window.ENV_API_URL 
    : "https://observatorio-otc.onrender.com/api/v1";