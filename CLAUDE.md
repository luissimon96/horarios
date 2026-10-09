<!-- agent-graph-flow:start -->
<!-- agent-graph-flow:sha256 84d4c0a443c5f1241df3356bac7f009131fecc7250374c662e11d388d6d18106 -->
## agent-graph-flow (`agf`) — horarios

Este projeto usa **agent-graph-flow** para gestão de execução via grafo persistente (SQLite).
Dados em `workflow-graph/graph.db` (local, gitignored). **Tudo via o CLI `agf` — zero MCP.**

### ⚠️ Regra de Execução OBRIGATÓRIA

**O grafo (`agf`) é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo (`agf node add` ou `agf import-prd`).
2. **Fluxo obrigatório** — `agf start → [implementar com TDD] → agf done` (pipeline) ou `agf next → agf context <id> → [TDD] → agf check <id> → agf node status <id> done` (granular) — SEM EXCEÇÕES.
3. **Epic = estrutura primeiro** — `agf import-prd` (ou `agf node add` + `agf edge add`) cria Epic + tasks + edges ANTES de implementar.
4. **Status tracking** — `agf node status <id> in_progress` ANTES de codar, `agf node status <id> done` (ou `agf done <id>`) APÓS completar.
5. **Validação** — `agf check <id>` (DoD + AC + TDD) após cada task.
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO.

> **Sem node no grafo = sem código escrito. Tudo via `agf` — zero MCP.**

### 🌍 Regras Universais de Engenharia (valem em QUALQUER projeto)

Princípios de engenharia independentes de linguagem, stack e ferramenta. Valem mesmo
num repo sem este CLI instalado — por isso nenhum comando é citado aqui. Cada regra
declara quem a cobra: `[enforced:<gatilho>]` tem check determinístico atrás;
`[advisory]` depende de quem lê.

1. **Investigue antes de codar — não duplique.** Leia o estado real (histórico, branches,
   trabalho não-commitado, tracker) antes de qualquer implementação. Repos com vários
   agentes em paralelo geram duplicatas quando alguém recria o que já está em andamento.
   `[advisory]`
2. **Investigue e EXPANDA, nunca recrie.** Antes de criar arquivo/função/módulo, procure
   o dono do comportamento e estenda-o. Criar do zero só quando comprovadamente não existe.
   `[advisory]`
3. **Fonte única de verdade (DRY).** Cada conhecimento tem UMA representação autoritativa;
   N cópias = N−1 bugs. Ao ver o mesmo bloco em 2+ lugares, extraia e referencie.
   `[advisory]`
4. **Legibilidade é o maior multiplicador.** Escreva para minimizar o tempo de quem vai LER
   depois (humano OU agente): arquivos e funções pequenos, 1 responsabilidade por arquivo,
   early returns em vez de aninhamento, nomes autodescritivos, zero código morto.
   `[enforced:file-size-guard]`
5. **Núcleo puro, I/O nas bordas (SOLID/DIP).** A lógica de domínio depende de portas
   injetáveis, nunca de I/O concreto — adapters em arquivo à parte, núcleo testável isolado.
   `[advisory]`
6. **Teste contra a fonte REAL, nunca contra um dublê.** Valide com dados reais ou dados
   semeados numa fonte real; um teste verde contra um mock esconde exatamente o bug que só
   aparece na base/serviço de verdade. Se o ambiente não tem a fonte, suba a fonte.
   `[advisory]`
7. **Pronto só é real se critério ↔ código ↔ teste baterem no disco.** Falta código OU teste
   físico = NÃO implementado, por mais que um relatório diga "done" — status auto-reportado
   é alucinável; o sistema de arquivos vence o relatório.
   `[advisory]`
8. **Prove o valor no modo do consumidor real.** Reproduza o comportamento prometido pelo
   caminho que o usuário percorre (a tela, o comando, o endpoint) e mostre o delta medido.
   Verde de teste unitário não é promessa cumprida.
   `[advisory]`
9. **Valide operando a INTERFACE, não só a API.** Onde há tela, exercite a tela: o backend
   responde 200 enquanto o botão não existe, o payload sai errado ou a coluna sai vazia.
   Provar pela API responde "o serviço funciona", não "a entrega funciona".
   `[advisory]`
