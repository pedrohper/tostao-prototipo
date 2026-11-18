# Tostão — Prompts de Ilustrações, Páginas dos Livros, Slides e Ícones

Documento de referência para gerar todas as artes do novo fluxo **Aprender (Carrossel Livro de História + Biblioteca)** e refazer **todos os ícones do app** com identidade visual unificada.

---

## 1. Guia de Estilo Mestre (usar em TODOS os prompts)

### A) Padrão para Páginas de Livro e Slides (cenas com personagens)
> **Style Prefix (copie no início do prompt):**
> `2D editorial picture-book illustration in a warm Brazilian indie comic style, clean expressive dark charcoal ink outlines (#1E1B18), textured warm paper background (#FDFBF6), rich cel-shading with soft gouache grain, warm palette of cream (#F6EFE4), vivid coral-orange (#FF5A36), sunny yellow (#FFC233), mint green (#3DD6A0), and sky blue (#DCEBFF). Charming, expressive characters, no text, no speech bubbles, no letters, no watermark.`

- **Proporção recomendada para páginas do carrossel (capa/página de livro):** `3:4` (vertical).
- **Proporção recomendada para slides internos das aulas:** `4:3` ou `1:1`.
- **Importante sobre páginas bloqueadas:** gere todas as páginas **coloridas**. O app aplicará o efeito **preto e branco + meio apagado** (`grayscale opacity-50`) automaticamente nas aulas ainda não desbloqueadas.

### B) Ficha Visual do Elenco (para manter consistência entre cenas)
- **Tostão (Porquinho):** `cheerful young Brazilian pink pig mascot wearing a bright coral-orange baseball cap (#FF5A36) backward or forward, expressive dark eyes, friendly snout, casual orange-accent hoodie or vest, expressive hands.`
- **Caramelo (Vira-lata Caramelo):** `classic Brazilian street dog (vira-lata caramelo) with warm golden-caramel fur, darker muzzle, floppy ears, small red/orange collar with a tiny gold coin tag, sharp street-smart detective expression.`
- **Tigrinho (Vilão das apostas/impulso):** `slick cartoon tiger villain in a flashy purple/gold tracksuit or shiny suit with dark sunglasses, smug sly grin, holding glowing casino dice or smartphone bait.`
- **Urubu do Pix (Vilão dos golpes/dívidas):** `shady cartoon black vulture in a crooked dark suit and flashy tie, holding a glowing phone or sketchy briefcase, sneaky greedy grin.`

### C) Padrão para Ícones Refeitos (UI, Módulos, Categorias)
> **Icon Style Prefix:**
> `Flat-with-depth tactile vector-style sticker icon, thick clean dark-brown/charcoal outline (#1E1B18), warm pastel-and-vivid fills (#FFC233, #FF5A36, #3DD6A0, #DCEBFF, #F6EFE4), subtle inner highlight, centered on pure solid transparent/white background, minimal geometric clarity readable at 24px and 72px, no text, no numbers, no letters.`

---

## 2. Os 9 Livros e suas 45 Páginas (Módulos 1 a 9)

Cada módulo vira um **livro de história** no carrossel. Abaixo estão o **arco narrativo sugerido** (inserindo Caramelo, Tigrinho e Urubu do Pix além do Tostão) e os **prompts individuais de cada página**.

---

### Livro 1 — Saindo da neblina
**Arco com o elenco:** O salário some na neblina do dia a dia; o **Caramelo** fareja os gastos invisíveis no extrato enquanto o **Tostão** ensina a mapear sem paranoia.

- **Página 1 (`m1-l1` — Onde foi parar o salário?)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão olha confuso para a carteira vazia cercada por uma neblina leve, enquanto o Caramelo com uma lupa fareja pegadas de cafezinho, entrega de comida e QR codes de Pix saindo da carteira.
  - *Prompt:* `[Style Prefix] Tostão (cheerful pink pig with coral-orange cap) looking puzzled at an empty open wallet surrounded by soft morning fog, while Caramelo (golden-caramel Brazilian stray dog wearing a tiny coin collar) uses a magnifying glass to sniff glowing footprints of coffee cups, delivery bags, and Pix sparkles leading away. Aspect ratio 3:4.`

- **Página 2 (`m1-l2` — Seu dinheiro é uma pizza)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma pizza gigante cortada em 3 fatias desiguais (uma enorme de moradia/ônibus, uma média de delivery/rolê, e uma pequena de futuro) na mesa da cozinha; o Caramelo tenta pegar a fatia maior e o Tostão segura um mapa da divisão.
  - *Prompt:* `[Style Prefix] Inside a cozy Brazilian kitchen, Tostão (pink pig in coral-orange cap) points with a wooden spoon at a giant pizza divided into three distinct slices on a wooden table (a large essentials slice, a medium fun slice, a bright mint-green savings slice), while Caramelo (caramel dog) eyes a delivery-box slice hungrily. Aspect ratio 3:4.`

