# SIGAPS — Limitações do plano gratuito (hospedagem web)

> **Para:** equipe da SMS, enfermeiros, coordenadores e gestores que usam o SIGAPS online.  
> **Versão:** hospedagem gratuita inicial — pode ser atualizada para plano pago quando necessário.

---

## O que é o plano gratuito?

O SIGAPS está hospedado em serviços **gratuitos** na internet. Isso permite que Passagem Franca use o sistema **sem custo de servidor** no início. Funciona para uso real, mas com algumas restrições que a secretaria deve conhecer.

---

## Limitações que você pode perceber no dia a dia

### 1. Primeiro acesso do dia pode demorar (~30–60 segundos)

O servidor da API “descansa” quando ninguém usa por alguns minutos. A **primeira pessoa** que abrir o SIGAPS no dia pode esperar um pouco até o mapa carregar. Depois disso, fica rápido para todos.

**Se incomodar muito:** migrar para plano pago no Render (~US$ 7/mês) mantém o servidor sempre ligado.

---

### 2. Endereço na internet não é um domínio “oficial”

Por enquanto o acesso é por links do tipo:

- `https://sigaps.pages.dev` (site)
- ou similar fornecido pela equipe de TI

Não é um endereço `.gov.br` ainda. Isso **não afeta** o funcionamento do mapa nem a segurança dos dados, mas para documentos impressos oficiais a SMS pode preferir um domínio institucional depois.

---

### 3. Espaço para dados limitado

| Recurso | Limite aproximado (grátis) |
|---------|----------------------------|
| Banco de dados | ~500 MB |
| Uploads (logos, arquivos) | Poucos GB no total |
| Usuários simultâneos | Dezenas (suficiente para uma SMS municipal) |

Para Passagem Franca no piloto, isso é **mais que suficiente**. Municípios muito grandes ou muitos anos de histórico podem precisar de upgrade.

---

### 4. Mapas e ruas dependem de internet

- O mapa satélite e as ruas precisam de **conexão com a internet**.
- Ruas de terra só aparecem se estiverem no OpenStreetMap ou forem cadastradas manualmente no sistema.
- A importação automática de ruas usa serviços externos (OSM); se estiverem lentos, use o botão **Atualizar ruas** ou aguarde.

---

### 5. Backup e suporte

- **Backup:** o Supabase faz cópias básicas no plano grátis; para política formal de backup diário, recomenda-se plano pago.
- **Suporte:** não há SLA (acordo de nível de serviço) 24h — é infraestrutura gratuita de terceiros.

---

### 6. Funcionalidades ainda em evolução

Alguns recursos do roadmap **ainda não estão prontos**:

- Integração automática com e-SUS
- App offline no celular do ACS
- Mapa de calor de famílias (depende de dados importados)
- Algumas estradas de terra sem cadastro no mapa mundial

O uso principal — **pintar microáreas, ver cobertura, gerar PDF** — está disponível.

---

## Quando vale migrar para plano pago?

| Necessidade | Sugestão |
|-------------|----------|
| SMS usa todo dia, sem espera na abertura | Render pago (API sempre ligada) |
| Domínio `seudominio.com.br` ou `.gov.br` | Registro de domínio + Cloudflare (DNS grátis) |
| Muitos municípios no mesmo sistema | Supabase Pro + Render pago |
| Backup e auditoria formal | Supabase Pro |
| Milhares de famílias no banco | Avaliar limites do Supabase |

**Estimativa mensal (pago básico):** ~US$ 10–25/mês (API + banco), sem contar domínio `.com.br`.

---

## Segurança

- Acesso só com **login e senha** (não compartilhe credenciais).
- Conexão **HTTPS** (cadeado no navegador).
- Troque a senha padrão após o primeiro acesso em produção.
- Dados ficam em servidores gerenciados (Supabase/Render), não no computador pessoal do usuário.

---

## Resumo em uma frase

> O plano gratuito é **adequado para o piloto em Passagem Franca**; se a secretaria adotar o SIGAPS como sistema oficial de rotina, recomendamos upgrade de servidor e domínio institucional — sem precisar refazer o sistema.

---

*Documento para exibição interna na SMS. Última atualização: junho/2026.*
