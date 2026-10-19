# Síndico — Documento de Design (GDD)

> **Versão:** 0.1 (protótipo) · **Nome provisório:** *Síndico* / *Edifício Primavera*
> **Protótipo jogável:** rota `/sindico` deste repositório

---

## 1. Visão

**Pitch:** *"Você ganhou a eleição de síndico por um voto. Agora aguenta."*

Um jogo de **gerenciamento e decisões** com humor brasileiro. Você é o síndico de um
prédio cheio de vizinhos com personalidades fortes. Toda semana chegam problemas
(barulho, vazamento, briga por vaga, fofoca no grupo do WhatsApp). Você tem pouco
tempo e pouco dinheiro, e cada decisão agrada uns e irrita outros. Todo mês tem
**assembleia**, e se o prédio te odiar, te tiram do cargo.

**Referências de sensação:**
- *Reigns*: decisões rápidas com consequências.
- *Papers, Please*: rotina com pressão de tempo e dilemas morais.
- *Fallout Shelter*: o prédio em corte lateral.
- *This Is the Police*: gerenciar gente e recursos limitados.

**Público:** jogadores casuais e médios, principalmente brasileiros (ou de cultura
parecida) que reconhecem o caos de condomínio. É ótimo pra vídeo curto e stream.

**Plataforma alvo:** PC (Steam). Celular depois, já que a interface é simples.

---

## 2. Pilares (o que nunca pode faltar)

1. **"Isso já aconteceu no meu prédio."** Situações reconhecíveis e personagens que
   todo mundo conhece.
2. **Toda escolha tem um preço.** Não existe a resposta que agrada todo mundo.
3. **O prédio lembra.** Decisões geram consequências semanas depois.
4. **Humor, não sofrimento.** Até perder tem que ser engraçado.

---

## 3. Loop principal

```
SEMANA (x4)                                FIM DO MÊS
┌─────────────────────────────┐            ┌──────────────────────────────┐
│ Chegam 2–3 pendências       │            │ Fechamento: entra a taxa,    │
│ Você tem 3 horas livres     │──(4x)────▶ │ saem os custos, prédio gasta │
│ Resolve, adia ou ignora     │            │ ASSEMBLEIA: escolher pauta   │
│ O grupo do WhatsApp reage   │            │ e votar. Risco de destituição│
│ Pendência vencida EXPLODE   │            └──────────────┬───────────────┘
└─────────────────────────────┘                           │
              ▲                                           │
              └───────────────────────────────────────────┘
                      Depois de 6 meses: ELEIÇÃO FINAL
```

**O dilema central é a triagem:** 3 horas por semana não dão pra tudo. Você escolhe
o que resolver direito, o que resolver de qualquer jeito e o que deixar explodir.

---

## 4. Sistemas

### 4.1 Recursos

| Recurso | O que é | Como muda |
|---|---|---|
| **Caixa (R$)** | Dinheiro do condomínio | Entra a taxa × pagantes, saem custos fixos e consertos |
| **Horas livres** | Tempo do síndico por semana (3) | Cada ação gasta 0–2h. Não acumula |
| **Conservação (%)** | Estado do prédio | Cai 4% por mês. Consertos sobem. Abaixo de 40%, todo mundo fica irritado |
| **Aprovação (por morador)** | 0–100 de cada apartamento | Muda com cada decisão |
| **Taxa condominial** | R$ por apartamento por mês | Só muda por votação em assembleia |
| **Custos fixos** | Porteiro, faxina, água, luz | Aumento do Zé, câmeras, portaria remota... |

### 4.2 Moradores e interesses

Cada morador tem **interesses** com peso de −1 (odeia) a +1 (ama):

`🤫 Silêncio · 🎉 Festa · 💰 Economia · 🔒 Segurança · 🐶 Pets · 🏛️ Tradição · 📜 Regras · ✨ Estética`

Cada decisão "puxa" alguns interesses. Exemplo: liberar o show do Marcão =
`festa +12, silêncio −12`. A Dona Cida (ama silêncio, odeia festa) perde aprovação, e
o Marcão (ama festa) ganha.

**Fórmula:** `Δaprovação = Σ (peso do interesse × efeito) + efeito direto no morador`

O jogador **vê os interesses** de cada morador (tocando no apartamento), mas **não vê
os números** antes de decidir. Ler as pessoas é a habilidade do jogo.

**Elenco do protótipo (8 apartamentos):**

