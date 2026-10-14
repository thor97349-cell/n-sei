# FoodCreator Editor — MVP v0.1

Aplicativo desktop para Windows que automatiza boa parte da edição de vídeos de um canal
de culinária no YouTube (avaliações, receitas, desafios e degustações), com interface em
português e pensado para quem não tem experiência com edição profissional.

O que ele faz em cada vídeo:

1. Valida o arquivo e lê duração, resolução, FPS e áudio.
2. Encontra os silêncios e corta só o miolo das pausas longas, mantendo uma margem antes e
   depois da fala (não corta palavras) e preservando pausas curtas.
3. Encurta, sem remover, as pausas muito longas (degustação, demonstração, reação silenciosa).
4. (Opcional) Transcreve a fala em português no próprio computador (faster-whisper) e
   aplica legendas legíveis com contorno; também salva um `.srt` para enviar ao YouTube.
5. Adiciona zooms discretos nos cortes, para disfarçar as emendas.
6. (Opcional) Mistura uma música de fundo sua, em volume baixo, que abaixa sozinha quando
   há fala.
7. Exporta em MP4 (H.264 + AAC) no formato horizontal 16:9 ou Shorts 9:16.
8. Confere o arquivo final (abre, tem vídeo e áudio, duração correta) antes de entregar.

Os arquivos originais nunca são alterados, e nenhuma exportação é sobrescrita sem confirmação.

---

## Instalação no Windows

### 1. Python

Instale o **Python 3.11** (recomendado; 3.10 a 3.13 são compatíveis) em
<https://www.python.org/downloads/>. Na primeira tela do instalador, marque
**“Add python.exe to PATH”**.

### 2. FFmpeg

Abra o **PowerShell** e rode:

```powershell
winget install Gyan.FFmpeg
```

Feche e abra o PowerShell de novo. Para conferir, rode `ffmpeg -version`.

Sem o winget, baixe o FFmpeg em <https://www.gyan.dev/ffmpeg/builds/> (versão “release
essentials”) e copie `ffmpeg.exe` e `ffprobe.exe` para uma pasta `bin` dentro da pasta do
FoodCreator Editor. Você também pode apontar a pasta pelo menu **Ferramentas → Localizar
FFmpeg…**.

### 3. FoodCreator Editor

Dê dois cliques em **`instalar.bat`**. Ele cria um ambiente Python isolado (`.venv`),
instala a interface e pergunta se você quer as **legendas automáticas** (cerca de 300 MB
de bibliotecas). O modelo de voz é baixado depois, dentro do aplicativo, e só com a sua
confirmação (veja os tamanhos abaixo).

<details>
<summary>Instalação manual (linha de comando)</summary>

```powershell
cd caminho\para\foodcreator-editor
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pip install -r requirements-transcricao.txt   # opcional
```
</details>

## Como iniciar

Dê dois cliques em **`iniciar.bat`**. Pelo terminal:

```powershell
.venv\Scripts\python -m foodcreator
```

## Como usar

1. **Importar vídeos…** (ou arraste os arquivos para a janela). A lista mostra a duração,
   a resolução e o status de cada vídeo.
2. Escolha o **formato** (YouTube 16:9 ou Shorts 9:16) e o **estilo de edição**.
3. Ative ou desative os cortes de silêncio (e a intensidade), as legendas, os zooms e a música.
4. Escolha a **pasta de saída** e clique em **Gerar edição**.
5. Acompanhe a barra de progresso. Você pode **Cancelar** a qualquer momento; o arquivo
   incompleto é apagado.
6. Clique em **Abrir pasta dos vídeos** para ver o resultado.

Os vídeos ficam com o nome `<original>_editado_youtube.mp4` ou `<original>_editado_shorts.mp4`.
Se o arquivo já existir, o aplicativo pergunta se deve salvar com um novo nome, substituir
ou pular.

### Estilos de edição (perfis)

Cada perfil muda parâmetros reais do pipeline. Os valores aparecem em **Mostrar ajustes
avançados** e podem ser ajustados à mão.

| Parâmetro | Avaliação de comida (`FOOD_REVIEW`) | Receita (`COOKING`) | Desafio (`CHALLENGE`) |
|---|---|---|---|
| Silêncio abaixo de | −35 dB | −40 dB (o som do preparo fica) | −33 dB |
| Só corta pausas maiores que | 0,8 s | 1,2 s | 0,6 s |
| Margem mantida perto da fala | 0,25 s | 0,35 s | 0,20 s |
| Pausa longa encurtada para | 1,6 s (a partir de 3 s) | 2,0 s (a partir de 2,5 s) | 1,0 s (a partir de 4 s) |
| Legendas | dinâmicas, 4 palavras | frases inteiras, 7 palavras | dinâmicas, 3 palavras |
| Zoom | 1,08×, a cada 7 s ou mais | 1,05×, a cada 15 s ou mais | 1,10×, a cada 5 s ou mais |
| Volume da música | −24 dB | −26 dB | −20 dB |

A **intensidade** dos cortes (Leve / Médio / Forte) multiplica esses valores. Mesmo no modo
Forte, a margem perto da fala nunca fica abaixo de 0,12 s.

Para criar ou ajustar perfis, crie um `perfis.json` na pasta de dados do aplicativo, com a
mesma estrutura de `foodcreator/profiles/default_profiles.json`.

### Formatos de saída

- **YouTube horizontal (16:9)**: 1920×1080 quando o original tem essa resolução; senão,
  1280×720 ou 854×480, para não “inflar” um vídeo de baixa resolução. Vídeos verticais
  são encaixados inteiros, com fundo desfocado. A imagem nunca é deformada.