10. **Enforcement real é gatilho determinístico, não agente lembrando.** O que precisa valer
    SEMPRE desce para um hook ou gate de CI; vigilância manual apodrece. Pergunta-chave
    diante de "o sistema se cobra sozinho": QUEM DISPARA?
   `[advisory]`
11. **Capacidade dormente é vazamento de valor.** Código pronto-mas-não-conectado (exportado
    sem consumidor, sem superfície, atrás de flag desligada) entrega zero — meça, wire e cobre.
   `[advisory]`
12. **Gerar menos é a maior alavanca de custo.** Tokens de saída custam várias vezes os de
    entrada: reuse scaffold e edite só a região alterada, em vez de regerar do zero.
   `[advisory]`
13. **Filtre na origem antes de ler.** Para achar/contar/cruzar, use a ferramenta
    determinística (busca, contagem, projeção) e traga só as linhas que importam — ler
    arquivos inteiros para extrair três linhas afoga o sinal.
   `[enforced:shell-output-compression]`
14. **Comente o porquê, nunca o óbvio — e mantenha o comentário vivo.** Registre invariante,
    decisão e gotcha; comentário que mente é pior que ausência. Código vence comentário.
   `[advisory]`

> Este bloco é o piso comum. Regras específicas do projeto somam a ele — nunca o substituem.

### ⭐ Regras de Ouro (antes de qualquer código)

1. **Investigue o git + o grafo PRIMEIRO** — rode `agf preflight "<tópico>"` antes de implementar: ele lê branch/ahead-behind/dirty/stash + nodes do mesmo tema + WIP. Veredito `wip-conflict`/`duplicate-risk` = PARE, não duplique trabalho em andamento/entregue de outra stream.
2. **Investigar e EXPANDIR o que existe, nunca recriar do zero** — `agf search`/`agf query` + grep antes de escrever; estenda o módulo dono. Só crie novo se comprovadamente não existir. Evite duplicação (DRY).
3. **Dogfood** — conduza todo o trabalho com o próprio `agf` e use comandos recém-criados no fluxo; o repo É o produto.
4. **No repo, rode `npm run dev -- <cmd>`** — nunca o binário instalado (fica stale vs. o código em edição).
5. **Código/grafo vencem memória/plano** — contagens em memórias ficam stale; reconcilie com `agf stats`/`agf query`.
6. **Qualidade por padrão (Clean Code · SOLID · KISS/YAGNI)** — arquivos < 800 linhas, funções < 50, 1 responsabilidade por arquivo, imutabilidade, sem `any`, erros tipados, comentário-cabeçalho explicando o "porquê" do módulo (navegação agêntica), reuso > duplicação.
   **NUNCA criar arquivos gigantes** — modularize antes de escrever (SRP/SOLID/composição). O teto de 800 linhas é enforced via `agf lint-files` (ou `agf lint-files --staged`) + git gate. Antes de criar, decomponha em módulos coesos.
   **Superfície de autoria** — crie/scaffolde artifacts via CLI: `agf skill new <name>` (skill), `agf agent create <name>` (role TOML), `agf hooks add <channel>` (hook). Todos auto-listados via seu respectivo `list`.

> As regras de ouro vivem no agf (este bloco + `agf preflight`), não só na cabeça do agente.

### Custo de token & providers (3º pilar)

**Providers** — `agf provider use <id>` escolhe por onde a chamada LLM vai. A *mesma* via CLI serve qualquer agente (Claude, Copilot, Codex, Cursor, Gemini…) — **nunca MCP**.
Todos os 10 providers são auto-detectados de env vars (`agf doctor --providers` lista quais estão configurados):

| Provider | Env var | Gateway |
|----------|---------|---------|
| `anthropic` | `ANTHROPIC_API_KEY` | auto-wired |
| `openai` | `OPENAI_API_KEY` | auto-wired |
| `openrouter` | `OPENROUTER_API_KEY` | auto-wired |
| `gemini` | `GEMINI_API_KEY` | auto-wired |
| `bedrock` | `BEDROCK_API_KEY` | auto-wired |
| `azure` | `AZURE_OPENAI_API_KEY` | auto-wired |
| `deepseek` | `DEEPSEEK_API_KEY` | auto-wired |
| `glm` | `GLM_API_KEY` | auto-wired |
| `kimi` | `KIMI_API_KEY` | auto-wired |
| `groq` | `GROQ_API_KEY` | auto-wired |
| `copilot` | (via `agf login`) | default |
| `ollama` | (local, $0/token) | manual URL |

