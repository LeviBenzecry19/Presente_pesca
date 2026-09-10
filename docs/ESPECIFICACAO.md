# Pesca App — PWA para Pescadores

> Documento de produto original. As decisões técnicas do MVP estão em [ARQUITETURA.md](./ARQUITETURA.md).

## 1. Visão Geral

Progressive Web App (PWA) voltado para pescadores amadores e esportivos, com foco em **planejamento da pescaria** (data, local, clima e previsão de pesca), **acompanhamento em tempo real** durante a pescaria (início/fim, capturas) e, futuramente, **inteligência coletiva** para prever bons locais de pesca por espécie, com base no histórico agregado de capturas de todos os usuários.

Funciona offline (ou com conectividade limitada), já que o uso principal acontece em áreas remotas (rios, lagos, mar) com sinal instável.

## 2. Objetivo do Produto

- Ajudar o pescador a **planejar** a pescaria com informações confiáveis (clima + previsão de pesca).
- Facilitar o **registro** da pescaria e das capturas, de forma rápida e sem atrito, mesmo em campo.
- Construir, ao longo do tempo, uma **base de dados própria** de capturas geolocalizadas que alimente previsões cada vez mais precisas sobre onde e quando pescar determinada espécie.

## 3. Público-Alvo

- Pescadores amadores e esportivos (rio, lago, represa, mar).
- Usuários que já usam apps de clima e mapas, mas querem uma ferramenta específica para pesca.

## 4. Funcionalidades — MVP

### 4.1 Planejamento da Pescaria
- Usuário seleciona **data** e **local** (mapa interativo, busca por nome ou coordenadas/GPS).
- Possibilidade de salvar locais favoritos/recorrentes ("spots").

### 4.2 Informações Climáticas
- Consumo de API de clima (ex.: temperatura, vento, pressão atmosférica, fase da lua, índice de chuva, nascer/pôr do sol) para a data e local selecionados.
- Exibição de janela horária (não só o dia todo) — clima costuma variar bastante ao longo do dia de pesca.

### 4.3 Previsão de Pesca
- Espécies comuns na região selecionada (a partir de base de dados própria/curada e, futuramente, do histórico de capturas dos usuários — ver seção 5).
- Indicadores de "condição favorável" combinando clima + fase lunar + estação do ano (regras heurísticas no MVP; modelo preditivo depois).

### 4.4 Lembretes
- Notificação push (via Web Push) lembrando da pescaria agendada (ex.: X horas antes).
- Lembrete de itens/checklist opcional (isca, licença de pesca, protetor solar etc.).

### 4.5 Sessão de Pesca Ativa
- Botão "Iniciar Pesca" → marca **horário de início** e local (GPS).
- Botão "Encerrar Pesca" → marca **horário de fim**.
- Sessão ativa fica visível mesmo com app em background (PWA com service worker + notificação persistente, se o SO permitir).

### 4.6 Registro de Capturas
- Durante a sessão ativa, botão de destaque **"Registrar Captura"**.
- Ao acionar, abre formulário rápido:
  - Foto (câmera do dispositivo).
  - Espécie (seleção de lista + opção "outra").
  - Peso.
  - Tamanho (comprimento).
  - Local exato da captura (GPS automático, com opção de ajuste manual).
  - Observações livres (isca usada, técnica, profundidade etc.).
- Cada captura fica associada à sessão de pesca (data, local, horário da captura dentro da sessão).
- A mesma tela edita e exclui uma captura já registrada (`/captura?trip=…&id=…`).

### 4.7 Álbum e Conquistas
- **Álbum** (`/album`): todas as capturas do perfil em grade, com busca por espécie, filtro de "só com foto" e ordenação por mais recente ou mais pesada.
- **Conquistas** (`/estatisticas`): total de peixes, pescarias concluídas, espécies identificadas, recordes de peso e comprimento, melhor dia e horas de pesca.
- **Comparar** (`/comparar`): o app é presente de família e roda com vários perfis no mesmo aparelho, então os números de todos aparecem lado a lado — quem pescou mais peixes, quem fisgou o maior e quem teve o melhor dia.
  - Empates dividem a mesma colocação; quem não registrou a medida da disputa fica sem colocação, nunca em último por ausência de dado.
  - Cada disputa mostra a regra do que entra na conta, e a comparação nunca sai do aparelho.

## 5. Funcionalidades Futuras (V2+)