- **Página 3 (`m1-l3` — Gastos fixos vs. gastos elásticos)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* O Tostão segurando um elástico colorido que estica e encolhe, enquanto o Caramelo tenta puxar uma âncora pesada marcada com símbolos de Wi-Fi, academia e streaming presa ao salário.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) stretching a flexible mint-green elastic band with both hands, while next to him Caramelo (caramel dog) tugs playfully at a heavy iron anchor chained to floating icons of streaming TV, dumbbell, and Wi-Fi router. Aspect ratio 3:4.`

- **Página 4 (`m1-l4` — Quando quebrar a regra)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Chuva repentina e pneu de moto/bicicleta furado na rua; o Caramelo segura um guarda-chuva amarelo protegendo o Tostão enquanto ajustam peças de emergência sem desespero.
  - *Prompt:* `[Style Prefix] On a rainy evening street, Caramelo (caramel dog) holds a bright sunny-yellow umbrella over Tostão (pink pig in coral-orange cap) as Tostão calmly patches a flat motorcycle tire with a wrench, turning an unexpected hiccup into a solvable moment. Aspect ratio 3:4.`

- **Página 5 (`m1-l5` — O raio-x da semana)**
  - *Elenco:* Caramelo (protagonista) + Tostão
  - *Cena (PT):* O Caramelo com cara de detetive num quadro de cortiça com 7 dias da semana ligados por fios vermelhos, destacando a quinta-feira cansada com um saco de delivery brilhando.
  - *Prompt:* `[Style Prefix] Caramelo (caramel Brazilian dog) wearing a tiny detective visor stands proudly beside a corkboard showing seven weekly calendar cards connected by red yarn, with Thursday glowing coral-orange next to a takeout food bag, while Tostão (pink pig in orange cap) takes notes. Aspect ratio 3:4.`

---

### Livro 2 — Cartão sem armadilha
**Arco com o elenco:** O **Tigrinho** e o **Urubu do Pix** aparecem disfarçados de "benefício fácil" oferecendo limite gigante, pagamento mínimo e Pix parcelado; o **Tostão** e o **Caramelo** desmontam a armadilha.

- **Página 1 (`m2-l1` — Limite não é salário)**
  - *Elenco:* Tostão + Tigrinho
  - *Cena (PT):* O Tigrinho de óculos escuros estende um cartão de crédito brilhante gigante como se fosse um tapete vermelho; na balança ao lado, um pequeno holerite pesa menos que o cartão-armadilha gigante.
  - *Prompt:* `[Style Prefix] Slick villain Tigrinho (cartoon tiger in flashy suit and sunglasses) smugly offering an oversized glowing credit card on a velvet cushion, while Tostão (pink pig in coral-orange cap) cautiously inspects a balance scale showing a small payslip outweighed by a heavy credit-card trap. Aspect ratio 3:4.`

- **Página 2 (`m2-l2` — O moedor de carne do rotativo)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma pequena bola de neve de papel com valor mínimo rolando ladeira abaixo e virando uma bola gigante cheia de engrenagens; Tostão e Caramelo usam uma trava de madeira para segurar a ladeira.
  - *Prompt:* `[Style Prefix] Dynamic illustration of a tiny snowball labeled only with mini bill lines rolling down a steep hill and turning into a giant menacing snowball with sharp red percentage gears, while Tostão (pink pig) and Caramelo (caramel dog) brace a sturdy wooden wedge to stop it. Aspect ratio 3:4.`

- **Página 3 (`m2-l3` — O mito do "sem juros")**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Dez pequenas caixinhas de parcelas amarradas em fila com uma corda no tornozelo do Tostão enquanto ele tenta escolher tênis na vitrine; o Caramelo mostra uma placa de desconto à vista.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) looking at bright sneakers in a shop window while ten small gift boxes tied with heavy ropes gently weigh down his backpack, and Caramelo (caramel dog) holds up a crisp mint-green cash discount tag. Aspect ratio 3:4.`

- **Página 4 (`m2-l4` — A armadilha do Pix parcelado)**
  - *Elenco:* Urubu do Pix + Tostão
  - *Cena (PT):* O Urubu do Pix sai da tela de um celular gigante segurando um botão brilhante "Parcele em 4x!"; o Tostão dá um passo para trás ao ver uma sombra de correntes por trás do celular.
  - *Prompt:* `[Style Prefix] Shady villain Urubu do Pix (cartoon black vulture in a crooked dark suit) leaning out of a giant smartphone screen offering a shiny glowing button, while Tostão (pink pig in coral-orange cap) steps back after noticing sneaky hidden chain shadows behind the phone. Aspect ratio 3:4.`

- **Página 5 (`m2-l5` — Melhor dia de compra e fechamento)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* O Tostão surfando tranquilamente em cima de um calendário gigante saltando do dia de fechamento para o mês seguinte, com o Caramelo cronometrando a janela de dias.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) cheerfully leaping across a giant desk calendar from one highlighted closing date straight into a calm sunny next-month page, while Caramelo (caramel dog) holds a vintage stopwatch smiling. Aspect ratio 3:4.`

---

### Livro 3 — Batalha contra a dívida
**Arco com o elenco:** Clima de resgate e virada heroica: estancar o barco furado, escolher qual dívida enfrentar primeiro, encarar o balcão do banco e proteger o mínimo para viver com dignidade.

- **Página 1 (`m3-l1` — Parar a sangria primeiro)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um barquinho de papel/madeira com furos soltando moedinhas no mar; o Tostão tampa os furos com rolhas e o Caramelo rema firme em direção à ilha segura.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) plugging leaks in a small wooden rowboat with corks to stop coins from spilling into the sea, while Caramelo (caramel dog) rows steadily toward a warm sunlit shore carrying groceries and a house lantern. Aspect ratio 3:4.`

