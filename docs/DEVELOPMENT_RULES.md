# Refract — Regras de Desenvolvimento

## Regra 0 — A Regra Mais Importante
O Refract resolve código gerado por AI sem estrutura. Não vamos construir o Refract da mesma forma.
**Cada prompt tem uma tarefa. Cada tarefa tem um ficheiro. Cada ficheiro tem uma responsabilidade.**

---

## 1. Regras de Prompting (Windsurf/Cursor)
Sempre começar com:
> **IMPORTANT: Do not change any UI design, colors, layout, or styling unless explicitly asked.**

*   **Uma prompt = uma coisa.** Nunca pedir duas features no mesmo prompt. Nunca pedir feature + fix no mesmo prompt.
*   **Sempre pedir plano antes de código.**
    > *Before writing any code, write a plan of what you're going to do and what files will be affected.*
*   **Sempre pedir explicação depois.**
    > *After finishing, explain what you changed and why.*

---

## 2. Estrutura de Ficheiros
```text
refract/
├── src/
│   ├── main/          # Processo principal Electron
│   │   ├── engine/    # Refract Engine — análise e orquestração
│   │   ├── git/       # Git operations
│   │   ├── storage/   # SQLite
│   │   └── ipc/       # Comunicação main ↔ renderer
│   ├── renderer/      # UI React
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── stores/
│   └── shared/        # Types e utils partilhados
├── docs/              # Arquitectura, decisões, PRD
└── tests/
```
**Nenhum ficheiro cresce acima de 300 linhas.** Se crescer, divide.

---

## 3. Regras de Código
*   **TypeScript strict mode** sempre ligado.
*   **Sem `any`. Sem `// @ts-ignore`.** Se não sabes o tipo, perguntas ao AI mas não ignoras.
*   **Zod para toda a validação.** Qualquer dado externo — output do OpenCode, input do utilizador, resposta da API — valida com Zod antes de usar.
*   **Sem lógica nos componentes React.** Componentes só renderizam. Lógica vai para hooks ou para o processo principal via IPC.
*   **IPC tipado.** Todos os canais IPC definidos num ficheiro central `src/shared/ipc.ts` com tipos Zod.

---

## 4. Regras de Git
### Branches:
*   `main` — sempre estável, sempre funciona
*   `dev` — desenvolvimento activo
*   `feature/nome-da-feature` — cada feature nova

### Commits:
*   `feat: adicionar Refract Score calculation`
*   `fix: corrigir crash ao abrir repositório vazio`
*   `docs: actualizar arquitectura no PRD`

*Nunca commitar directamente para main. Sempre via PR de dev → main.*

---

## 5. Regras de UI
*   **IMPORTANT: Do not change any UI design, colors, layout, or styling a não ser que seja explicitamente pedido.**
*   **Cores definidas uma vez em tailwind.config.js** — nunca hardcoded nos componentes.
*   **Cada componente tem um único ficheiro.** Sem componentes de 500 linhas.

---

## 6. Regras de Segurança
*   O código do utilizador nunca é logado.
*   Nenhuma key API é guardada em texto simples — sempre via Electron `safeStorage`.
*   O OpenCode corre em processo filho isolado — sem acesso directo à UI.

---

## 7. Documentação Obrigatória
Cada feature nova tem de ter em `docs/`:
1.  O que faz
2.  Porquê foi construída assim
3.  O que não deve ser mudado sem pensar

*Isto é o que o Refract vai gerar para os utilizadores. Temos de praticar o que pregamos.*
