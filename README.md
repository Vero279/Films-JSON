# 🎬 Creative Film Poster Editor

**Projeto 3 — Editor de Posters de Filmes com API e p5.js**
Unidade curricular: Edições Multimédia Interativas · LEM 3 · ISTEC Porto · 2025/2026

---

## Descrição

Browser de filmes interativo que permite pesquisar qualquer filme, obter o poster oficial via API (TMDB/Gist), e aplicar filtros e distorções visuais em tempo real diretamente sobre o poster, usando manipulação de píxeis com p5.js. Combina consumo de dados externos com edição criativa de imagem.

## Demo

🔗 [vero279.github.io/Films-JSON](https://vero279.github.io/Films-JSON/)

## Funcionalidades

**Pesquisa de filmes**
- Busca por título com filtro por ano
- Resultados com posters obtidos via API

**Ferramentas de edição do poster**

| Ferramenta | Descrição |
|---|---|
| 🖐️ Select | Seleciona área do poster |
| 🌫️ Blur | Suaviza píxeis |
| 🔲 Pixelate | Efeito de pixelização |
| ⚡ Glitch | Efeito de distorção digital |
| 📡 Noise | Adiciona ruído visual |
| 🎨 Filter | Filtros de cor (matiz, saturação, exposição, contraste) |
| 🌈 Color | Ajuste de cor avançado |
| 📐 Edges | Deteção de contornos |
| 🌀 Warp | Distorção de forma |
| 🧹 Erase | Apaga efeitos aplicados |
| 🔁 Reset | Restaura o poster original |
| 💾 Save | Guarda o poster editado |

Controlos: **tamanho do brush**, **opacidade** e **dureza** ajustáveis.

## APIs e Fontes de Dados

| Fonte | Função |
|---|---|
| TMDB (via Gist) | Metadados e posters de filmes |
| p5.js pixel manipulation | Processamento e edição de imagem |

## Tecnologias

| Tecnologia | Função |
|---|---|
| p5.js | Manipulação de píxeis e renderização |
| Fetch API | Consumo de dados de filmes |
| HTML5 | Estrutura da aplicação |
| CSS3 | Estilização da interface |
| JavaScript | Lógica da aplicação |

## Estrutura do Repositório

```
Films-JSON/
├── index.html    # Estrutura da aplicação
├── sketch.js     # Lógica principal — pesquisa, fetch e edição de imagem
├── style.css     # Estilos da interface
└── README.md
```

## Como Executar Localmente

```bash
git clone https://github.com/Vero279/Films-JSON.git
cd Films-JSON
# Abrir index.html num servidor local (ex: Live Server no VS Code)
```

> **Nota:** O carregamento de posters via fetch requer ligação à internet. Servir localmente via servidor HTTP para evitar restrições de CORS.

## Autora

**Verónica Couto** · veronica.couto.2022279@my.istec.pt