| Apto | Morador | Ama | Odeia | Detalhe |
|---|---|---|---|---|
| 401 | Seu Osvaldo | Economia, Tradição | Regras | Não paga há 8 meses. Gente boa |
| 402 | Patrícia | Pets, Economia, Segurança | Silêncio | 3 filhos + o Thor (cachorro) |
| 301 | Marcão | Festa | Regras, Silêncio | Baterista da banda "Os Inadimplentes" |
| 302 | Dona Neide | Segurança, Tradição, Regras | Festa | **Admin do grupo**: o humor dela contamina todo mundo |
| 201 | Dr. Valdemar | Regras, Economia | Festa, Pets | Perdeu a eleição pra você por 1 voto |
| 202 | Kelly | Estética, Festa | Regras | Influencer, grava tudo |
| 101 | Dona Cida | Silêncio, Tradição | Festa | 78 anos, faz bolo pra todo mundo |
| 102 | Rafael e Núbia | Silêncio, Segurança | Festa | Bebê de 4 meses, paciência zero |

**Regras especiais:**
- **Protesto:** morador com aprovação abaixo de 20 **para de pagar** o condomínio.
- **Desgaste do cargo:** todo mês, todos perdem aprovação (2, 3 ou 4, conforme a dificuldade). Ninguém aguenta síndico por muito tempo.

**Mecânica própria de cada morador** (aparece no perfil dele):

| Morador | Mecânica |
|---|---|
| Dona Neide | **Fofoca:** toda semana, todos se movem um pouco na direção do humor dela |
| Kelly | **Stories:** acima de 70%, posta elogios e todo mundo melhora. Abaixo de 30%, detona o síndico |
| Marcão | **Ensaio semanal:** sem regra do silêncio ou estúdio, a Dona Cida e o Rafael perdem paciência aos poucos |
| Dr. Valdemar | **Processo:** abaixo de 25%, processa o condomínio |
| Dona Cida | **Bolo:** acima de 75%, distribui bolo uma vez por mês e todo mundo melhora |
| Seu Osvaldo | **Inadimplente:** não paga até a dívida dele ser resolvida |

### 4.2b Ações do síndico (por conta própria)

As horas livres que sobram das pendências podem ser usadas em:

| Ação | Horas | Limite | Efeito |
|---|---|---|---|
| 🚪 Visitar um morador | 1h | 1x por morador por mês | +3 com ele (+2 com o Doutor). Não funciona com quem já está acima de 70% |
| 🔦 Vistoria | 2h | semanal | +5% de conservação |
| 🪑 Plantão no hall | 2h | semanal | +1 com todo mundo |
| 🧹 Mutirão de limpeza | 2h | mensal | Conservação e tradição |
| 🧺 Bazar | 1h | mensal | +R$ 300 no caixa |
| 🎪 Arraiá | 2h | mensal | Festa e tradição, custa R$ 400 |

**Melhorias do prédio** (compra única, 1h pra organizar): jardim, interfone, bicicletário,
playground, estúdio pro Marcão, salão reformado, lavanderia, bomba d'água reserva e
placas solares. Algumas **rendem dinheiro todo mês** (salão, lavanderia, solar), outras
**bloqueiam problemas** (a bomba reserva evita o "prédio sem água", o bicicletário evita o
roubo de bicicleta, o estúdio acaba com o ensaio do Marcão). É onde o dinheiro do caixa
vira estratégia.

### 4.2c Perfil do síndico e dificuldade

| Perfil | Vantagem | Desvantagem |
|---|---|---|
| 🙋 Novato | Nenhuma | Nenhuma |
| 🧓 Aposentado | 4 horas por semana; os mais velhos gostam dele | Kelly e Marcão começam com o pé atrás |
| ⚖️ Advogado | Dr. Valdemar +25 e nunca processa | Marcão e Kelly não gostam |
| 📸 Ex-BBB | Kelly +25; 3 conversas de corredor por assembleia | O Doutor e a Dona Cida desconfiam |
| 🧮 Contador | +R$ 3.000 e −R$ 300/mês de custos | Todo mundo começa um pouco menos simpático |

**Dificuldade:** Tranquilo (desgaste 2, menos pendências, +R$ 1.000), Normal, Caótico
(desgaste 4, muito mais pendências, −R$ 1.000). A pontuação final é multiplicada por
0,8 / 1 / 1,3.

### 4.3 Pendências (eventos)

