# Segurança do Atarefado

Relatório da auditoria de segurança feita em outubro de 2026, com foco em autenticação, senhas, recuperação de acesso, login com Google, sessões e proteção dos dados dos usuários.

## Resumo

| # | Achado | Gravidade | Situação |
|---|---|---|---|
| 1 | Sessão (JWT) guardada no `localStorage`: legível por qualquer XSS; logout não invalidava o token, que seguia válido por 7 dias | Alta | **Corrigido**: sessões no servidor + cookie `HttpOnly` |
| 2 | Login com Google vinculava automaticamente a uma conta existente só pelo e-mail | Alta | **Corrigido**: vínculo exige a senha da conta |
| 3 | Sem limite de tentativas em login, cadastro e Google | Média | **Corrigido**: limites por IP e por conta |
| 4 | Enumeração de usuários: mensagem específica para contas Google e resposta mais rápida para e-mails inexistentes | Média | **Corrigido**: mensagem única e tempo constante |
| 5 | Não existia recuperação de senha | Média | **Implementado** com token seguro |
| 6 | Senhas acima de 72 bytes truncadas em silêncio pelo bcrypt; sem bloqueio de senhas comuns | Média | **Corrigido**: política de senhas |
| 7 | Sem cabeçalhos de segurança nem configuração para produção | Baixa | **Corrigido**: `helmet`, HTTPS obrigatório em produção |
| 8 | Conta só-Google não podia criar senha local | Baixa | **Implementado** em "Minha conta" |
| 9 | Token antigo (`taskflow.token`/`atarefado.token`) permanecia no navegador | Baixa | **Corrigido**: removido ao abrir o app |
| 10 | Mensagens de erro de validação podiam ecoar valores enviados | Baixa | **Corrigido**: só campo e mensagem |

Já estava correto e foi mantido: senhas com **bcrypt** (nunca em texto puro, nunca em logs ou respostas), consultas parametrizadas pelo Prisma (sem SQL injection), React escapando o conteúdo (sem `dangerouslySetInnerHTML`), segredos fora do Git (`.env` e banco nunca foram commitados) e controle de acesso por quadro em todas as rotas.

## Como funciona agora

### Senhas
- **bcrypt com custo 12**, com salt embutido. A comparação é feita contra o hash; a senha original nunca é recuperada.
- **Migração transparente**: hashes antigos (custo 10) continuam funcionando e são refeitos com custo 12 no próximo login bem-sucedido.
- **Política**: de 8 a 64 caracteres (e no máximo 72 bytes, limite do bcrypt), qualquer caractere permitido (espaços, acentos, emoji), bloqueio das senhas mais comuns e de senha igual ao e-mail, e a nova senha precisa ser diferente da atual. Sem regras de composição obrigatórias.
- Senhas nunca aparecem em logs, respostas da API, mensagens de erro ou e-mails.

### Sessões
- Ao entrar, o servidor gera um token aleatório de 256 bits e o envia num cookie **`HttpOnly`, `SameSite=Lax`, `Path=/api`** e **`Secure` em produção**. O banco guarda só o **SHA-256** do token.
- Cada login cria uma sessão nova (sem *session fixation*), com expiração de 7 dias.
- **Logout** apaga a sessão no servidor. Há também **"Sair de todos os dispositivos"**.
- **Troca ou redefinição de senha** encerra as outras sessões (a redefinição encerra todas).
- O front-end não guarda nenhum token: o JavaScript da página não tem acesso ao cookie.

### CSRF
Como a sessão está em cookie, toda requisição que altera dados (POST, PUT, PATCH, DELETE) precisa vir da origem do próprio front-end (`Origin`, ou `Referer` como alternativa), além do `SameSite=Lax`. Requisições de outros sites recebem 403.

### Login e enumeração de usuários
- Mensagem única **"E-mail ou senha inválidos."** para e-mail inexistente, senha errada e conta sem senha (só Google).
- O bcrypt **sempre** roda, inclusive para e-mails inexistentes (com um hash de referência), então o tempo de resposta não revela se a conta existe.
- O cadastro precisa informar que o e-mail já está em uso; a mensagem é neutra (não revela o método de login) e a rota tem limite de tentativas. Veja "Riscos residuais".