- **Página 2 (`m3-l2` — A ordem do massacre: qual pagar antes?)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Três alvos/monstrinhos de papelão na arena (um gigante cuspindo faíscas de juros altos, um médio de cartão, e uma caixinha de amigo); Tostão aponta a lanterna estrategicamente para o gigante primeiro.
  - *Prompt:* `[Style Prefix] In a training arena, Tostão (pink pig in coral-orange cap) shines a bright flashlight at the tallest red-spiky cardboard monster (high-interest debt) first, while Caramelo (caramel dog) arranges smaller blocks in neat priority order beside him. Aspect ratio 3:4.`

- **Página 3 (`m3-l3` — A arte de negociar com o banco)**
  - *Elenco:* Tostão + Urubu do Pix (como cobrador)
  - *Cena (PT):* Num balcão, o Urubu empurra uma pilha enorme inflada de papéis; o Tostão puxa uma prancheta limpa com o valor original bem menor e diz "não" calmo com a mão.
  - *Prompt:* `[Style Prefix] Across a negotiation desk, shady vulture Urubu pushes a towering exaggerated stack of red overdue papers, while calm confident Tostão (pink pig in coral-orange cap) slides forward a small clean sheet showing the real original amount with a firm polite gesture. Aspect ratio 3:4.`

- **Página 4 (`m3-l4` — Serasa, Desenrola e a verdade sobre birôs)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma placa de pontuação (medidor tipo velocímetro) que o Tostão olha sem medo, enquanto o Caramelo desfaz uma nuvem escura revelando um caminho limpo e passo a passo.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) calmly inspecting a friendly gauge meter without fear, while Caramelo (caramel dog) sweeps away a grey storm cloud to reveal a clean mint-green stepping-stone path forward. Aspect ratio 3:4.`

- **Página 5 (`m3-l5` — Protegendo o mínimo existencial)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um escudo dourado/menta protegendo uma cesta com comida, chave de casa e bilhete de ônibus enquanto garras de juros batem no escudo e ricocheteiam.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) and Caramelo (caramel dog) holding up a sturdy glowing mint-green shield that protects a basket with warm bread, house keys, and a bus pass from bouncing bank-fee sparks. Aspect ratio 3:4.`

---

### Livro 4 — Construindo o muro
**Arco com o elenco:** Depois de sair do sufoco, Tostão e Caramelo colocam capacete de obra para levantar tijolo por tijolo o muro da reserva de emergência.

- **Página 1 (`m4-l1` — O tamanho real do seu muro)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão de capacete amarelo medindo um muro de tijolos bem alinhados com uma trena, calculando a altura exata de 3 a 6 camadas; Caramelo carrega o primeiro tijolinho.
  - *Prompt:* `[Style Prefix] Tostão (pink pig wearing a yellow construction helmet over his coral-orange cap) measuring a neat brick wall with a yellow tape measure, while Caramelo (caramel dog) proudly brings the very first bright brick in his mouth. Aspect ratio 3:4.`

- **Página 2 (`m4-l2` — Onde guardar para não congelar)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Dois cofres lado a lado: um bloco de gelo com moedas presas e um cofrinho líquido transparente com torneirinha pronta para sair na hora; Tostão escolhe o cofrinho líquido.
  - *Prompt:* `[Style Prefix] Side by side on a wooden bench: a frozen ice block trapping coins inside versus a crystal-clear jar with a cheerful mint-green tap ready to pour coins instantly; Tostão (pink pig) and Caramelo (caramel dog) give a thumbs-up to the liquid jar. Aspect ratio 3:4.`

- **Página 3 (`m4-l3` — Emergência não é promoção)**
  - *Elenco:* Caramelo + Tigrinho + Tostão
  - *Cena (PT):* O Tigrinho agita uma placa piscante de "50% OFF HOJE!" tentando fazer o Tostão abrir o muro da reserva; o Caramelo fica de guarda na frente do portão com um semáforo vermelho.
  - *Prompt:* `[Style Prefix] Tigrinho (flashy tiger villain) waves a bright neon sale megaphone tempting Tostão (pink pig) toward a glowing headphones box, while loyal Caramelo (caramel dog) stands guard in front of the brick reserve gate holding a red stop traffic light. Aspect ratio 3:4.`

- **Página 4 (`m4-l4` — Usar sem culpa quando o teto desabar)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma goteira forte/telha quebrada cai em casa; alguns tijolos do muro viraram um guarda-chuva gigante protegendo o Tostão e o Caramelo, sorrindo aliviados porque o muro funcionou.
  - *Prompt:* `[Style Prefix] Rain leaks from a cracked ceiling at home, and bricks from the emergency wall magically shield Tostão (pink pig) and Caramelo (caramel dog) dry and relieved underneath, celebrating that their safety wall worked when needed. Aspect ratio 3:4.`

