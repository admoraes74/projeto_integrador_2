# Plano — Construção Salto

## Escopo e arquitetura

Diretório responsivo em português com React/Vite, Wouter, tRPC, Express, MySQL gerenciado e Drizzle. Busca pública apresenta apenas perfis concluídos. Cada conta pode manter diversos profissionais/empresas em `provider_profiles`; `userId` é opcional para permitir cadastro público sem conta, e a migração preserva os registros existentes. Perfis autenticados pertencem ao usuário e continuam administráveis no painel.

O cadastro segue duas etapas. Primeiro, dados de empresa/profissional, contato, especialidades e descrição; “Guardar cadastro e continuar” grava um perfil privado no banco e abre imediatamente a etapa de serviços, sem solicitar login. O rascunho tem `userId` nulo e credencial aleatória; somente o hash da credencial fica persistido e ela autoriza acesso a esse cadastro específico. Depois, o visitante adiciona uma ou mais fotos com título, descrição e especialidade; as fotos permanecem no navegador (IndexedDB) até a conclusão. Só após clicar em “Concluir cadastro”, o servidor envia as fotos ao armazenamento durável, exige pelo menos uma imagem, publica o perfil e retorna automaticamente à página inicial. A conta é opcional; se o visitante entrar voluntariamente no painel depois, poderá vincular o perfil publicado à conta com uma ação explícita; nunca há pedido de login no cadastro.

O estado `isComplete` separa rascunhos privados de perfis públicos; perfis existentes recebem default `true`. Listagem e leitura pública filtram rascunhos. O token do cadastro visitante é um bearer secreto restrito ao ID daquele cadastro e autoriza editar seus dados e acrescentar fotos depois de publicado, sem login. Nas páginas públicas, ações “Editar cadastro” e “Adicionar fotos” aparecem apenas ao dono da conta ou ao navegador que possui o token do cadastro; cada ação permanece vinculada ao ID daquele perfil. Autenticação e autorização por propriedade permanecem obrigatórias para operações em perfis associados a conta. Serviços usam armazenamento durável `/manus-storage/...`. Rotas: `/`, `/profissional/:id`, `/cadastro`, `/cadastro/servicos`, `/painel`.

Avaliações usam estrelas inteiras de 1 a 5, com rótulos “Muito ruim”, “Ruim”, “Regular”, “Bom” e “Excelente”. Um visitante pode registrar ou alterar uma avaliação por perfil no mesmo navegador, sem login; uma chave aleatória persistida localmente identifica esse voto, e somente seu hash SHA-256 vai ao banco. Só perfis reais e publicados recebem votos. O perfil e os cartões do diretório mostram média de estrelas (uma casa decimal) e total de avaliações; perfis sem votos dizem claramente “Sem avaliações”. `provider_ratings` tem restrição única por perfil+votante, para impedir votos repetidos no mesmo navegador.

## Organização

- `client/src/pages/Home.tsx`: diretório público, busca, filtros, médias e contagens de avaliações, e retorno após conclusão.
- `client/src/pages/Professional.tsx`: perfil público, portfólio, avaliação 1–5 estrelas e controles de edição/fotos para o dono.
- `client/src/pages/ProviderForm.tsx`: etapa 1; cadastro em branco, edição de ID autenticado ou alteração protegida pelo token do cadastro visitante.
- `client/src/pages/ProviderServices.tsx`: etapa 2; fotos, publicação e navegação à página inicial.
- `client/src/lib/localProviderDraft.ts`: armazenamento temporário das fotos de visitantes no IndexedDB.
- `client/src/pages/Dashboard.tsx`: lista, seleção e manutenção de perfis autenticados.
- `drizzle/schema.ts` e migrações: vários perfis por conta, `userId` opcional, token visitante, estado de publicação e tabela de avaliações com unicidade perfil+votante.
- `server/db.ts`, `server/routers.ts`: persistência e agregação de avaliações, proteção contra voto repetido no mesmo navegador, filtro de rascunhos, validação de token, uploads, edição e publicação.
- `client/src/App.tsx`, `client/src/index.css`, `client/public/manus-routes.json`: rotas, estilo e manifesto.

## Direção visual

Três estilos distintos considerados: catálogo editorial contemporâneo de bairro (0,06); interface utilitária de marketplace (0,03); painel industrial brutalista (0,08). Escolhido: catálogo editorial contemporâneo de bairro, alinhado à gravação.

**Movimento:** diretório local contemporâneo com referência editorial. **Princípios:** confiança, hierarquia simples, ação prática e legibilidade móvel. **Cores:** off-white/cinza quente, grafite e laranja vivo para marca e ações. **Layout:** busca e filtros destacados; cartões arejados e cadastro em etapas. **Assinaturas:** ícone de telhado/coluna; pílulas laranja para especialidades; bordas finas e raios discretos. **Interações:** busca instantânea, fluxo de duas etapas, rascunhos privados, publicação explícita e retorno à home; login opcional. **Animação:** transições curtas de 150–220 ms, sem movimento decorativo contínuo; respeitar `prefers-reduced-motion`. **Tipografia:** DM Sans na interface e Manrope nos títulos, pesos 400–800. **Essência:** profissionais locais confiáveis, próximos, práticos e claros. **Voz:** direta e local; “Encontre quem resolve.” e “Seu próximo trabalho começa aqui.” **Marca:** telhado com coluna e wordmark “Construção Salto”. **Cor assinatura:** `#F45A2A`.

## Restrições

Usar OAuth Manus apenas para contas/painel, nunca como bloqueio do cadastro público. A inscrição visitante mantém seus arquivos locais até concluir; no envio final, um token aleatório permite continuar o fluxo sem liberar acesso público a rascunhos. Validar tipo e tamanho das imagens. Migrações são aditivas e preservam cadastros e galerias; o banco é compartilhado entre Preview e publicação. Contatos são apenas os fornecidos pelo prestador. Remoção pede confirmação e exclui cadastro/metadados, sem prometer remoção física do arquivo de armazenamento. A publicação no ar continua desativada até pedido explícito.