### Limite de tentativas
| Rota | Limite |
|---|---|
| Login | 20 por IP a cada 15 min; **5 senhas erradas por conta** bloqueiam a conta por 15 min (vale também para e-mails inexistentes, para não revelar contas) |
| Cadastro | 10 por IP por hora |
| Google | 30 por IP a cada 15 min; vínculo: 10 por IP e 5 senhas erradas por pedido |
| Esqueci minha senha | 5 por IP a cada 15 min e **3 por e-mail por hora** |
| Redefinir senha | 10 por IP a cada 15 min |

Em desenvolvimento os limites por IP são 10 vezes maiores (testes locais saem todos do mesmo IP). Os limites por conta valem igual em todos os ambientes.

Os contadores ficam **no banco de dados** (tabela `RateLimit`), não na memória do servidor: na Vercel cada instância da função tem memória própria, e um contador em memória poderia ser contornado repartindo as tentativas entre instâncias. A contagem é feita por uma única instrução SQL atômica (parametrizada), então requisições simultâneas não perdem contagem. A chave guardada é o **hash SHA-256** de "limite + IP/e-mail", então a tabela não contém e-mails nem IPs. Contadores vencidos são apagados de tempos em tempos durante as próprias requisições, sem processo em segundo plano. O algoritmo de limite continua sendo o do `express-rate-limit`; só o armazenamento mudou.

### Login com Google
- Botão oficial do **Google Identity Services** (OpenID Connect). O app nunca vê nem processa a senha do Google.
- O servidor valida o *ID token* com a biblioteca oficial `google-auth-library`: **assinatura, emissor (`iss`), audiência (`aud` = nosso client ID) e validade (`exp`)**, e exige e-mail verificado.
- A identidade é vinculada pelo **`sub`** (identificador único do Google), nunca só por nome ou e-mail.
- Escopos mínimos: `openid`, `email` e `profile`. Nenhum *access token* ou *refresh token* do Google é guardado.
- O `GOOGLE_CLIENT_ID` fica em variável de ambiente. Nenhum *client secret* é usado.
- **Conta existente com o mesmo e-mail**: o vínculo **não é automático**. O servidor cria um pedido de vínculo (guardado só como hash, válido por 10 minutos, de uso único, encerrado após 5 senhas erradas), e o Google só é vinculado depois que o usuário confirma **a senha da conta existente**. Assim, controlar um e-mail no Google não basta para tomar uma conta aqui. Se o e-mail já estiver ligado a outra conta Google, o acesso é recusado.

### Conta só com Google
- Pode existir sem senha local, e nenhuma senha é criada automaticamente.
- **"Esqueci minha senha" não gera link** para essas contas: a pessoa recebe um e-mail explicando que entra com o Google (a resposta na tela é a mesma de qualquer outro caso).
- A senha local pode ser criada em **Minha conta**, desde que o login com Google tenha sido feito **nos últimos 10 minutos**.

### Recuperação de senha
1. "Esqueci minha senha" sempre responde: *"Se existir uma conta associada a este e-mail, enviaremos instruções para redefinição da senha."* O envio acontece depois da resposta, então o tempo de resposta também não revela nada. Na Vercel, `waitUntil` (biblioteca oficial `@vercel/functions`) mantém a função ativa até o e-mail sair.
2. Token de **256 bits** do gerador criptográfico do sistema operacional (sem IDs sequenciais nem dados pessoais), guardado **só como hash SHA-256**.
3. Validade de **30 minutos**, **uso único** (o consumo é atômico) e um novo pedido **invalida os anteriores**.
4. O link usa o **fragmento da URL** (`/redefinir-senha#token=…`), que os navegadores não enviam ao servidor: o token não vai para logs de acesso nem para o cabeçalho `Referer`. A página apaga o token da barra de endereço assim que o lê.
5. Ao redefinir, a nova senha passa pela mesma política e pelo mesmo hash, o token é invalidado e **todas as sessões são encerradas**.
6. A senha atual nunca é enviada por e-mail. Tokens não aparecem em logs.