- **Página 5 (`m4-l5` — A blindagem contra o desespero)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão sentado calmo numa cadeira de entrevista ou mesa de trabalho, costas apoiadas num muro forte atrás dele, tomando café tranquilo com o Caramelo dormindo em paz aos pés.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap and smart shirt) sitting calm and upright at a sunny desk with a sturdy brick fortress right behind him giving peace of mind, while Caramelo (caramel dog) naps peacefully on a cozy rug. Aspect ratio 3:4.`

---

### Livro 5 — Investir em você
**Arco com o elenco:** Hora de crescer a renda! O **Tigrinho** aparece como guru de anúncio milagroso; **Tostão** e **Caramelo** apostam em habilidade real, oficina e freelas.

- **Página 1 (`m5-l1` — O maior ativo aos 20 anos)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma mudinha pequena de moedas versus o próprio Tostão equipado com mochila de ferramentas brilhantes crescendo em estatura e energia como um super-recurso.
  - *Prompt:* `[Style Prefix] A tiny coin sprout on one side contrasted with energetic Tostão (pink pig in coral-orange cap) wearing a glowing backpack filled with creative tools, laptop, and sketchbooks radiating sunny yellow growth aura, Caramelo cheering beside him. Aspect ratio 3:4.`

- **Página 2 (`m5-l2` — A anatomia de um curso que vale a pena)**
  - *Elenco:* Tostão + Caramelo + Urubu do Pix
  - *Cena (PT):* O Urubu vendendo uma caixa vazia embrulhada em ouro falso ("Fique rico dormindo"), enquanto o Tostão e o Caramelo abrem uma caixa simples e honesta cheia de ferramentas práticas.
  - *Prompt:* `[Style Prefix] Shady vulture Urubu peddles a glittery empty box with fake fireworks, while Tostão (pink pig) and Caramelo (caramel dog) inspect a solid practical toolbox full of real manuals, wrenches, and clear tutorials. Aspect ratio 3:4.`

- **Página 3 (`m5-l3` — A indústria do diploma vs. o mercado real)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um canudo de diploma bonito em cima de uma nuvem versus uma porta entreaberta de escritório/oficina real onde entra luz e oportunidades práticas de estágio.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) standing at a crossroads between a floating decorative paper scroll on a cloud and a warm sunlit workshop door opening into real hands-on desks and mentors, Caramelo trotting toward the sunlit door. Aspect ratio 3:4.`

- **Página 4 (`m5-l4` — Desenhando o primeiro freela)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão entregando um pacote/projeto caprichado de fim de semana numa mesinha de café e recebendo uma nota sorridente de pagamento extra; Caramelo anota a hora trabalhada.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) working happily on a laptop at a sunny cafe table, handing over a tidy wrapped creative project and receiving fresh extra coins, while Caramelo (caramel dog) checks a clean timer beside a coffee mug. Aspect ratio 3:4.`

- **Página 5 (`m5-l5` — A esteira da renda extra)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma esteira organizada onde moedas extras do freela se dividem automaticamente em três baldes: quitar dívida, tijolo da reserva e um pouco de lazer merecido.
  - *Prompt:* `[Style Prefix] A clever colorful conveyor belt sorting shiny extra coins into three clear labeled buckets: a brick reserve jar, a debt-eraser box, and a small cheerful party cup, operated by Tostão (pink pig) and Caramelo (caramel dog). Aspect ratio 3:4.`

---

### Livro 6 — Primeiro salário
**Arco com o elenco:** O mundo do trabalho formal e PJ! Tostão desvenda o holerite com o Caramelo, descobre o cofre oculto do FGTS e evita as ciladas do 13º e das férias.

- **Página 1 (`m6-l1` — O sumiço entre o bruto e o líquido)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um bolo grande de salário chegando na esteira, mas duas pequenas fatias de contribuição/imposto saem pelo caminho antes do prato final chegar à mesa; Caramelo usa binóculos.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) watches a large golden cake labeled conceptually as gross pay pass through two tidy official slices onto his plate, while Caramelo (caramel dog) uses binoculars to show exactly where every crumb went. Aspect ratio 3:4.`

- **Página 2 (`m6-l2` — O enigma do FGTS: patrimônio invisível)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um cofrinho azul enterrado/escondido atrás de uma parede de vidro que vai enchendo aos poucos todo mês; Tostão e Caramelo descobrem o cofre secreto acendendo uma lanterna.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) and Caramelo (caramel dog) shining a flashlight onto a hidden sky-blue glass vault behind the workplace wall, discovering steady monthly deposits stacking neatly inside. Aspect ratio 3:4.`

- **Página 3 (`m6-l3` — O mito do 13º: salário ou bônus?)**
  - *Elenco:* Tostão + Tigrinho
  - *Cena (PT):* Dezembro festivo com o Tigrinho tentando empurrar sacolas de Natal gigantes; Tostão guarda metade do pacote de 13º numa pasta marcada para Janeiro (IPVA/contas de início de ano).
  - *Prompt:* `[Style Prefix] In a festive December market, Tigrinho (tiger villain) pushes flashy holiday shopping bags, while calm Tostão (pink pig in coral-orange cap) locks half of a golden year-end envelope inside a sturdy January shield folder. Aspect ratio 3:4.`

- **Página 4 (`m6-l4` — Férias: o descanso que vira armadilha)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão numa rede na praia de óculos escuros e coco na mão, mas olhando para um calendário com o mês seguinte vazio na geladeira; Caramelo segura uma boia-reserva salva-vidas.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap and sunglasses) relaxing in a bright hammock under palm trees, glancing peacefully at a tidy life-preserver jar kept safe by Caramelo (caramel dog) for the month after vacation. Aspect ratio 3:4.`

