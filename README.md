# Reelix

Jogo da memória em tela cheia no navegador, usando fotos pessoais, partidas aleatórias, dois tamanhos de tabuleiro, cronômetro, recordes locais e efeitos sonoros opcionais.

## Executar

Sirva esta pasta com qualquer servidor HTTP estático e abra a página no navegador. Por exemplo, com Node.js instalado:

```sh
npx serve .
```

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica automaticamente o site quando há um push para `main`. No repositório GitHub, abra **Settings → Pages** e selecione **GitHub Actions** como origem. Depois que o workflow terminar, o endereço estará em **Settings → Pages** e na execução da ação.

Como o repositório é público, o código do jogo ficará visível. As fotos selecionadas pelo jogador não são incluídas no repositório nem enviadas pelo jogo.

## Jogar com suas fotos

Na tela inicial, clique em **Selecionar pasta de fotos**. Selecione a pasta que contém suas imagens; o navegador pedirá acesso para carregá-las. São aceitos formatos de foto comuns, como JPG, PNG, AVIF, BMP e WebP. As fotos não são enviadas a um servidor: ficam disponíveis somente na aba aberta e precisam ser selecionadas novamente depois de atualizar ou fechar a página. Escolha um tabuleiro e clique em **Começar a jogar** para abrir a partida em tela cheia.

O jogo sorteia fotos diferentes da pasta em cada partida. O modo Clássico (4×4) precisa de pelo menos 8 imagens; o Desafio (4×6, com 24 cartas) precisa de 12. Cada foto aparece em duas cartas. Os nomes dos arquivos não são mostrados nos cards. Ao encontrar um par, a última foto aberta cresce até ocupar até 90% da tela, fica em destaque por meio segundo e desaparece.

Nos dois modos, as cartas usam formato retrato para combinar com as fotos. O tabuleiro máximo é 4×6 (24 cartas), mantendo as cartas legíveis e confortáveis para toque em celulares. O jogo tenta usar a tela cheia nativa quando disponível e mantém um layout expandido como alternativa.

## Placar online (Supabase)

Para compartilhar pontuações entre jogadores:

1. No painel do Supabase, execute o conteúdo de `supabase-setup.sql` no SQL Editor.
2. A Project URL e a chave pública `publishable` já estão configuradas em `supabase-config.js`. Essa chave foi feita para ser pública e ficará visível no site; nunca coloque uma `secret` ou `service_role` nesse arquivo.
3. Publique o site novamente. O placar público é separado por tabuleiro; os jogadores escolhem um nome ou apelido de 2 a 20 caracteres.

A pontuação começa em 10.000 e perde 250 pontos por jogada além do mínimo (um movimento por par) e 10 pontos por segundo, até o limite mínimo de zero. O banco valida modo, número de pares, movimentos, tempo e cálculo da pontuação com Row Level Security. Como o jogo é anônimo e não exige conta, nomes não são autenticados e resultados podem ser falsificados por quem chamar a API diretamente; não use este placar para competições com prêmios sem adicionar autenticação e validação no servidor. Nenhuma foto pessoal é enviada ao Supabase.
