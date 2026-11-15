# Prévia do Mentor IA (Adultando)

| Arquivo | O que é |
|---|---|
| `adultando-previa-chat.mp4` | Vídeo final: H.264, sem áudio, 1080×1350 (4:5), 30 fps, 65 s, ~2 MB, loop sem pulo |
| `adultando-previa-chat.html` | A mesma animação em HTML/CSS/JS (arquivo único, fontes embutidas, roda offline e em loop) |
| `gravar-video.mjs` | Gera o MP4 de novo a partir do HTML |

## Trocar as conversas

Abra `adultando-previa-chat.html` e edite o array `CONVERSAS` no topo do arquivo
(`pergunta`, `resposta` com uma linha por item, `**negrito**`, e `tema`: `dinheiro`, `carreira` ou `vida`).
Em `CONFIG` dá para trocar a cor de fundo (`#ffffff` do hero ou `#f2f2f6` das seções cinza).

## Gerar o vídeo de novo

Precisa de Node, Playwright (com Chromium) e ffmpeg:

```bash
node previa-chat/gravar-video.mjs
```

O script avisa se alguma resposta ficar grande demais para a janela.

## Como colocar na landing

```html
<video src="/adultando-previa-chat.mp4" autoplay muted loop playsinline preload="auto"
       width="1080" height="1350" style="width:100%;max-width:540px;height:auto;display:block"
       aria-label="Prévia do Mentor IA respondendo dúvidas de dinheiro, carreira e vida prática"></video>
```

`muted` e `playsinline` são obrigatórios para o autoplay funcionar no celular (principalmente iPhone).