- **OpenRouter:** `export OPENROUTER_API_KEY=…` → `agf provider use openrouter`. Fixe um modelo com `--pin` (ex.: `agf deliver "…" --live --pin deepseek/deepseek-v4-flash`) ou deixe o tier-router escolher (cheap→`deepseek-v4-flash`, build→`llama-4-maverick`, frontier→`qwen3.6-plus`).

**Alavancas automáticas** (sem comando — agem no gateway): diff-edits (só a região alterada), repo-map ranqueado por PageRank (~1k tok), lossy-gate (auto-revert se a compressão quebra o sentido), AAAK, content-router (SmartCrusher p/ arrays JSON homogêneos + compressão AST de código), **CCR reversível** (cacheia o original + marcador ⟨ccr:hash⟩ → outcome `ccr_dropped`; resgate com `agf retrieve <hash>`), retry com feedback compacto. Cada economia entra no `llm_call_ledger`.

**Medir** (transformar a promessa em número):
- `agf metrics [--economy-report]` — tokens/$ por task e sessão + o que as alavancas pouparam.
- `agf metrics --simulate` — re-precifica a fatura real sob todos os modelos.
- `agf eval --models <ids> --live` — cenários reais → scorecard (resolve% × custo-por-sucesso).
- `agf savings` — economia cumulativa de tokens por task (ledger real, cached tokens contabilizados automaticamente).
- `agf savings --reset` — zera o contador cumulativo.

**Alavancas bio/matemáticas (opt-in)** — `agf economy list` lista cada lever com o flag `enabled` + tokens `saved` cumulativos (JSON `--select data.levers`); `agf economy on <lever>` / `agf economy off <lever>` ligam/desligam. Default OFF para uso humano; quando um agente-CLI dirige (Claude/Copilot/Codex/…), o bundle loss-safe é AUTO-ATIVADO — `ncd_dedup`, `forage_stop`, `info_bottleneck`, `zipf_estimate` e `heat_kernel` ligam sozinhos, sem exigir evidência. Verifique o estado REAL em `agf economy list` (campo `source`: `config` = você ligou · `auto-bundle` = veio do bundle); `AGF_ECONOMY_AUTO=0` desliga a auto-ativação. Medido: só `forage_stop` corta de fato (62–96% do payload em 3 repos); os outros 4 ficam no ruído. Levers fundamentados em papers/biologia: `memory_salience` (ACT-R), `ncd_dedup` (Kolmogorov/NCD), `forage_stop` (MVT de Charnov), `budget_kleiber` (lei de Kleiber 3/4), `heat_kernel` (difusão `e^{-tL}`), `mdl_select` (MDL de Rissanen). Cada economia entra no `economy_lever_ledger` e aparece em `agf metrics --select data.levers`.

**Rastreabilidade** — cada chamada LLM é gravada no `llm_call_ledger` com `node_id` (atribuição por task), `cached_input_tokens`, `cost_usd` e `session_id`. O `agf done` registra automaticamente a economia da task. Use `agf doctor --providers` para ver quais providers estão configurados no ambiente.

**Guardrail: compressão de saída shell antes de ler** — ao rodar comandos shell externos e ler o resultado:
- **Claude Code** (PostToolUse Bash hook ativo): a compressão já ocorre automaticamente — agentes **NÃO devem** prefixar com `agf compress run` (evita dupla-compressão).
- **CLIs hookless (Copilot, Codex, Cursor, Gemini)**: é **obrigatório** envolver a saída via `agf compress run -- <cmd>` ou `cmd | agf compress run --stdin` antes de ler. Sem esse passo, tokens brutos são consumidos sem compressão.

### Harness de Completude — `agf gaps` (detect → delegate → verify)

`agf gaps` é determinístico (~0 token) e acha lacunas de completude no grafo: rastreabilidade
requirement→task→test, cobertura de AC na decomposição, AC sem testabilidade, NFR faltando,
edge-cases/erros ausentes, ambiguidade, atomicidade, design/estimate drift.

**A IA condutora (você — Copilot/Claude/Codex/Cursor/Gemini/OpenCode) fecha as lacunas**; o agf só
detecta e re-verifica. Cada gap traz `applyVia`: os comandos `agf` exatos pra fechá-lo.