- **YouTube Shorts (9:16)**: 1080×1920 (ou 720×1280 / 480×854). Para vídeos horizontais
  há dois modos:
  - **Recortar**: recorte central, com a posição ajustável (esquerda ↔ direita). Como não
    há detecção de rosto ou de comida, o aplicativo avisa para você conferir o enquadramento.
  - **Encaixar sem cortar**: mostra a imagem inteira com fundo desfocado. Não corta nada.

### Legendas e modelos de transcrição

A transcrição roda no seu computador (CPU) e nada é enviado para a internet. O modelo é
baixado uma única vez, só depois de você confirmar:

| Modelo | Download aproximado | Observação |
|---|---|---|
| tiny | ~75 MB | muito rápido, menos preciso |
| base | ~145 MB | rápido, precisão razoável |
| **small** | ~480 MB | **recomendado** para português |
| medium | ~1,5 GB | mais preciso, bem mais lento |
| large-v3 | ~3 GB | o mais preciso, muito lento sem placa de vídeo |

O texto das legendas é exatamente o que o modelo reconheceu: o aplicativo não reescreve
nem inventa falas. Se houver erros (nomes, gírias), corrija o `.srt` e envie esse arquivo
ao YouTube.

### Música

Use apenas **músicas próprias, livres de direitos ou licenciadas**. O aplicativo não inclui
nem baixa músicas e exige que você marque a confirmação de licença. A música é repetida
se for mais curta que o vídeo, termina com fade-out e, com o ducking ligado, abaixa
sozinha quando há fala.

## Regras de edição respeitadas

- A voz nunca é acelerada (não há mudança de velocidade).
- Os cortes deixam margem em volta da fala; pausas curtas ficam; pausas longas são
  encurtadas, não eliminadas.
- Não são adicionados efeitos sonoros.
- O áudio original é preservado por padrão (a normalização de volume é opcional).
- O original não é alterado; exportações não são sobrescritas sem confirmação.
- Nomes de arquivo seguros para o Windows (acentos e espaços são mantidos), e as pastas
  são criadas quando necessário.
- Os metadados do celular (como localização GPS) são removidos do vídeo exportado.

## Onde ficam configurações, logs e cache

Na pasta `%LOCALAPPDATA%\FoodCreatorEditor`:

- `config.json`: últimas configurações usadas (`config.example.json` mostra todos os campos).
- `ultima_sessao.json`: lista de vídeos e status, restaurada ao abrir o aplicativo.
- `logs\foodcreator.log`: log rotativo (até cerca de 4 MB). Não guarda o texto transcrito.
- `cache\`: análises de silêncio e transcrições já feitas (só tempos e palavras). Se uma
  exportação falhar ou for cancelada, a próxima tentativa reaproveita essas análises.
- `modelos\`: modelos de transcrição baixados.

Também dá para salvar e abrir projetos (`.fcproj.json`) pelo menu **Arquivo**.

## Estrutura do código

```
foodcreator/
  app/        interface (PySide6): janela principal, tarefas em segundo plano, tema
  core/       pipeline, configurações, projeto/sessão, cache, erros, caminhos, logs
  media/      FFmpeg, análise (probe), silêncios/cortes, enquadramento, zoom, áudio,
              montagem da renderização e validação do arquivo final
  subtitles/  transcrição (faster-whisper) e geração das legendas ASS/SRT
  profiles/   perfis de edição (JSON) e sua aplicação
tests/        testes automatizados (pytest)
output/       exportações locais (fora do controle de versão)
```

A renderização é feita em uma única passagem do FFmpeg (cortes, enquadramento, zoom,
legendas e mixagem de áudio). O vídeo vai primeiro para um arquivo `.parcial.mp4`, que só
é renomeado para o nome final depois de validado.

## Testes

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest
```

Os testes geram vídeos curtos com o próprio FFmpeg (com nomes acentuados e com espaços) e
cobrem importação, análise de mídia, cortes, enquadramento, zoom, legendas, perfis,
exportação real nos dois formatos (incluindo vídeo sem áudio e com música), proteção
contra sobrescrita, cancelamento, retomada pelo cache e a interface em modo sem tela.

A transcrição é testada com um **modelo simulado**: os testes não baixam o modelo real.

## Limitações conhecidas (v0.1)

- **Sem detecção de rosto ou de comida.** O recorte vertical é fixo (central ou na posição
  escolhida). Confira o resultado ou use “Encaixar sem cortar”.
- **Os cortes se baseiam só no volume.** Exaustor, ventilador ou música ambiente podem
  impedir cortes; nesse caso, ajuste “Considerar silêncio abaixo de”. Não existe detecção
  de “momentos engraçados”: risadas e reações ficam porque têm som, e momentos silenciosos
  de degustação são encurtados por regra, não reconhecidos.
- **A transcrição pode errar** nomes, marcas e gírias, e não há editor de legendas no
  aplicativo (edite o `.srt`). Ela roda só na CPU (sem aceleração por placa de vídeo) e
  pode demorar em vídeos longos.
- Durante o download do modelo, o cancelamento só acontece quando o download termina.
- O zoom é um “punch-in” seco (sem animação). A música não acompanha o ritmo do vídeo.
- Não há pré-visualização dentro do aplicativo: confira o vídeo exportado no seu player.
- Se uma exportação for interrompida, o vídeo em andamento recomeça do zero (as análises
  ficam em cache e os vídeos já concluídos são mantidos).
- As legendas usam a fonte Arial (padrão do Windows).
- O MVP foi desenvolvido e testado em Linux, com FFmpeg 6.1 e 7.0. O código trata as
  particularidades do Windows (caminhos, janelas de console, limite da linha de comando),
  mas ainda precisa ser validado em um Windows real.