### 5.1 Previsão de Locais por Espécie (Machine Learning / Crowdsourcing)
- Uso do histórico agregado de capturas (espécie + local + data + clima no momento) de todos os usuários para treinar um modelo que sugira:
  - Locais com maior probabilidade de captura de uma espécie específica.
  - Melhores janelas de horário/condição climática por espécie e região.
- Abordagem sugerida: começar com heurísticas estatísticas simples (frequência de captura por local/espécie) e evoluir para um modelo mais robusto (ex.: gradient boosting) conforme o volume de dados cresce.
- Necessário desenhar o schema de dados desde o MVP pensando nessa evolução (ver seção 7), mesmo que o modelo só seja treinado depois.

### 5.2 Outras ideias futuras
- Comunidade: feed de capturas públicas (opt-in), ranking de maiores capturas por espécie/região.
- Integração com licenças de pesca / períodos de piracema (defeso) por região, com alerta de restrição.
- Exportação de relatório de pescarias (histórico, estatísticas pessoais).

## 6. Requisitos Técnicos do PWA

- **Manifest.json** completo (ícones, nome, cor de tema, `display: standalone`).
- **Service Worker** com estratégia de cache offline-first para telas principais e último clima/previsão consultados.
- **Fila de sincronização offline**: capturas registradas sem internet devem ficar salvas localmente (IndexedDB) e sincronizar automaticamente quando a conexão voltar (Background Sync API, quando suportado).
- **Geolocalização** via `navigator.geolocation`.
- **Acesso à câmera** via `<input type="file" accept="image/*" capture="environment">` ou `getUserMedia`.
- **Web Push Notifications** para lembretes.
- Instalável (Add to Home Screen) em Android e, com limitações, iOS.

## 7. Modelo de Dados (entidades principais)

- **User**: id, nome, email, localização padrão, preferências.
- **FishingSpot** (local salvo): id, user_id, nome, coordenadas, observações.
- **FishingTrip** (sessão de pesca): id, user_id, data_planejada, local (coordenadas), horário_início, horário_fim, clima_snapshot (json), status (planejada/em andamento/concluída).
- **Catch** (captura): id, trip_id, espécie, peso, tamanho, coordenadas, horário, foto_url, observações.
- **WeatherSnapshot**: id, trip_id ou coordenadas+data, dados climáticos consultados.
- **SpeciesInfo** (base curada): id, nome, regiões comuns, iscas recomendadas, período de defeso (se aplicável).

> Esse modelo já deixa `Catch` com coordenadas + espécie + horário + clima_snapshot da trip, que são exatamente os campos necessários para alimentar o modelo preditivo da seção 5.1 no futuro.

## 8. Integrações Externas / APIs

- **Clima**: Open-Meteo (tier gratuito, sem API key).
- **Mapas**: Leaflet + OpenStreetMap.
- **Fase lunar / dados de maré**: fase lunar calculada localmente; maré fica para escopo futuro.
- **Armazenamento de fotos**: serviço de storage S3-compatible (no backend).

## 9. Considerações de UX

- Fluxo de "Registrar Captura" precisa ser **muito rápido** (poucos toques) — o pescador está com as mãos ocupadas/molhadas em campo.
- Botões grandes, alto contraste (uso sob luz solar direta).
- Funcionar bem offline é requisito, não opcional.
- Bateria: minimizar uso de GPS contínuo — capturar localização só nos eventos relevantes (início/fim de sessão, registro de captura).

## 10. Roadmap

1. **Fase 1 — MVP**: planejamento (data/local) + clima + lembretes + sessão de pesca (início/fim) + registro de captura com foto/espécie/peso/tamanho, funcionando offline com sincronização posterior.
2. **Fase 2**: base curada de espécies por região + heurísticas simples de "previsão de pesca".
3. **Fase 3**: comunidade/feed opcional de capturas.
4. **Fase 4**: modelo preditivo de locais por espécie baseado em dados agregados dos usuários.

## 11. Stack Técnica

- **Frontend**: Next.js (App Router) + React, PWA com service worker próprio.
- **Backend**: API própria (Node ou Python) — contrato em [backend/API.md](./backend/API.md).
- **Banco de dados**: PostgreSQL + PostGIS — schema inicial em [backend/schema.sql](./backend/schema.sql).
- **Storage de imagens**: bucket S3-compatible (Cloudflare R2, AWS S3).