**Loop:**
1. `agf gaps --severity required --json` — pega os blockers acionáveis.
2. Pra cada gap, rode o `applyVia` (ex.: `agf edge add --from <task> --to <req> --type implements`), escolhendo a semântica.
3. `agf gaps` de novo até `ready: true` — desfecho determinístico, independente de qual CLI fechou.

Filtros: `--kind <k>`, `--severity required|recommended`, `--limit N`, `--json` (relatório completo p/ loops).

### Brief de execução — delegando uma task ao executor

**Heurística:** _especifique a ponta e a saída; delegue o meio._ Onde o executor pode errar caro
(contrato, limites, incerteza) você gasta tokens preventivos baratos; o que ele faz bem sozinho
(escrever o código dentro das guardas) você deixa livre. "De outro mundo" não é um prompt mais longo —
é um que fecha as saídas de erro caras com o mínimo de palavras.

Gere o esqueleto pronto a partir do node: `agf brief <id>` (`--format markdown|json|claude-prompt`).
Ele auto-preenche o que o grafo sabe (intenção, AC, blast radius, deps, prontidão) e deixa os campos
de julgamento como `<fill: …>` pra você completar.

**Template:**
- **Intenção** (1 linha): para que existe / efeito desejado.
- **Tarefa** (atômica): uma só — node do grafo: `<id>`.
- **Imite:** arquivo-espelho a seguir como padrão.
- **Ler/tocar** (exato): caminhos + símbolos a reusar.
- **Contrato:** assinatura/tipos/comportamento (trechos pequenos **inline**; arquivos grandes → aponte o path).
- **AC** (testável): 2–4 critérios verificáveis.
- **NÃO:** refatorar vizinhos / deps novas / tocar X / mudar default.
- **Blast radius:** arquivos sensíveis → mudança aditiva.
- **Orçamento:** ~N arquivos, sem deps, sem hot-path.
- **Incerteza:** se o contrato falhar ou faltar info, PARE e reporte; se ambíguo, escolha e justifique em 1 linha.
- **Teste com:** fixture/stub concreto (ex.: `new Database(':memory:')`, stub da chamada LLM com contador) — evita setup flaky ou bater em auth que não existe no sandbox.
- **DoD:** typecheck · teste do arquivo · blast · lint.
- **Self-review antes de retornar** (~30 tokens, substitui um ciclo caro): sobrou placeholder? escopo vazou? AC cobertos? default intacto?
- **Retorne (schema):** `{arquivos[], testes{passed,failed}, desvios[]}` — sem dump de código; não commitar.

**Validação de retorno** — o condutor usa `parseExecutorResult(resposta)` para parsear o JSON estruturado
do executor (com fallback regex) e `validateBriefReady(brief)` para verificar que todos os campos de
julgamento (`imitate`, `readTouch`, `contract`, `testWith`) foram preenchidos antes de delegar.
Retorno inválido → rejeitar e pedir correção; válido → fechar o loop em 1 passo.

> Retorno estruturado torna a validação trivial (parse em vez de leitura). O condutor valida e fecha o loop; o executor escreve o meio.

### Fluxo de trabalho OBRIGATÓRIO

**Pipeline (2 calls):**
```bash
agf start                 # wake-up + next + context + marca in_progress
# … implementa com TDD (Red → Green → Refactor) …
agf done <id>             # DoD + memória + marca done + sugere próxima
```

**Granular (controle fino):**
```bash
agf next                  # puxa a próxima task (pull, WIP=1)
agf context <id>          # context-pack compact + RAG
# … TDD …
agf check <id>            # Definition of Done + aderência TDD
agf node status <id> done # transição validada (status_flow)
```

**Modo delegado (sem provider — qualquer CLI-agente dirige):** se nenhum provider
está conectado ao agf, os comandos `--live` (`agf run`/`agf deliver`/`agf autopilot --live`)
NÃO quebram — retornam `mode:delegated` com o brief pronto p/ VOCÊ (Claude/Copilot/Codex/…)
executar com seu próprio LLM. Feche o loop com `agf submit`:
```bash
agf next                  # próxima task
agf brief <id>            # spec de delegação (intenção, AC, contrato, blast)
# … você implementa com seu próprio LLM e aplica os edits …
agf submit <id> --result '{"arquivos":["x.ts"],"testes":{"passed":N,"failed":0},"desvios":[]}'
                          # valida → blast → DoD → done; desvios viram findings
```

