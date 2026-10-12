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
| 102 | Rafael e Bia | Silêncio, Segurança | Festa | Bebê de 4 meses, paciência zero |

**Regras especiais:**
- **Fofoca:** toda semana, todos se movem um pouco na direção do humor da Neide.
- **Protesto:** morador com aprovação abaixo de 20 **para de pagar** o condomínio.
- **Desgaste do cargo:** todo mês, todos perdem 3 de aprovação. Ninguém aguenta síndico por muito tempo.

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

O protótipo tem **31 pendências** (algumas repetíveis) e 7 cadeias de consequência.

### 4.4 Assembleia (fim de cada mês)

1. **Prestação de contas:** quanto entrou, quanto saiu, quem não pagou.
2. **Escolha da pauta:** o jogo oferece até 3 propostas (aumentar taxa, câmeras,
   regra do silêncio, aumento do Zé, portaria remota...). O jogador vê só o **clima**
   (favorável, dividido ou contra), não o voto exato.
3. **Votação:** cada morador vota por `interesses × proposta + confiança no síndico`.
   Precisa de 5 de 8. **Empate 4 x 4 = voto de minerva do síndico.**
4. **Pedido de destituição:** se a aprovação média estiver abaixo de 40%, o Dr.
   Valdemar pede sua saída. Quem está abaixo de 40 vota "fora". 5 votos = game over.

### 4.5 Como o jogo termina

| Final | Condição |
|---|---|
| 🏆 **Reeleito** | Sobreviver 6 meses e ter 5+ moradores com aprovação ≥ 50 |
| 📦 **Fim de mandato** | Chegar ao fim sem votos suficientes. O Dr. Valdemar assume |
| 🚪 **Destituído** | Perder a votação de destituição numa assembleia |
| 💸 **Falido** | Fechar 2 meses seguidos com caixa negativo |

**Balanceamento atual** (400 partidas simuladas por estratégia):
- Não fazer nada: 0% de vitória (destituído por volta da semana 7)
- Escolhas aleatórias: ~13% de vitória
- Escolhas "espertas": ~71% de vitória

---

## 5. Interface (protótipo)

- **Topo:** mês e semana, caixa, conservação, horas livres, aprovação média e
  "se a eleição fosse hoje: X/8 votos".
- **Esquerda: o prédio em corte.** Cada apartamento mostra o morador, o humor (emoji
  e barra) e 📩 quando ele mandou pendência.
- **Centro: pendências.** Cartões com prazo. Tocar abre as escolhas.
- **Direita: grupo do WhatsApp.** Resultados das decisões e reações dos moradores.
- **Assembleia:** tela própria, com prestação de contas, escolha de pauta e votação
  morador por morador.

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
Loop semanal, 3 horas por semana, 31 pendências com 7 cadeias de consequência,
8 moradores com interesses, fofoca, protesto, desgaste, assembleia com votação e
minerva, destituição, falência, eleição final, grupo do WhatsApp.

### O que falta pro jogo completo
| Área | Ideias |
|---|---|
| **Conteúdo** | 150+ pendências, mais cadeias longas (romance entre vizinhos, mistério do antigo síndico) |
| **Prédios / campanha** | Prédio pequeno → condomínio de casas → prédio de luxo → "conjuntão" de 10 torres |
| **Funcionários** | Porteiro, zelador e faxineira com humor próprio, folgas e demissão |
| **Campanha antes da assembleia** | Gastar horas visitando moradores pra ganhar votos ("política de corredor") |
| **Moradores que mudam** | Gente se muda, gente nova chega (o estudante de 5 repúblicas, o pastor, o casal que briga) |
| **Personalidade do síndico** | Escolher antecedente no início: aposentado, advogado, ex-BBB... com bônus diferentes |
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