Cada pendência tem: **remetente**, **texto**, **prazo** (semanas), **2 a 3 escolhas**
(com custo em horas e dinheiro) e uma **consequência de "ninguém fez nada"**, que
acontece se o prazo vencer.

**Memória do prédio (flags):** escolhas ligam marcadores que destravam continuações.

| Decisão | Consequência depois |
|---|---|
| Ignorar a bateria do Marcão | Ele marca um **show no salão** |
| Chamar o sobrinho do Zé pro vazamento | Semanas depois o **cano estoura** |
| Negar aumento ao Zé | Ele cochila, **encomenda da Kelly some** |
| Remover a Neide do grupo | Ela cria um **grupo paralelo sem o síndico** |
| Fingir que não viu o gato de luz | **Curto-circuito** no prédio |
| Não consertar o portão | **Bicicleta roubada** da garagem |
| Processar o Seu Osvaldo | **Sentença**: cobrar R$ 4.800 e ele perde o apê, ou fazer acordo |
| Deixar o Seu Osvaldo pôr o quarto no Airbnb | **Turistas** fazem festa e jogam espuma na caixa d'água |
| Não renovar o seguro | **Fogo na lixeira**, e o conserto sai do caixa |
| Aceitar o atraso da Patrícia desempregada | Ela para de pagar, e depois **paga tudo** quando arruma emprego |

**Histórias longas** (vários capítulos ao longo do mandato):

- **O síndico antigo:** um extrato estranho leva à descoberta de que o Gilberto desviou
  R$ 18.000. Você pode expor, processar ou guardar segredo. Depois ele liga oferecendo
  propina. Aceitar pode vazar no grupo; gravar a ligação leva à condenação e ao dinheiro
  de volta.
- **Marcão e Kelly:** ela pergunta se ele é solteiro, ele pede o terraço pra um jantar
  surpresa, eles brigam no corredor e exigem que você escolha um lado... ou você
  reconcilia os dois e vira padrinho do casamento.
- **A chapa de oposição:** o Dr. Valdemar lança candidatura. Você pode convidá-lo pra
  subsíndico (e ganhar o voto dele), desafiá-lo pra um debate ou ignorar, e aí ele faz
  campanha de porta em porta todo mês.

O protótipo tem **66 pendências**: as 31 originais e 35 novas, quase todas só a partir
do 2º mês, incluindo as histórias longas. Pendências repetíveis (barata, faxina...)
aparecem com metade da chance, pra não tomar o lugar das histórias.

### 4.4 Assembleia (fim de cada mês)

1. **Prestação de contas:** quanto entrou, quanto saiu, quem não pagou.
2. **Escolha da pauta:** o jogo oferece até 3 propostas (aumentar taxa, câmeras,
   regra do silêncio, aumento do Zé, portaria remota, baixar a taxa quando sobra
   dinheiro...). O jogador vê só o **clima** (favorável, dividido ou contra), não o voto exato.
3. **Política de corredor:** antes de votar, o síndico tem 2 conversas (3 no perfil
   Ex-BBB). Conversar com alguém **revela o voto** e puxa a pessoa pro seu lado.
4. **Votação:** cada morador vota por `interesses × proposta + confiança no síndico`.
   Precisa de 5 de 8. **Empate 4 x 4 = voto de minerva do síndico.**
5. **Pedido de destituição:** se a aprovação média estiver abaixo de 40%, o Dr.
   Valdemar pede sua saída. Quem está abaixo de 40 vota "fora". 5 votos = game over.

### 4.5 Como o jogo termina

| Final | Condição |
|---|---|
| 🏆 **Reeleito** | Sobreviver 6 meses e ter 5+ moradores com aprovação ≥ 50 |
| 📦 **Fim de mandato** | Chegar ao fim sem votos suficientes. O Dr. Valdemar assume |
| 🚪 **Destituído** | Perder a votação de destituição numa assembleia |
| 💸 **Falido** | Fechar 2 meses seguidos com caixa negativo |

**Finais especiais (12) e finais básicos (4):** quando o jogo termina, o primeiro final
especial cuja condição bate substitui o final básico. Exemplos:

| Final | Como chegar |
|---|---|
| 🦸 O Herói do Primavera | Reeleito depois de fazer o Gilberto ser condenado |
| 💍 Padrinho e Síndico | Reeleito depois de casar o Marcão com a Kelly |
| 🤝 Chapa da União | Reeleito com o Dr. Valdemar de subsíndico |
| 💅 A Nova Síndica | Perder a eleição com a Kelly gostando de você |
| 📵 Derrubado pelo Grupo Paralelo | Cair depois de remover a Neide do grupo |
| 🚔 Investigado! | Aceitar a propina do Gilberto e mentir quando vazar |
| 🌳 Falido, mas Lindo | Falir depois de fazer obras no prédio |

