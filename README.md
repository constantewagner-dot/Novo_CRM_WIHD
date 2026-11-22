# WIHD Milhas e Viagens · CRM

CRM da agência: clientes, funis de vendas, vendas com lucro e margem, acompanhamento de voos/hospedagens/transportes/cruzeiros/seguros,
mapa de viagens, milhas (contas, cartões, transferências, agendamentos, clubes), financeiro (fluxo de caixa, contas, faturas, folha, comissões),
WhatsApp e portal do cliente. Banco no **Supabase**, site estático no **GitHub Pages**.

- Site: https://constantewagner-dot.github.io/Novo_CRM_WIHD/
- Repositório: https://github.com/constantewagner-dot/Novo_CRM_WIHD
- Supabase: https://wenlnoiqzaasuogvhuoq.supabase.co

## Passo a passo (primeira vez)

### 1. Banco de dados (Supabase)
1. Abra o projeto no Supabase › **SQL Editor** › New query.
2. Cole todo o conteúdo de `supabase/00_executar_tudo.sql` e clique em **Run**. Rode **uma única vez**.

### 2. Autenticação (Supabase)
1. **Authentication › URL Configuration**: em *Site URL* coloque `https://constantewagner-dot.github.io/Novo_CRM_WIHD/` e adicione a mesma URL em *Redirect URLs*.
2. **Authentication › Users › Add user**: crie os usuários (2 ou 3), com e-mail e senha, marcando *Auto Confirm User*.
   O **primeiro usuário criado vira administrador**. Os demais entram como vendedor e você muda o perfil em *Colaboradores*.
3. Recomendado: em *Authentication › Providers › Email*, desative “Allow new users to sign up” para que ninguém de fora crie conta.

### 3. Chave do projeto
1. Supabase › **Project Settings › API** › copie a chave **anon public**.
2. Abra `config.js` e troque `COLE_AQUI_A_CHAVE_ANON_PUBLIC` pela chave. A URL já está preenchida.
   A chave anon é pública por desenho e a segurança vem das regras RLS do banco. **Nunca use a `service_role`.**

### 4. Publicar no GitHub
```bash
cd wihd-crm
git init
git branch -M main
git remote add origin https://github.com/constantewagner-dot/Novo_CRM_WIHD.git
git add .
git commit -m "CRM WIHD"
git push -u origin main
```
(ou envie os arquivos pelo botão *Add file › Upload files* no GitHub). Depois: **Settings › Pages › Build and deployment › Deploy from a branch › main / (root) › Save**.
Em 1 a 2 minutos o site abre em `https://constantewagner-dot.github.io/Novo_CRM_WIHD/`.

### 5. Importar o backup do sistema antigo (uma vez)
1. Abra `…/migrar.html` no site (ou localmente), entre como administrador, escolha o arquivo de backup `.json` e importe.
2. Depois **apague `migrar.html`** do repositório. **Não suba o arquivo de backup** (o `.gitignore` já bloqueia `backup*.json`).

### 6. WhatsApp com a API oficial (opcional)
Sem isso, o botão Enviar abre o WhatsApp e registra a mensagem. Para receber e enviar dentro do CRM:
```bash
supabase login
supabase link --project-ref wenlnoiqzaasuogvhuoq
supabase functions deploy wa-webhook --no-verify-jwt
supabase functions deploy wa-send
supabase secrets set WA_TOKEN=... WA_PHONE_ID=... WA_VERIFY_TOKEN=uma-frase-sua
```
No painel da Meta, cadastre o webhook `https://wenlnoiqzaasuogvhuoq.supabase.co/functions/v1/wa-webhook` com a mesma frase e assine o evento `messages`.

## Estrutura
| Arquivo | Função |
|---|---|
| `index.html` | App principal (login, menu, dashboard, clientes, tarefas, colaboradores, tema) |
| `config.js` | URL e chave do Supabase |
| `funil.js` | CRM em funis (kanban) |
| `vendas.js` | Vendas com custo, lucro e margem |
| `acompanhamentos.js` | Voos, hospedagens, transportes, cruzeiros, seguros, adicionais |
| `mapa.js` | Mapa de viagens |
| `milhas.js` | Milhas |
| `financeiro.js` | Financeiro |
| `whatsapp.js` | Chat WhatsApp |
| `portal.html` | Portal do cliente (link por viagem) |
| `migrar.html` | Importação única do backup antigo (apagar depois) |
| `supabase/` | SQL (`00_executar_tudo.sql`) e funções do WhatsApp |

## Segurança
- Todas as tabelas têm RLS: só usuários ativos acessam; só o administrador exclui; financeiro só para admin e financeiro.
- Troque qualquer senha que tenha sido compartilhada em conversas ou e-mails.
