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

O jogo sorteia fotos diferentes da pasta em cada partida. O modo Clássico (4×4) precisa de pelo menos 8 imagens; o Desafio (4×6, com 24 cartas) precisa de 12. Cada foto aparece em duas cartas. Os nomes dos arquivos não são mostrados no jogo.

Nos dois modos, as cartas usam formato retrato para combinar com as fotos. O tabuleiro máximo é 4×6 (24 cartas), mantendo as cartas legíveis e confortáveis para toque em celulares. O jogo tenta usar a tela cheia nativa quando disponível e mantém um layout expandido como alternativa.