A tela inicial mostra quantos finais o jogador já descobriu (os que faltam aparecem com cadeado).
Todos os 16 foram alcançados em simulação.

**Epílogo:** no fim, cada morador, o Zé, o prédio e o próprio síndico ganham uma frase
dizendo o que aconteceu com eles, escolhida pelas decisões da partida (51 variações). Ex: se
você construiu o estúdio, o Marcão "gravou o primeiro disco; a faixa 3 se chama 'Síndico Gente
Fina'"; se removeu a Neide do grupo, "o grupo paralelo dela tem 47 membros".

**Resumo do mandato:** as 3 decisões que mais mexeram com o prédio, mais pendências resolvidas,
explodidas, pautas aprovadas e melhorias feitas.

**Pontuação:** aprovação média, caixa, conservação, votos, semanas sobrevividas e um
bônus grande pela reeleição, multiplicados pela dificuldade. O recorde fica salvo.

**15 conquistas**, como Unanimidade, Taxa congelada, Nada explodiu, Detetive, Cupido,
Conquistou o Doutor e Quebrou o prédio. Ficam salvas entre partidas.

**Balanceamento atual** (300 partidas simuladas por combinação):

| Estratégia | Tranquilo | Normal | Caótico |
|---|---|---|---|
| Não fazer nada | 0% | 0% | 0% |
| Escolhas aleatórias | 34% | 17% | 8% |
| Robô "perfeito" (testa cada opção antes) | ~100% | ~100% | ~98% |

O robô perfeito vê o resultado exato de cada escolha antes de decidir, coisa que um
jogador não consegue. Pra ele o desafio está na pontuação e nas conquistas, não na
reeleição. Um jogador humano deve ficar entre as duas linhas.

---

## 5. Interface (protótipo)

- **Menu inicial:** continuar partida salva, escolher perfil e dificuldade, recorde e
  conquistas.
- **Topo:** mês e semana, caixa, conservação, horas livres, aprovação média,
  "se a eleição fosse hoje: X/8 votos", botão de som e botão de menu.
- **Esquerda: o prédio em corte.** Cada apartamento mostra o morador, o humor (emoji
  e barra) e 📩 quando ele mandou pendência.
- **Animações:** quando a aprovação de alguém muda, o número sobe sobre o apartamento.
  Se cai muito, o apartamento treme; se sobe muito, brilha. Melhorias aparecem embaixo do prédio.
- **Centro: pendências** (cartões com prazo; tocar abre as escolhas) e, logo abaixo,
  **ações por conta própria** e **melhorias**.
- **Resultado de cada decisão:** mostra caixa, conservação e quanto cada morador mudou,
  **com o motivo** (ex: "Dona Cida −10, por causa de: 🤫 Silêncio").
- **Sons** sintetizados: notificação de mensagem, acerto, erro, martelinho da assembleia.
- **Salvamento automático** no navegador.
- **Direita: grupo do WhatsApp.** Resultados das decisões e reações dos moradores.
- **Assembleia:** tela própria, com prestação de contas, escolha de pauta, conversas
  de corredor e votação morador por morador.

---

## 6. Direção de arte e som (versão final)

- **Visual:** 2D, prédio em corte lateral estilo casa de bonecas. Personagens
  cartunescos e expressivos (referência: *Fallout Shelter*, *Tiny Tower*,
  *Overcooked*). Cores quentes de prédio dos anos 80 e 90: bege, pastilha, azulejo.
- **Moradores animados nos apartamentos:** o Marcão tocando bateria, a Kelly
  gravando, a Dona Cida na janela. Quando alguém fica bravo, a janela treme.
- **Som:** notificação de WhatsApp (o som mais estressante do Brasil), interfone,
  campainha, bateria abafada, latido do Thor. Trilha leve, tipo música de elevador.
- **Texto:** é metade do jogo. Tom de grupo de família: emoji demais, CAPS LOCK, áudio
  de 3 minutos.

---

## 7. Do protótipo ao jogo completo

