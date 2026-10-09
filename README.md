# Ônibus de Foz do Iguaçu

Aplicativo web progressivo (PWA) para consultar linhas, horários e localização em tempo real dos ônibus do transporte coletivo de Foz do Iguaçu.

## Visão geral

Este projeto entrega uma experiência de mapa e itinerários em uma única página, com interface otimizada para celular e instalação na tela inicial. Ele funciona como um app leve, sem necessidade de loja de aplicativos ou build step complexo.

A aplicação principal está em `index.html`, com:

- mapa interativo em Leaflet
- busca por linhas e pontos de interesse
- painel de horários e rotas
- integração com dados externos vindos de Apps Script
- comportamento offline parcial via Service Worker
- instalação como PWA em Android e iPhone

## Funcionalidades

- consulta de linhas por número ou nome
- visualização dos pontos e itinerários no mapa
- detalhes de horários e próximas saídas
- busca do ponto de origem e destino
- geolocalização do usuário
- acompanhamento em tempo real da posição dos ônibus
- suporte para uso em dispositivos móveis em modo standalone
- cache offline dos recursos essenciais

## Estrutura do projeto

```text
.
├── index.html                  # shell principal da aplicação PWA
├── manifest.webmanifest        # instalação e identidade do app
├── sw.js                       # service worker de cache e atualização
├── README.md                   # documentação do projeto
├── package.json                # scripts de execução e validação
├── scripts/
│   └── validate.mjs            # cheque de estrutura e integridade
├── src/
│   ├── app.js                  # lógica da interface e mapa
│   └── styles.css              # estilos da aplicação
├── vendor/
│   └── leaflet.js              # biblioteca de mapa do projeto
├── icons/
│   ├── apple-touch-icon.png
│   ├── favicon-32.png
│   ├── icon-192.png
│   └── icon-512.png
├── .github/
│   └── workflows/
│       └── ci.yml              # validação automática em PR/push
├── .gitignore                  # arquivos locais e temporários
├── workflow-graph/             # dados do grafo AGF local
├── .agents/                    # skills e configuração do agente
├── AGENTS.md                   # regras de execução e guardrails do repo
└── .claude/                    # regras internas e testes do projeto
```

## Como executar localmente

Como é uma aplicação estática, o projeto pode ser servido por qualquer servidor HTTP simples.

### Opção 1: servidor local Python

```bash
python -m http.server 8000
```

Ou via script do projeto:

```bash
npm run start
```

Depois abra no navegador:

```text
http://localhost:8000
```

### Opção 2: servir em um ambiente web real

Publique todos os arquivos do diretório em um host HTTPS, por exemplo:

```text
https://mapa.foztrans.pr.gov.br/
```

> O projeto não deve ser servido dentro de uma página do WordPress ou como conteúdo embutido em um iframe; a instalação do PWA exige um endereço direto do site.

## Instalação como PWA

### Android (Chrome)

1. Abra o endereço do app no navegador.
2. Acesse o menu com três pontos.
3. Escolha "Adicionar à tela inicial" ou "Instalar aplicativo".

### iPhone (Safari)

1. Abra o endereço no navegador.
2. Toque em Compartilhar.
3. Selecione "Adicionar à Tela de Início".

## Atualização e manutenção

- linhas, horários e trajetos atualmente vêm de um endpoint externo via Apps Script
- a posição dos ônibus também é obtida de origem externa
- as alterações de conteúdo geralmente não exigem rebuild do app
- a atualização do HTML e dos recursos do front-end pode ser feita com upload dos arquivos no servidor

## Validação automatizada

Antes de abrir PR ou merge, execute:

```bash
npm run validate
```

Este comando confirma que:

- a aplicação está estruturada em módulos
- o HTML referencia o CSS e o JS corretos
- o arquivo PWA e o service worker existem
- o projeto mantém uma base mínima de integridade para CI

Também há um pipeline em GitHub Actions em `.github/workflows/ci.yml` para executar a validação em qualquer push/PR.

## Deploy no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` verifica os arquivos runtime de `main`, executa `npm run validate` em `develop` e publica ambas no mesmo site: `main` na raiz (produção) e `develop` em `/dev/` (desenvolvimento). Push em qualquer uma dessas branches reconstrói o artefato com as duas versões; também é possível iniciar o workflow manualmente pela aba **Actions**. Não há etapa de build de framework.

Para habilitar a publicação, configure **Settings → Pages → Build and deployment → Source → GitHub Actions** no repositório. A branch remota `develop` precisa existir e conter a estrutura validada da PWA. Após o workflow rodar, a versão de produção fica na raiz e a de desenvolvimento em `/dev/`.

## Funcionalidade offline

O aplicativo usa `sw.js` para armazenar em cache recursos importantes e melhorar a experiência em conexões limitadas. Em modo offline, a última versão carregada continua acessível, mas alguns dados em tempo real e o mapa de fundo podem não estar disponíveis.

## Configuração e customização

Principais pontos de personalização:

- `manifest.webmanifest`: nome, tema, ícones e configuração do app
- `index.html`: identidade visual, temas e lógica da interface
- `icons/`: conjunto de imagens do aplicativo
- `leaflet.js` e `vendor/leaflet.js`: dependência do mapa

Se a chave do mapa (por exemplo, MapTiler) for restrita por domínio, o host público precisa ser adicionado à lista permitida.

## Boas práticas de manutenção

Para evoluir este projeto com mais funcionalidades no futuro, recomenda-se:

- separar HTML, CSS e JS em módulos ou arquivos dedicados
- manter a lógica de UI e a lógica de dados em arquivos independentes
- mover dados externos para camadas de serviço
- manter a lógica de negócio em módulos isolados
- alinhar o projeto com padrões de desenvolvimento limpo e documentação de código
- criar validações automáticas e pipeline de CI/CD antes de PRs

## Fluxo recomendado de contribuição

1. criar branch específica de desenvolvimento
2. manter alterações focadas em uma funcionalidade por vez
3. validar a estrutura local com `npm run validate`
4. abrir PR com descrição clara de impacto e riscos
5. revisar com foco em robustez, acessibilidade e manutenção futura

## Licença e uso

Este repositório é de uso interno e operacional para o transporte público municipal, com foco em disponibilização de informações em ambiente web. Ajustes e expansões devem ser feitos em branch específica e revisados antes do merge.