- **Página 5 (`m6-l5` — CLT vs. PJ/MEI: a conta que ninguém faz)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Duas mochilas numa balança: uma mochila com vários bolsos de direitos (férias, 13º, FGTS) e outra mochila lisa maior mas que precisa carregar tudo sozinha; Tostão compara na calculadora.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) comparing two backpacks on a wooden table: one backpack covered with protective pockets and safety patches, and another larger plain backpack next to a notepad of hidden costs, Caramelo sitting attentively. Aspect ratio 3:4.`

---

### Livro 7 — Abrindo o cofre
**Arco com o elenco:** Tostão abre a porta do cofre dos investimentos seguros: CDB, FGC, Imposto de Renda, Tesouro Direto e a corrida contra a inflação.

- **Página 1 (`m7-l1` — O que é emprestar dinheiro para o banco — CDB)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Inversão divertida: em vez de o banco emprestar pro Tostão, o Tostão entrega uma moeda para o prédio do banco e recebe um recibo oficial rendendo juros de volta.
  - *Prompt:* `[Style Prefix] Playful role reversal: Tostão (pink pig in coral-orange cap) dressed as a polite tiny lender handing a coin over a miniature bank counter and receiving an official glowing green interest certificate, while Caramelo (caramel dog) stamps it approved. Aspect ratio 3:4.`

- **Página 2 (`m7-l2` — O muro do FGC: mito vs. realidade)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um banquinho digital pequeno tremendo na chuva, mas cercado por uma cúpula/guarda-chuva protetor gigante marcado com um escudo de garantia mantendo as moedas secas.
  - *Prompt:* `[Style Prefix] A small digital bank building shaking slightly in rain, safely covered by a massive glowing mint-green protective dome shield keeping all of Tostão's and Caramelo's savings coins warm and dry inside. Aspect ratio 3:4.`

- **Página 3 (`m7-l3` — O leão e o tempo: tabela regressiva do IR)**
  - *Elenco:* Tostão + Leão amigável da receita + Caramelo
  - *Cena (PT):* Um leão de gravata sentado atrás de uma ampulheta gigante: quando a areia passa rápido (poucos dias), a mordida na fatia é grande; com paciência, a mordida diminui bem.
  - *Prompt:* `[Style Prefix] A dignified cartoon lion wearing glasses sits beside a giant hourglass; as sand flows toward the patient green side of the clock, the lion takes a smaller polite nibble from a golden pie, watched calmly by Tostão (pink pig) and Caramelo. Aspect ratio 3:4.`

- **Página 4 (`m7-l4` — Tesouro Direto: emprestando para o dono do país)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um mapa do tesouro moderno no celular apontando para um baú estatal sólido no topo de uma colina verde-amarela segura, sem piratas.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) and Caramelo (caramel dog) holding an illuminated modern treasure map leading to a solid brass-bound chest sitting safely atop a bright Brazilian green-and-yellow hill. Aspect ratio 3:4.`

- **Página 5 (`m7-l5` — A inflação come seu dinheiro dormindo)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um colchão confortável com moedas dormindo debaixo, enquanto uma traça/bicho invisível chamado inflação vai roendo as bordas das notas; Caramelo acorda o dinheiro.
  - *Prompt:* `[Style Prefix] Coins snoring peacefully under a cozy mattress while sneaky tiny shadow moths nibble away the edges of the banknotes, as Caramelo (caramel dog) barks to wake them up and Tostão (pink pig) moves them to a glowing jar. Aspect ratio 3:4.`

---

### Livro 8 — Bolsa sem hype
**Arco com o elenco:** Entrando na renda variável com os pés no chão: ações como pedaços de empresas reais, FIIs, ETFs, gurus de Ferrari alugada (Tigrinho/Urubu) e cripto com cautela.

