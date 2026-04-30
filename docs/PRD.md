# Refract — Product Requirements Document
**Version 1.0 · April 2026 · Confidential**

## 1. O Problema
Vibe coding democratizou o desenvolvimento de software. Ferramentas como Lovable, Bolt e Cursor permitem que qualquer pessoa construa apps funcionais em horas, sem experiência técnica profunda.
Mas há um problema que ninguém resolve:
> “O código gerado funciona. Mas ninguém o entende. E quando quebra, estás sozinho.”

### Dores validadas em campo:
*   **Comprehension Debt** — o developer não entende o código que a IA escreveu, mesmo que funcione
*   **Silent Structural Decay** — a arquitetura deteriora-se silenciosamente sprint após sprint
*   **Stewardship Gap** — ninguém consegue manter, escalar ou passar o projeto a outra pessoa
*   **Rewrite Hell** — a única solução atual é reescrever tudo do zero

## 2. A Solução
Refract é um pipeline **Vibe-to-Production**. Liga ao teu repositório GitHub/GitLab, analisa o código gerado por AI, e transforma-o em código maintainable — com refactor automático, documentação gerada e estrutura limpa.

**Input → Análise → Sugestões → Output limpo**

O Refract não reescreve o teu projeto. Refrata-o — preserva a lógica, reorganiza a estrutura.

## 3. Utilizador Alvo
*   Founders e builders que usaram Lovable, Bolt ou Cursor para construir o MVP
*   Devs júniors que cresceram com vibe coding e precisam de escalar
*   Freelancers que herdaram codebases de AI
*   Startups com 1–10 pessoas com tração mas código em caos

## 4. Features — MVP (v1)

### GitHub/GitLab Integration
*   OAuth com GitHub e GitLab
*   Seleção de repositório e branch
*   Análise automática após ligação

### Code Analysis Engine
*   Deteção de código duplicado (DRY violations)
*   Módulos com responsabilidades excessivas
*   Dependências circulares
*   Dead code
*   Score de saúde do codebase (0–100)

### Refract Suggestions (Semi-automático — Free/Pro)
*   Lista de sugestões por prioridade e impacto
*   Cada sugestão: problema, código afetado, solução proposta
*   Dev aceita ou rejeita individualmente
*   Preview antes e depois de cada mudança

### Auto-Refract (Automático — Pro/Team)
*   Refactor aplicado diretamente no repositório
*   Pull Request automático com mudanças documentadas
*   Changelog gerado automaticamente

### Documentation Generator
*   README automático
*   Documentação de funções e módulos
*   Architecture overview

## 5. Features — V2+
*   **Drift Monitor** — alertas semanais de degradação
*   **CI/CD Integration** — corre automaticamente em cada PR
*   **Team Dashboard** — visibilidade partilhada
*   **Slack/Discord alerts**
*   **IDE Extension** para Cursor/VSCode
*   **Refract Score Badge** para README público

## 6. User Flow
1. Liga repositório 
2. Análise automática 
3. Score + relatório 
4. Aceita sugestões 
5. PR gerado 
6. Codebase limpo

*Tempo esperado da ligação ao primeiro relatório: menos de 5 minutos*

## 7. Stack Técnica

| Camada | Tecnologia |
| --- | --- |
| **Frontend** | React (Electron App) / Next.js (Web) |
| **Backend** | Node.js + TypeScript |
| **Análise de código** | AST parsing (acorn/babel) |
| **AI Layer** | Claude API (Sonnet) |
| **Auth** | Supabase Auth + OAuth |
| **Base de dados** | SQLite (Local) / Supabase (Cloud) |
| **Pagamentos** | Lemon Squeezy |
| **Deploy** | Vercel + Railway / Electron Builder |

## 8. Fora de Scope — V1
*   Monorepos complexos
*   Análise de performance ou segurança
*   Linguagens além de JavaScript/TypeScript
*   Mobile app
*   Integração com Jira/Linear
*   Self-hosted version

## 9. Pricing

| Plano | Preço | Limites |
| --- | --- | --- |
| **Free** | $0/mês | 1 repositório, 50 sugestões/mês, manual only |
| **Pro** | $25/mês | Repositórios ilimitados, auto-refract, docs generator |
| **Team** | $70/mês | Até 10 membros, dashboard, CI/CD |
| **Enterprise** | $800–$2K/mês | Custom, SLA, onboarding dedicado |

## 10. Métricas de Sucesso

### Ativação
*   % que ligam repositório nos primeiros 10 minutos
*   % que aceitam pelo menos 1 sugestão na primeira sessão

### Conversão
*   Free → Pro: target 8–12%
*   Pro → Team: target 5%

### Receita — Ano 1 (50K users)

| Métrica | Conservador | Agressivo |
| --- | --- | --- |
| Users pagos | 4.000 | 7.500 |
| **MRR** | $150K | $287K |
| **ARR** | $1.8M | $3.4M |

## 11. Posicionamento
> “Vibe coding got you to 80%. Refract gets you the rest.”

Refract não compete com Cursor, Lovable ou Bolt. Completa-os. É a camada que faz o que eles geram durar.