### E-mail
- Envio por **SMTP** (Nodemailer), com credenciais só em variáveis de ambiente (`SMTP_*`).
- Em desenvolvimento, sem SMTP, os e-mails são salvos em `server/.mail-outbox/` (ignorado pelo Git) em vez de enviados. **Em produção o servidor não inicia sem SMTP configurado.**
- Erros de envio são registrados sem conteúdo do e-mail nem token.

### Controle de acesso
- Toda rota de quadros, colunas e cards confere se o usuário é membro do quadro; quem não é recebe **404** (não dá para descobrir IDs de quadros alheios).
- O endereço legível do quadro (`/quadros/<slug>`) é só um atalho: ele é traduzido para o id por `GET /api/boards/slug/:slug`, que exige sessão e associação ao quadro e responde o **mesmo 404** (mesma mensagem) para quadro inexistente e para quem não é membro. Saber ou adivinhar um endereço não dá acesso a nada nem revela se o quadro existe, porque a resposta é idêntica nos dois casos. Um quadro novo com nome repetido apenas ganha `-2`, `-3` no endereço, sem mostrar o de ninguém.
- Ações restritas ao dono (excluir quadro, convidar e remover membros) retornam **403** para membros comuns.
- O responsável por um card precisa ser membro do quadro; cards não podem ser movidos para colunas de outro quadro; operações em lote conferem que todos os cards pertencem ao quadro.
- As respostas nunca incluem `passwordHash`, `googleId` ou tokens. Membros de um quadro veem nome e e-mail uns dos outros, por design (convites são por e-mail).

### Dependências
`npm audit` sem vulnerabilidades no front-end e na API. As 4 de gravidade alta que a ferramenta de linha de comando do Prisma 7.10 trazia (`deepmerge-ts` e `mysql2`, usadas só pelo CLI, nunca nas requisições) foram eliminadas com `overrides` para as versões corrigidas, mantendo o Prisma 7 estável. Ao atualizar o Prisma, rode `npm audit` de novo e remova os `overrides` que não forem mais necessários.

### Outras proteções
- Cabeçalhos de segurança com `helmet` (CSP para as respostas da API, `nosniff`, bloqueio de *framing*, HSTS em HTTPS, sem `X-Powered-By`).
- CORS restrito à origem do front-end, com credenciais.
- Corpo das requisições limitado a 100 KB; JSON malformado retorna 400, não 500.
- Validação de entrada com Zod em todas as rotas.

## Configuração para produção

| Variável | Valor |
|---|---|
| `DATABASE_URL` | PostgreSQL (na Vercel: Neon, preenchida pela integração) |
| `DATABASE_URL_UNPOOLED` | Conexão direta, usada só pelas migrações (preenchida pela integração Neon; opcional fora dela) |
| `NODE_ENV` | `production` (ativa cookie `Secure` e limites por IP normais). **Na Vercel é o padrão** |
| `CLIENT_URL` | Endereço público do front-end, **obrigatoriamente `https://`**. **Na Vercel é deduzido** do domínio de produção (ou da URL do preview) |
| `TRUST_PROXY` | Número de proxies na frente da API (ex.: `1` no Render ou atrás de Nginx), para os limites verem o IP real. **Na Vercel o padrão é `1`**: a borda da Vercel sobrescreve `X-Forwarded-For` com o IP real, então ele não pode ser falsificado pelo cliente |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Servidor de e-mail (obrigatório) |
| `GOOGLE_CLIENT_ID` | Client ID do Google |

No Google Cloud Console, acrescente o domínio de produção (com `https://`) em **Origens JavaScript autorizadas**.

**Na Vercel** (`vercel.json`): o front-end compilado é servido pela CDN da Vercel e a API roda como uma Vercel Function (`api/index.mjs`, que carrega o mesmo app Express). Os dois ficam no **mesmo domínio**, então o cookie `SameSite=Lax` e a checagem de origem funcionam sem ajustes. Os cabeçalhos de segurança das páginas são definidos no `vercel.json` com **os mesmos valores do `helmet`** (um teste automático confere que continuam iguais): CSP liberando só os próprios arquivos e o necessário para o login do Google e as fontes do Google, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (exigido pelo pop-up do Google), HSTS, `upgrade-insecure-requests` e `Referrer-Policy: no-referrer`. As respostas da API continuam com os cabeçalhos do próprio `helmet`.