### Lifecycle (9 fases) — comandos `agf` por fase

1. **ANALYZE** — `agf import-prd` · `agf node add` · `agf gate` (Definition of Ready)
2. **DESIGN** — `agf node add`/`agf edge add` (ADRs, interfaces) · `agf constitution` · `agf gate design`
3. **PLAN** — `agf decompose` · `agf template apply` · AC testável por task
4. **IMPLEMENT** — `agf start` → TDD → `agf done` (ou granular) · `agf harness`
5. **VALIDATE** — `agf check <id>` · `agf gate` · `agf metrics`
6. **REVIEW** — `agf export` · `agf insights` · `agf gate review`
7. **HANDOFF** — `agf memory write` · `agf snapshot create` · `agf gate handoff`
8. **DEPLOY** — `agf export` · `agf forecast` · `agf gate deploy` (harness ≥ 70)
9. **LISTENING** — `agf node add` · `agf import-prd` (novo ciclo)

### Índice de skills do ciclo (escolha a abordagem certa)

Qualquer CLI lê esta tabela pra escolher a skill certa pro intent atual — a coluna **Quando usar** mapeia situação → skill. Rode com `agf skill show <name>` ou siga o comando de entrada.

| Skill | Fase | Quando usar | Comando de entrada | Skills relacionadas |
|-------|------|-------------|--------------------|---------------------|
| `graph-backlog-generation` | PLAN | Start of a cycle, a vague idea, or "what should we build next?" | `agf stats --select data.byStatus` | graph-builder-leafcutter, graph-woodpecker |
| `graph-builder-leafcutter` | BUILD | An unblocked task exists; implement the backlog end-to-end | `agf start` | graph-backlog-generation, graph-woodpecker |
| `graph-woodpecker` | HARDEN | Code exists and works but needs hardening (bugs, vulns, debt, blind spots) | `agf harness --violations --select data.violations` | graph-builder-leafcutter, graph-backlog-generation |

### Definition of Done (rode `agf check <id>` antes de `agf done`)

| # | Check | Severidade |
|---|-------|------------|
| 1 | Tem acceptance criteria | required |
| 2 | Score AC ≥ 60 (INVEST) | required |
| 3 | Sem blockers não resolvidos | required |
| 4 | Status flow válido (passou por in_progress) | required |
| 5 | Tem descrição | recomendado |
| 6 | Não oversized (sem L/XL sem subtasks) | recomendado |
| 7 | ≥1 AC testável | recomendado |
| 8 | testFiles preenchido | recomendado |

### Princípios de Fluxo (Little's Law + Lean + TOC)

- **WIP = 1** — no máximo 1 task `in_progress`. `cycle_time = WIP / throughput`.
- **Pull, não Push** — `agf next` puxa; nunca empurrar para in_progress sem terminar a anterior.
- **Gargalo primeiro (TOC)** — se VALIDATE acumula, pare de implementar e valide.
- **Eliminar desperdício (Lean/Toyota)** — sem overproduction (features não planejadas), sem waiting (tasks blocked sem ação), use `agf context` (não dumps), TDD elimina defects.
- **Métricas de fluxo** — `agf insights` / `agf forecast`: cycle time, lead time, throughput, flow efficiency (> 40%).

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas (`agf decompose`).
- **Decomposição atômica** — Cada task completável em ≤2h.
- **Honestidade** — surfar pontas soltas como finding/risk no grafo (`agf node add --type risk`); nunca marcar done com alegação falsa.
- **CLAUDE.md como spec evolutiva** — documente padrões e decisões.

### Gates de Teste Hierárquicos

| Gate | Comando | Trigger |
|------|---------|---------|
| Task | `npm run test:blast` | a cada task finalizada (`agf done`) |
| Épico | `npm run test:node` | promoção de épico |
| PR | `npm test` | antes de push/PR |

Blast obrigatório no `agf done`. Full obrigatório pré-PR.

### Spec-Driven Development (spec-kit, via `agf`)

- `agf constitution` — princípios governantes (indexados, validados em gates).
- `agf preset --apply <name>` — workflow (default/strict-tdd/agile-light/enterprise).
- `agf spec --generate <template>` / `--validate <file>` — specs por fase.
- `agf spec-sync link <specId> <nodeId>` — specs vivas ligadas ao grafo.

