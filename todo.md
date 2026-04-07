# Project TODO

- [x] Implementar backend Node.js/Express com persistência em SQLite para links, slugs, URLs de destino, tipo de redirect e contagem ilimitada de cliques
- [x] Criar rota pública `/:slug` com redirecionamento limpo e status configurável 301/302
- [x] Construir dashboard elegante com Tailwind CSS listando slug, URL de destino, status HTTP e total de cliques
- [x] Adicionar formulário para criar links com URL de destino e slug personalizado
- [x] Implementar edição da URL de destino sem alterar o slug do link curto
- [x] Implementar exclusão de links antigos
- [x] Garantir persistência dos dados e contadores após reinicialização do servidor
- [x] Adicionar configuração de deploy para Railway com `railway.json` e variáveis de ambiente adequadas
- [x] Escrever testes para validar criação, edição, exclusão, listagem e redirecionamento
- [x] Corrigir o preview para substituir a Example Page pelo dashboard real do encurtador de links
- [x] Implementar autenticação por senha com hash seguro (bcrypt)
- [x] Criar interface de login protegendo o dashboard
- [x] Adicionar filtros, busca por slug/URL e ordenação no dashboard
- [x] Implementar exportação de relatórios em CSV com filtro por período
- [x] Testar todas as novas funcionalidades

## Cloaker Inteligente (Novo)

- [x] Implementar detecção de dispositivo (desktop vs mobile) e navegador (Instagram, Facebook, outros)
- [x] Criar interface para configurar URLs diferentes por dispositivo/navegador no dashboard
- [x] Adicionar rota de redirecionamento inteligente que analisa User-Agent
- [x] Suportar múltiplas variações: Desktop, Mobile, Instagram Mobile, Facebook Mobile
- [x] Testar cloaker com diferentes User-Agents e dispositivos
