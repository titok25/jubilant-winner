# Deploy na Railway

Este projeto foi preparado para executar com `node server.js` e persistir o banco SQLite em um volume montado na Railway.

| Variável | Valor recomendado | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta interna do processo Node.js |
| `HOST` | `0.0.0.0` | Permite escuta em todas as interfaces do container |
| `DEFAULT_REDIRECT_TYPE` | `301` | Define o redirecionamento padrão para novos links |
| `SQLITE_PATH` | `/app/data/url-shortener.db` | Caminho persistente do arquivo SQLite em produção |

## Passos recomendados

Na Railway, mantenha o arquivo `railway.json` no diretório raiz e configure um **Volume** persistente montado em `/app/data`, para que os links e os contadores de cliques sobrevivam a reinicializações e novos deploys. Em seguida, defina as variáveis acima na área de secrets/configuração do serviço.

## Comportamento de produção

O servidor foi construído para usar automaticamente `/app/data/url-shortener.db` em produção quando `SQLITE_PATH` não estiver definido manualmente. Em ambiente local, o banco é salvo em `./data/url-shortener.db`.