### O que o protótipo **já tem**
Loop semanal com horas livres, 66 pendências com 10 cadeias de consequência e 3
histórias longas, 8 moradores com interesses e mecânicas próprias, ações por conta
própria, visitas, 9 melhorias, assembleia com política de corredor e minerva,
destituição, falência, eleição final, grupo do WhatsApp, 5 perfis de síndico, 3
dificuldades, pontuação, 15 conquistas, 16 finais (12 especiais), epílogo de cada
personagem, resumo do mandato, salvamento automático, sons e animações.

### O que falta pro jogo completo
| Área | Ideias |
|---|---|
| **Conteúdo** | 150+ pendências e mais histórias longas |
| **Prédios / campanha** | Prédio pequeno → condomínio de casas → prédio de luxo → "conjuntão" de 10 torres |
| **Funcionários** | Porteiro, zelador e faxineira com humor próprio, folgas e demissão |
| **Moradores que mudam** | Gente se muda, gente nova chega (o estudante de 5 repúblicas, o pastor, o casal que briga) |
| **Mandatos** | Reeleição leva a um segundo mandato mais difícil |
| **Modo infinito** | "Quanto tempo você dura?" com placar |
| **Localização** | O humor é muito brasileiro. Versão em inglês teria que adaptar, não traduzir |

---

## 8. Plano técnico (pra quando for pra Unity)

**Recomendação: Unity (2D) com C#.** Pra esse jogo, Unreal é exagero. Ele brilha em 3D
realista, e aqui o jogo é 2D e cheio de interface. Unity tem ferramentas 2D e de UI
mais simples, muito material em português, e roda bem em PC e celular.

**A estrutura do protótipo já foi pensada pra migrar:**

| Protótipo (web) | Unity |
|---|---|
| `lib/sindico/types.ts` (tipos) | Classes C# (`EventDef`, `Choice`, `Effects`...) |
| `lib/sindico/data/*.ts` (moradores, eventos, pautas) | `ScriptableObject`s ou arquivos JSON |
| `lib/sindico/engine.ts` (regras) | `GameManager.cs`, praticamente uma tradução linha a linha |
| `components/sindico/*` (interface) | Cenas e prefabs de UI (refeitos com arte de verdade) |

**Regra de ouro:** o **conteúdo** (pendências, moradores, pautas) fica em **dados**,
nunca em código. Assim dá pra escrever pendência nova sem programar, e no futuro
abrir pra **mods**.

**Ordem sugerida na Unity:**
1. Instalar Unity Hub e Unity 6 (LTS), criar projeto "2D (URP)".
2. Portar os tipos e o motor para C# (dá pra fazer com ajuda do Claude).
3. Importar os dados (exportar o conteúdo do protótipo pra JSON).
4. Montar a UI simples: lista de pendências, prédio e chat.
5. Testar o loop completo, **ainda com arte provisória**.
6. Só depois disso: arte, animação e som.

---

## 9. Roteiro

| Fase | Entrega | O que valida |
|---|---|---|
| **0. Protótipo web** ✅ | Este repositório, `/sindico` | O loop é divertido? |
| **1. Teste com amigos** | 5–10 pessoas jogando o protótipo | O que é engraçado, o que é chato, onde travam |
| **2. Porte pra Unity** | Mesmo jogo, mesma arte provisória | Base técnica pronta |
| **3. Vertical slice** | 1 prédio com arte, som e 60+ pendências | "Parece um jogo de verdade?" |
| **4. Página na Steam + demo** | Wishlists, Steam Next Fest | Tem público? |
| **5. Acesso antecipado** | 3 prédios, campanha | Vender e ouvir a comunidade |

---

## 10. Riscos

| Risco | Como lidar |
|---|---|
| Já existe algo parecido ("Condominium" na Steam) | Checar antes de investir. O diferencial é o humor brasileiro e a política do prédio |
| Ficar repetitivo | Cadeias de consequência, moradores que mudam, eventos raros |
| Escrita fraca mata o jogo | Testar textos com gente real. Juntar histórias reais de condomínio |
| Escopo crescer demais | Seguir o roteiro. Nada de arte antes do loop estar divertido |
| Dev solo sem experiência | Começar pelo porte simples, aprender Unity no caminho, pedir ajuda |

---

## 11. Perguntas em aberto

1. **Nome final:** *Síndico*? *Síndico por 1 Voto*? *Edifício Primavera*?
2. **Duração ideal da partida:** 6 meses (uns 20 minutos) tá bom?
3. **Tom:** só comédia, ou também momentos sérios (vizinho doente, despejo)?
4. **O síndico tem rosto e nome**, ou é o próprio jogador?
5. **Celular desde o começo**, ou só PC?