- **Página 1 (`m8-l1` — Ação não é bilhete de loteria)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Tostão segurando a chave de um mini galpão/fábrica real funcionando com caminhões e luzes acesas, ignorando um bilhete raspadinha brilhante ao lado.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) admiring a bustling miniature factory and sunlit store through a magnifying glass as a tiny co-owner, ignoring a flashy crumpled lottery ticket on the ground, Caramelo beside him. Aspect ratio 3:4.`

- **Página 2 (`m8-l2` — O aluguel dos Fundos Imobiliários — FIIs)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Um mini shopping e galpão logístico fofo no bairro entregando pequenas moedinhas mensais pela caixinha de correio para o Tostão e o Caramelo.
  - *Prompt:* `[Style Prefix] Cute miniature logistics warehouse and neighborhood mall emitting tiny steady golden coins every month into a cheerful mailbox checked by Tostão (pink pig in coral-orange cap) and Caramelo (caramel dog). Aspect ratio 3:4.`

- **Página 3 (`m8-l3` — ETFs: compre o mercado inteiro de uma vez)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Em vez de equilibrar um único ovo frágil, Tostão segura uma cesta gigante e firme cheia de dezenas de mini prédios e empresas diversas andando juntas.
  - *Prompt:* `[Style Prefix] Tostão (pink pig in coral-orange cap) carrying a sturdy woven market basket neatly packed with dozens of tiny colorful shops, farms, factories, and tech towers all growing together, while Caramelo trots happily ahead. Aspect ratio 3:4.`

- **Página 4 (`m8-l4` — A anatomia do guru de internet)**
  - *Elenco:* Tigrinho + Tostão + Caramelo
  - *Cena (PT):* O Tigrinho posando de terno brilhante encostado num carro esportivo de papelão cenográfico com preço de aluguel pendurado; o Caramelo puxa o suporte atrás revelando o cenário falso.
  - *Prompt:* `[Style Prefix] Tigrinho (flashy cartoon tiger in tuxedo) posing smugly for a selfie next to a glamorous sports car that Caramelo (caramel dog) pulls slightly aside to reveal it is just a flat painted cardboard cutout with a rental tag, Tostão laughing knowingly. Aspect ratio 3:4.`

- **Página 5 (`m8-l5` — Criptoativos: inovação com estômago de aço)**
  - *Elenco:* Tostão + Caramelo
  - *Cena (PT):* Uma montanha-russa radical cheia de altos e baixos radicais no horizonte; Tostão coloca só uma moedinha minúscula com cinto de segurança no carrinho, deixando o resto seguro na mochila.
  - *Prompt:* `[Style Prefix] A wild looping neon rollercoaster in the background; in the foreground Tostão (pink pig in coral-orange cap) places only one tiny silver coin wearing a safety helmet into the coaster cart while keeping his main backpack safely anchored with Caramelo. Aspect ratio 3:4.`

---

### Livro 9 — Defesa pessoal
**Arco com o elenco:** Confronto final contra **Tigrinho** e **Urubu do Pix**! Todas as artimanhas digitais expostas e derrotadas pela dupla Tostão & Caramelo.

- **Página 1 (`m9-l1` — Golpes do dia a dia: golpe do Pix e falsa central)**
  - *Elenco:* Urubu do Pix + Tostão + Caramelo
  - *Cena (PT):* O Urubu disfarçado com fone de telemarketing embaixo de uma máscara falsa de banco falando ao telefone; o Caramelo desconecta o cabo da linha e o Tostão desliga a chamada com segurança.
  - *Prompt:* `[Style Prefix] Urubu (shady black vulture) wearing a fake bank-agent headset in a cardboard booth making an urgent phone call, while smart Caramelo (caramel dog) unplugs the cord and Tostão (pink pig) calmly taps hang-up on his phone. Aspect ratio 3:4.`

- **Página 2 (`m9-l2` — A matemática perversa das bets e tigrinhos)**
  - *Elenco:* Tigrinho + Tostão + Caramelo
  - *Cena (PT):* Uma máquina caça-níquel gigante com a boca do Tigrinho sorrindo na frente, mas por trás da máquina uma esteira joga todas as moedas direto no bolso dele; Caramelo aponta para o esquema.
  - *Prompt:* `[Style Prefix] Giant glowing casino slot machine decorated with Tigrinho's smiling face in front, while behind the glass panel Caramelo (caramel dog) reveals a hidden chute draining every coin straight into Tigrinho's vault; Tostão folds his arms unimpressed. Aspect ratio 3:4.`

- **Página 3 (`m9-l3` — Pirâmides financeiras: o amigo que sumiu e voltou rico)**
  - *Elenco:* Urubu do Pix + Tostão + Caramelo
  - *Cena (PT):* Uma pirâmide feita de cartas de baralho prestes a desmoronar, com o Urubu no topo com um saco cheio e a base cheia de gente segurando cartas tremendo; Tostão alerta quem está chegando.
  - *Prompt:* `[Style Prefix] A fragile towering pyramid built of playing cards wobbling dangerously; Urubu sits smugly at the tiny top holding a money bag while the wide bottom layer trembles, as Tostão (pink pig) and Caramelo warn newcomers away from the crumbling structure. Aspect ratio 3:4.`

- **Página 4 (`m9-l4` — O golpe da vaga de emprego que cobra para contratar)**
  - *Elenco:* Urubu do Pix + Tostão + Caramelo
  - *Cena (PT):* Uma plaquinha falsa "VAGA GARANTIDA" na porta, mas na entrada tem uma catraca cobrando moeda para fazer entrevista; o Tostão dá meia volta firme guiado pelo faro do Caramelo.
  - *Prompt:* `[Style Prefix] A fake office doorway with a bright hiring sign blocked by a sketchy coin-operated turnstile demanded by Urubu; Tostão (pink pig in coral-orange cap) walks confidently away guided by Caramelo (caramel dog) sniffing out the scam. Aspect ratio 3:4.`

- **Página 5 (`m9-l5` — A armadilha da renda fácil na internet)**
  - *Elenco:* Tostão + Caramelo + Tigrinho + Urubu (derrotados)
  - *Cena (PT):* Tigrinho e Urubu saem de fininho derrotados com seus anúncios falsos de "clique e ganhe R$ 200", enquanto Tostão e Caramelo comemoram no centro com o diploma de defesa pessoal.
  - *Prompt:* `[Style Prefix] Triumphant finale: Tigrinho and Urubu slink away defeated with crumpled fake "easy cash click" ads, while Tostão (pink pig in coral-orange cap) and Caramelo (caramel dog) celebrate high-fiving with a golden personal-defense shield. Aspect ratio 3:4.`

---

## 3. Slides Internos das Aulas que Precisam de Imagem

No player (`apps/web/app/(app)/aprender/[licao]/player.tsx`), os 6 passos hoje usam apenas o bonequinho pequeno no cabeçalho (`84px`). **Não é necessário gerar imagem para todos os 270 passos**, mas vale muito a pena gerar **14 ilustrações-chave** para passos conceituais/dilemas que são visuais por natureza (e substituem ou enriquecem a explicação escrita):

1. **`slide-m1-l2-pizza` (M1L2 — Conceito):** Gráfico ilustrado de uma pizza viva com 3 fatias (50% Necessidades / 30% Desejos / 20% Futuro), Caramelo equilibrando a fatia do meio.
2. **`slide-m2-l2-rotativo` (M2L2 — Conceito):** Comparação visual "Fatura R$ 500 → Pagou mínimo R$ 50 → Teto 100% vira R$ 1.000", bola de neve girando com Tigrinho rindo.
3. **`slide-m2-l4-pix-parcelado` (M2L4 — Conceito):** Raio-X de um Pix parcelado: na frente parece 4x pequenas, no raio-X aparece o monstro do CET puxando metade do valor.
4. **`slide-m2-l5-regua-fatura` (M2L5 — Conceito):** Régua visual ilustrada de calendário: compra antes do fechamento (cai já) vs. compra 1 dia depois (ganha ~40 dias de fôlego).
5. **`slide-m3-l2-avalanche-bola` (M3L2 — Simulador/Conceito):** Dois caminhos na montanha: Método Avalanche (atacando o pico de juros mais alto) vs. Bola de Neve (limpando pequenas pedras rápido).
6. **`slide-m3-l5-minimo-existencial` (M3L5 — Conceito):** Círculo protetor no prato de comida e teto da casa: "Mínimo Existencial" protegido por lei contra descontos.
7. **`slide-m4-l1-muro-clt-autonomo` (M4L1 — Conceito):** Comparação visual de dois muros: muro de 3–6 tijolos (CLT) vs. muro de 6–12 tijolos (Autônomo/Informal).
8. **`slide-m6-l1-holerite` (M6L1 — Conceito):** Raio-X ilustrado de um holerite onde Tostão e Caramelo apontam o caminho do Bruto → descontos (INSS/IR) → Líquido na conta.
9. **`slide-m6-l2-saque-aniversario` (M6L2 — Conceito):** Cadeado no cofre do FGTS mostrando a diferença entre sacar tudo na rescisão vs. ficar travado no saque-aniversário.
10. **`slide-m6-l5-clt-pj` (M6L5 — Conceito):** Balança visual comparando R$ 1.800 CLT (com 13º, férias, FGTS) vs. R$ 2.400 PJ sem benefícios.
11. **`slide-m7-l3-tabela-ir` (M7L3 — Conceito):** Escada descendente do Leão do IR (22,5% → 20% → 17,5% → 15% + IOF nos primeiros 30 dias).
12. **`slide-m7-l5-inflacao` (M7L5 — Conceito):** Carrinho de supermercado de 2 anos atrás cheio vs. carrinho de hoje com as mesmas notas de R$ 100.
13. **`slide-m8-l3-etf-cesta` (M8L3 — Conceito):** Ovo único num prato balançando vs. cesta acolchoada com dezenas de mini empresas diversas.
14. **`slide-m9-l2-house-edge` (M9L2 — Simulador/Conceito):** Gráfico ilustrado de 1.000 jogadas onde pequenos picos de sorte sempre descem pela rampa da "vantagem da banca" até zerar.

*Prompt base para cada slide:* `[Style Prefix] Clean educational diagram illustration (visual metaphor, no text, no numbers, crisp readable silhouettes), [descrição da cena acima]. Aspect ratio 4:3.`

---

## 4. Tela "Ver todos os módulos" (`/aprender/trilha`) — Conceito Biblioteca

Sugestão de evolução da tela `/aprender/trilha`:
- Em vez de apenas bolinhas em zigue-zague, transformar a trilha em uma **Biblioteca do Tostão** com **prateleiras ilustradas** (ou mantendo o caminho em trilha com capas de livros desenhadas no lugar das bolinhas).
- Cada módulo aparece como um **livro ilustrado de capa dura** na estante:
  - **Concluído:** capa colorida com marcador dourado;
  - **Em andamento:** livro aberto/destacado com brilho suave;
  - **Bloqueado / Próximos:** lombada/capa em **preto e branco meio apagado** com cadeado pequeno;
  - **Opcional (M3):** marcação tracejada especial.

---

## 5. Prompts para TODOS os Ícones do App (51 ícones únicos)

Use o **Icon Style Prefix** da Seção 1C em todos os prompts abaixo.

### A) Capas / Ícones dos 9 Módulos (`modulo/1` a `modulo/9`)
1. **`modulo/1` (Saindo da neblina):** `a charming brass-and-coral pocket compass cutting through soft swirl mist, mint needle pointing north`
2. **`modulo/2` (Cartão sem armadilha):** `a cute stylized credit card partially caught in a cartoon spring-snap mouse trap, warning coral accents`
3. **`modulo/3` (Batalha contra a dívida):** `crossed wooden shield and bright eraser-sword breaking a small iron chain link`
4. **`modulo/4` (Construindo o muro):** `a neat mini stack of warm terracotta-and-yellow bricks with a tiny trowel and mint sparkle`
5. **`modulo/5` (Investir em você):** `a glowing yellow lightbulb sprouting mint-green leaves inside a small terracotta pot`
6. **`modulo/6` (Primeiro salário):** `a crisp cream payslip envelope tucked into a warm leather wallet with a small mint coin peeking out`
7. **`modulo/7` (Abrindo o cofre):** `a chunky rounded cartoon bank vault door slightly ajar revealing warm golden glow inside`
8. **`modulo/8` (Bolsa sem hype):** `a calm sturdy upward stair-step chart line resting on a solid building block, mint-green arrow`
9. **`modulo/9` (Defesa pessoal):** `a bold rounded coral-and-mint protective shield with a bright keyhole badge in the center`

### B) Categorias de Gastos e Entradas (`cat/*` — 17 ícones)
10. **`cat/apostas`:** `a pair of tilted coral-red dice with a small caution triangle badge`
11. **`cat/assinaturas`:** `a cute rounded retro-modern streaming screen with a looping circular refresh arrow`
12. **`cat/casa`:** `a cozy warm cottage house with a coral roof and glowing yellow window`
13. **`cat/comer-fora`:** `a round cream dinner plate flanked by a fork and knife in warm charcoal outline`
14. **`cat/compras`:** `a cheerful coral-orange shopping tote bag with rounded rope handles`
15. **`cat/delivery`:** `a speedy mini delivery scooter thermal box with tiny motion lines in coral and yellow`
16. **`cat/entrada-outros`:** `an open mint-green tray catching a golden coin arrow dropping smoothly inside`
17. **`cat/estudo`:** `a neat stack of two colorful hardcover books with a yellow bookmark ribbon`
18. **`cat/jogos`:** `a rounded pastel-blue video game controller with bright yellow buttons`
19. **`cat/mercado`:** `a tidy wire-and-mint grocery shopping cart holding a baguette and red apple`
20. **`cat/nao-conta`:** `two opposing curved swap arrows in soft sky-blue and cream inside a circle`
21. **`cat/outros`:** `a neat closed cardboard craft parcel box tied with mint twine`
22. **`cat/role`:** `two cheerful clinking party soda/juice glasses with tiny golden fizz stars`
23. **`cat/salario`:** `a plump tied canvas money pouch with a crisp golden coin emblem on the front`
24. **`cat/saude`:** `a rounded coral-and-cream first-aid heart badge with a crisp medical cross`
25. **`cat/sem-categoria`:** `a playful tilted round tag with a friendly bold question mark in coral`
26. **`cat/transporte`:** `a cute rounded yellow-and-mint city bus front view with friendly headlights`

### C) Metas (`meta/*` — 4 ícones)
27. **`meta/outro`:** `a classic cheerful pink ceramic piggy bank with a golden coin slot on top`
28. **`meta/reserva`:** `a bold coral-and-yellow archery target bullseye with a mint arrow right in the center`
29. **`meta/sair-do-vermelho`:** `a rising mint-green staircase arrow breaking upward past a dashed coral line`
30. **`meta/viagem`:** `a cute stylized sky-blue paper-and-metal airplane soaring over a tiny dashed trail`

### D) Jogos e Missões (`jogo/*` — 4 ícones)
31. **`jogo/batalha`:** `two playful crossed foam-and-wood swords with a sunny yellow spark at the center`
32. **`jogo/dia-cumprido`:** `a glossy mint-green circular badge with a bold thick cream checkmark`
33. **`jogo/tribunal`:** `a chunky warm wooden judge's gavel resting on a small round sounding block`
34. **`jogo/vilao-derrotado`:** `a comedic dizzy golden crown tilted sideways with tiny spin stars`

### E) Conexões e Entrada (`conectar/*` — 3 ícones)
35. **`conectar/anotar`:** `a warm cream pocket notebook with a chunky coral pencil resting diagonally`
36. **`conectar/banco`:** `a clean friendly neoclassical bank temple facade with four sturdy columns and coral roof`
37. **`conectar/extrato`:** `a tidy rolled paper receipt tape with clean horizontal stripe lines and a mint check`

### F) UI Geral (`ui/*` — 9 ícones)
38. **`ui/banco`:** `a solid warm stone bank building icon with columns and bright brass coin accent`
39. **`ui/cartao`:** `a sleek coral-orange credit card with a golden chip and subtle stripe`
40. **`ui/categorizar-ia`:** `two bright golden four-point magic sparkles floating together`
41. **`ui/em-construcao`:** `a cheerful striped coral-and-white safety traffic cone`
42. **`ui/meta-batida`:** `a gleaming sunny-yellow winner trophy cup with a star badge`
43. **`ui/minhas-categorias`:** `a crisp rounded price-style category tag in sky blue with a coral eyelet`
44. **`ui/ofensiva`:** `a vibrant dancing coral-and-yellow campfire flame icon`
45. **`ui/whatsapp-chat`:** `a rounded mint-green speech bubble with three cozy cream chat dots`
46. **`ui/xp`:** `a chunky rounded golden five-point star with warm highlight`

### G) Abas de Navegação (`aba/*` — 5 pares inativo/ativo)
47. **`aba/inicio`:** `minimalist cozy house silhouette (outline in off-state, sunny yellow fill in active state)`
48. **`aba/carteira`:** `rounded snap-clasp wallet icon (outline in off-state, sunny yellow fill in active state)`
49. **`aba/tostao`:** `rounded pig-snout / chat speech bubble icon (outline in off-state, sunny yellow fill in active state)`
50. **`aba/aprender`:** `open or closed hardcover storybook icon (outline in off-state, sunny yellow fill in active state)`
51. **`aba/perfil`:** `friendly rounded person bust / hamburger profile badge (outline in off-state, sunny yellow fill in active state)`
