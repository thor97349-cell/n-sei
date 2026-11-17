# Prévia do chat (Adultando)

Dois vídeos com as mesmas 3 conversas (conta de luz, primeiro currículo e divisão do salário), em loop sem pulo.

| Arquivo | O que é |
|---|---|
| `adultando-chat.mp4` | Versão normal: só a janela do chat, fundo branco. H.264, sem áudio, 1080×1350, 30 fps, 49 s, ~1,1 MB |
| `adultando-chat-cinematico.mp4` | Versão cinematográfica: câmera em 3D, zoom no texto, foco entrando e saindo, fundo roxo do site com luzes. 52 s, ~4,6 MB |
| `adultando-chat.html` / `adultando-chat-cinematico.html` | As mesmas animações em HTML (arquivo único, roda offline e em loop) |
| `gravar-video.mjs` | Gera os MP4 de novo a partir dos HTML |

## Trocar as conversas

Edite o array `CONVERSAS` no topo do HTML (`pergunta` e `resposta`, uma linha por item, `**negrito**`).
Em `CONFIG` dá para trocar as cores de fundo.

## Gerar os vídeos de novo

Precisa de Node, Playwright (com Chromium) e ffmpeg:

```bash
node previa-chat/gravar-video.mjs
```

## Como colocar na landing

```html
<video src="/adultando-chat.mp4" autoplay muted loop playsinline preload="auto"
       width="1080" height="1350" style="width:100%;max-width:540px;height:auto;display:block"
       aria-label="Prévia do chat do Adultando respondendo dúvidas"></video>
```

`muted` e `playsinline` são obrigatórios para o autoplay funcionar no celular (principalmente iPhone).