**Em servidor comum** (Render, Railway, VPS): `npm run build` e `npm start` na raiz; a própria API entrega o front-end (`SERVE_CLIENT`, ativo por padrão em produção) com os mesmos cabeçalhos.

## Riscos residuais e próximos passos

- **Cadastro revela que um e-mail já existe.** Só dá para eliminar isso com confirmação de e-mail no cadastro. A rota tem limite de tentativas e a mensagem é neutra. Próximo passo sugerido: verificação de e-mail.
- **Previews da Vercel** aceitam requisições só pela URL do branch (a checagem de origem compara com um único endereço), e o login com Google só funciona nos domínios cadastrados no Google Cloud.
- **Cada requisição limitada faz uma consulta a mais no banco** (o contador). É o preço de os limites valerem entre instâncias; só as rotas de autenticação são limitadas.
- **Lista de senhas comuns curta** (as mais usadas). Melhoria: consultar o serviço *Have I Been Pwned* por *k-anonymity*.
- **Sem autenticação em dois fatores** para contas com senha.
- Sessões têm validade absoluta de 7 dias, sem expiração por inatividade.

## Como os testes verificam isso

Com a API rodando em modo de desenvolvimento (`npm run dev` em `server/`):

```bash
npm test                 # tudo
npm run test:api         # 45 verificações: rotas, quadros, cards, datas, controle de acesso
npm run test:slugs       # 22 verificações: endereços legíveis dos quadros (acentos, nomes repetidos,
                         #   renomear, criação simultânea, 404 igual para inexistente e para não-membro)
npm run test:security    # 68 verificações: cookies, CSRF, logout, enumeração, bloqueio, política de senhas,
                         #   recuperação de senha, troca de senha, IDOR
npm run test:google      # 40 verificações: vínculo Google, conta só-Google, migração de hash,
                         #   senha nunca em texto puro, expiração de sessão e de token de recuperação,
                         #   tokens guardados só como hash, token do Google forjado
npm run test:serverless  # 10 verificações: bloqueio e limites valendo entre duas instâncias da API
                         #   (sobe as duas sozinho), contadores sem e-mail/IP, cabeçalhos do vercel.json
                         #   iguais aos do helmet
```

O `npm test` começa zerando os contadores de limite do banco de desenvolvimento (eles sobrevivem a reinícios do servidor). O banco local do Prisma (`npm run db:local`) aceita uma conexão por vez; por isso o teste de duas instâncias reveza a conexão e espera o banco ficar livre.

O build da Vercel foi validado localmente com a CLI oficial (`vercel build`): as 163 verificações que existiam na época passaram também contra a **função já empacotada** (não só contra o código-fonte), e um teste em modo produção com as variáveis da Vercel confirmou o endereço deduzido, o cookie `Secure`, a recusa de outras origens, o limite por IP real e a resposta 202 do "Esqueci minha senha" mesmo com falha no SMTP.

## Dados sensíveis e configurações

- Nenhuma senha, chave de API, *client secret*, token, credencial de banco ou SMTP no código ou no histórico do Git; `.env`, `.env*.local`, `.vercel/`, banco e `.mail-outbox/` estão no `.gitignore`.
- Não existe "secret da aplicação" porque nada é assinado: a sessão é um token aleatório de 256 bits guardado no banco só como hash, e não um JWT ou cookie assinado. Criar uma variável de segredo sem uso não aumentaria a segurança.
- A única senha escrita no código é a da **conta demo pública** (`server/prisma/seed.ts`), documentada no README de propósito. Ela só existe no banco de desenvolvimento.
- O `GOOGLE_CLIENT_ID` não é secreto (aparece na página), mas fica em variável de ambiente.
- Logs registram só erros inesperados (pilha), nunca corpo de requisição, senha, token ou dados pessoais.
- O app não tem área administrativa; o papel "dono do quadro" é verificado no servidor em cada rota, e esconder botões no front-end é só conveniência.

Os testes criam usuários e quadros de teste no banco de desenvolvimento (o de Google apaga os seus ao terminar).