### Memory ≠ Estado Atual

Memory files são snapshots point-in-time, não estado live. Contagens ("X/Y done") ficam stale.

1. Grep pelo arquivo/função — se existe, o memory é stale.
2. **Código vence memory.**
3. Reconcilie com `agf stats`/`agf query` antes de planejar.

> Nunca confiar em contagens de progresso de memories. Verificar no código/grafo primeiro.

> **Referência completa de comandos (sob demanda, ~0 token — não fixada aqui):** `agf help` (índice agrupado dos 260+ comandos) · `agf <comando> --help` (flags de um comando) · `agf retrieve-command "<intenção>"` (RAG-IN: intenção em linguagem natural → comando exato) · `agf skill list` (skills do ciclo de vida).
>
> **Web local (`agf dashboard`):** SPA com 2 abas — **Grafo** (`@xyflow`, busca/filtros/drill-down) e **Economia** (custo real, economia delegate, cache local, levers). Mesma paleta do `agf` TUI/the project site. Sobe via `agf dashboard` ou `agf init` (serve automático).
<!-- agent-graph-flow:end -->

<!-- mcp-graph:start -->
## mcp-graph — horarios

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em `workflow-graph/graph.db` (local, gitignored).

### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — `start_task → [implementar com TDD] → finish_task` (pipeline v8.0) ou `next → context(compact) → context(rag) → [TDD] → analyze(implement_done) → update_status` (granular) — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — `update_status → in_progress` ANTES de codar, `→ done` APÓS completar
5. **Validação** — usar `validate` (action: `ac`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**

### Fluxo de trabalho OBRIGATÓRIO

**Pipeline v8.0 (recomendado — 2 calls):**
```
start_task → [implementar com TDD] → finish_task
```

**Granular (6 calls — disponível para controle fino):**
```
next → context(compact) → context(rag) → [implementar com TDD] → analyze(implement_done) → update_status
```

### Lifecycle (9 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **DEPLOY** — CI pipeline, release, post-release validation (`export`, `snapshot`, `analyze`)
9. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Phase Gates (Transições entre Fases)

Antes de mudar de fase, rodar o analyze mode correspondente:

| De → Para | Gate (analyze mode) | Pré-requisitos |
|-----------|---------------------|----------------|
| ANALYZE → DESIGN | — | ≥1 epic/requirement no grafo |
| DESIGN → PLAN | `design_ready` | ADRs, interfaces, coupling + harness ≥ 55 |
| PLAN → IMPLEMENT | — | `sync_stack_docs` + `plan_sprint` executados |
| IMPLEMENT → VALIDATE | `validate_ready` | ≥50% tasks done com AC testável |
| VALIDATE → REVIEW | `done_integrity` + `status_flow` | Todos checks passam |
| REVIEW → HANDOFF | `review_ready` | Export + blast radius ok |
| HANDOFF → DEPLOY | `handoff_ready` + `doc_completeness` | Snapshot + memories salvos |
| DEPLOY → LISTENING | `deploy_ready` + `release_check` | Release validado + harness ≥ 70 |

### Definition of Done (8 Checks)

Rodar `analyze(mode: "implement_done", nodeId)` antes de `update_status(done)`:

| # | Check | Severidade | O que verifica |
|---|-------|------------|----------------|
| 1 | `has_acceptance_criteria` | **required** | Task ou parent tem AC |
| 2 | `ac_quality_pass` | **required** | Score AC ≥ 60 (INVEST) |
| 3 | `no_unresolved_blockers` | **required** | Nenhum `depends_on` para node não-done |
| 4 | `status_flow_valid` | **required** | Passou por `in_progress` antes de `done` |
| 5 | `has_description` | recomendado | Descrição não-vazia |
| 6 | `not_oversized` | recomendado | Sem L/XL sem subtasks |
| 7 | `has_testable_ac` | recomendado | ≥1 AC testável |
| 8 | `has_test_files` | recomendado | testFiles preenchido |

### Definition of Ready (7 Checks — Gate ANALYZE → DESIGN)

Rodar `analyze(mode: "ready")` antes de avançar para DESIGN:

| # | Check | O que verifica |
|---|-------|----------------|
| 1 | `has_requirements` | ≥1 epic ou requirement no grafo |
| 2 | `has_acceptance_criteria` | Tasks ou AC nodes existem |
| 3 | `no_orphans` | Sem requirements ou tasks órfãos |
| 4 | `no_cycles` | Sem ciclos de dependência |
| 5 | `has_constraints` | ≥1 constraint node |
| 6 | `has_risks` | ≥1 risk node |
| 7 | `prd_quality_score` | Score PRD ≥ 60 |

### Princípios de Fluxo (Little's Law + Lean + TOC)

**WIP = 1** — Um agente deve ter no máximo 1 task `in_progress` de cada vez.
Lei de Little: `cycle_time = WIP / throughput`. Reduzir WIP reduz cycle time sem perder throughput.

**Pull, não Push** — Usar `next` para puxar a próxima task (pull system).
Nunca empurrar tasks para `in_progress` sem terminar a anterior.

**Gargalo primeiro (Theory of Constraints)** — Se VALIDATE tem tasks acumuladas,
parar de implementar e validar. Otimizar o gargalo, não produzir mais WIP.

**Eliminar desperdício (Lean/Toyota):**
- Overproduction: não implementar features não planejadas
- Waiting: não deixar tasks blocked sem ação
- Overprocessing: usar `context()` (73% menos tokens) em vez de `export()`
- Defects: TDD Red→Green→Refactor elimina retrabalho

**Métricas de fluxo (usar com `metrics` e `analyze(progress)`):**
- Cycle time = `done_timestamp - in_progress_timestamp` por task
- Lead time = `done_timestamp - created_at` por task
- Throughput = tasks done / dias
- Flow efficiency = tempo ativo / lead time total (target > 40%)

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.

## Execução de Testes — Gates Hierárquicos

Ver `.claude/rules/tests.md` para referência completa e scripts.

| Gate | Comando | Trigger | Target |
|------|---------|---------|--------|
| Task | `npm run test:blast` | `finish_task` (cada task) | <60s |
| Épico | `npm run test:node` | `epicPromotion.readyToPromote: true` | ~3 min |
| PR | `npm test` | Antes de `git push` | varia |

**Blast obrigatório no finish_task. Node obrigatório no epic gate. Full obrigatório pré-PR.**

### Spec-Driven Development (spec-kit)

6 ferramentas adicionais para desenvolvimento guiado por especificações:

| Tool | Ação | Descrição |
|------|------|-----------|
| `constitution` | create, update, list, check | Princípios governantes do projeto — indexados no RAG, validados em quality gates. `check` valida nodes contra princípios |
| `plugin` | install, remove, enable, disable, list, info | Extensões dinâmicas (SQLite). Plugins alteram behavior de tools sem modificar código |
| `preset` | list, apply, show, create | Presets de workflow que alteram gates, WIP limits, e prerequisites |
| `spec` | generate, validate, list_templates | Templates de spec por fase (ANALYZE, DESIGN, PLAN, IMPLEMENT) |
| `spec_sync` | sync, status, history, link | Specs como documentos vivos — versionamento + sync bidirecional. Links: derived_from, implements, validates |
| `agent_format` | generate, list_formats, list_agents | Gera instruções para 6+ AI agents (markdown, TOML, skill.md, JSON) |

#### Presets disponíveis
| Preset | Quando usar | O que muda |
|--------|-------------|------------|
| `default` | Projetos normais | Gates advisory, WIP=1, prerequisites advisory |
| `strict-tdd` | Projetos críticos | Gates strict, TDD obrigatório, prerequisites strict, harness >= 70 |
| `agile-light` | Prototipagem rápida | Gates off, WIP=3, sem prerequisites |
| `enterprise` | Compliance/audit | Gates strict, security_scan obrigatório, doc_completeness required |

**Fluxo recomendado:**
1. `constitution create` — definir princípios do projeto
2. `preset apply` — escolher workflow (strict-tdd, agile-light, enterprise)
3. `spec generate` — gerar spec a partir de template
4. `spec validate` — validar spec contra template
5. `spec_sync link` — conectar spec com nodes do grafo

## Harness Engineering — Agent Readiness Score

### O que é
Métrica composta (0-100) que mede quão preparado o código está para geração/manutenção por agentes AI.
Quanto maior o score, menor o risco de alucinação e retrabalho.

### 8 Dimensões

| Dimensão | Peso | O que mede |
|----------|------|------------|
| Type Coverage | 25% | % arquivos sem `any` |
| Test Coverage | 25% | Módulos com arquivo de teste correspondente |
| Architecture Fitness | 15% | Deps direction, circular deps, barrel integrity |
| Docs Coverage | 10% | CLAUDE.md, README, rules/, docs/ |
| Naming Clarity | 10% | Nomes descritivos (sem data/result/temp/val genéricos) |
| Error Handling | 5% | Typed errors, sem catch vazio, sem console.error |
| Context Density | 5% | JSDoc em exports (contexto para agentes) |
| Provenance Coverage | 5% | Proporção de nodes com receipt de origem (source_file) |

### Grades

| Grade | Score | Significado |
|-------|-------|-------------|
| A | >= 85 | Excelente — baixo risco de alucinação |
| B | >= 70 | Bom — deploy permitido |
| C | >= 55 | Razoável — precisa melhorar |
| D | < 55 | Crítico — alto risco de alucinação |

### Comandos

- `analyze(mode: "harness_scan")` — Scan completo, salva resultado em knowledge store
- `analyze(mode: "harness_trend")` — Evolução do score (últimos 10 snapshots)
- `analyze(mode: "harness_advice")` — Sugestões de melhoria por dimensão < 70
- `analyze(mode: "harness_remediate")` — Deterministic Remediation Engine: file-level violations → actionable fix suggestions sorted by priority. Zero AI, 16 rules, suppression store for false-positives
- `npm run harness:scan` — CLI local (human-readable output)

### Workflow Diário por Fase

| Fase | O que muda com Harness |
|------|------------------------|
| ANALYZE | Rodar harness_scan para baseline inicial |
| DESIGN | Gate: score >= 55 (C) para avançar para PLAN |
| PLAN | Sprint health mostra harness delta; tasks que melhoram dimensões fracas ganham prioridade via harnessBonus |
| IMPLEMENT | start_task mostra harnessWarning se score < 70; finish_task detecta regressão > 5pts e retorna ruleSuggestions |
| VALIDATE | Gate: sem regressão > 10pts |
| REVIEW | Gate: score >= 55 (C) |
| HANDOFF | Gate: score >= 55 (C) recomendado |
| DEPLOY | Gate MAIS RÍGIDO: score >= 70 (B) obrigatório para release |
| LISTENING | Score salvo como baseline pós-deploy para próximo ciclo |

### Security

Security NÃO é dimensão do harness — é quality gate paralelo (`security_scanner`).
Harness mede "agent readiness" (tipos, testes, docs). Security mede "code correctness" (vulnerabilidades, secrets).
Ambos são visíveis no lifecycle block de cada tool response.

### Issue Pattern Tracker (Steering Loop)

finish_task grava padrões recorrentes de falha DoD. Ao atingir 3 ocorrências,
auto-sugere regras em `.claude/rules/`. Padrões rastreados:
- `missing_ac` — Task sem acceptance criteria
- `status_skip` — Pulo de status (ex: backlog → done)
- `orphan_node` — Node sem parent
- `circular_dep` — Dependência circular
- `oversized_task` — Task L/XL sem subtasks
- `missing_description` — Descrição vazia
- `missing_estimate` — Sem xpSize ou estimateMinutes

### Memory ≠ Estado Atual

Memory files são **snapshots point-in-time**, não estado live. Contagens de progresso ("X/Y done", "% complete") ficam stale rapidamente.

**Antes de planejar baseado em memories:**
1. Grep pelo arquivo/função — se existe com implementação real, o memory é stale
2. **Código vence memory** — se memory diz "X não existe" mas código mostra que sim, confiar no código
3. Contagens numéricas > 48h = possivelmente stale — verificar antes de usar

> **Nunca confiar em contagens de progresso de memories. Sempre verificar no código antes de planejar.**

> **Referências detalhadas on-demand:** Use `help` tool para consultar: `tools`, `analyze_modes`, `skills`, `cli`, `knowledge`, `workflow`, `gates`, `dod`, `dor`, `prerequisites`, `workflows`, `flow`, `quality_metrics`, `tdd`, `pipeline`, `antipatterns`, `harness`, `dream`, `siebel`, `davinci`, `translate`, `journey`, `teamtask`, `snapshot`, `graph_health`.
<!-- mcp-graph:end -->
