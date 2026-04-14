const JSON_URL =
  "https://gist.githubusercontent.com/saniyusuf/406b843afdfb9c6a86e25753fe2761f4/raw/075b6aaba5ee43554ecd55006e5d080a8acf08fe/Film.JSON";

function setup() {
  noCanvas();

  fetch(JSON_URL)
    .then((res) => res.json())
    .then((films) => {
      populateYearDropdown(films);
      renderFilms(films);

      select("#yearSelect").changed(() => {
        const selected = select("#yearSelect").value();
        const filtered =
          selected === "all"
            ? films
            : films.filter((f) => f.Year === selected);
        renderFilms(filtered);
      });
    })
    .catch((err) => console.error("Failed to load films:", err));
}

function draw() {
  // not needed
}

function populateYearDropdown(films) {
  const years = [...new Set(films.map((f) => f.Year))].sort();
  const sel = select("#yearSelect");
  years.forEach((y) => {
    const opt = createElement("option", y);
    opt.attribute("value", y);
    opt.parent(sel);
  });
}

function renderFilms(films) {
  const grid = select("#film-grid");
  grid.html("");

  if (films.length === 0) {
    const msg = createElement("p", "No films found for this year.");
    msg.class("no-results");
    msg.parent(grid);
    return;
  }

  films.forEach((film) => {
    const card = createElement("div");
    card.class("film-card");

    const img = createElement("img");
    img.attribute(
      "src",
      film.Poster && film.Poster !== "N/A"
        ? film.Poster
        : "https://via.placeholder.com/220x320?text=No+Poster"
    );
    img.attribute("alt", film.Title);
    img.parent(card);

    const info = createElement("div");
    info.class("film-info");

    createElement("h3", film.Title).parent(info);
    createElement("p", `📅 ${film.Year} · ${film.Runtime}`).parent(info);
    createElement("p", `🎬 ${film.Genre}`).parent(info);

    const rating = createElement("p", `⭐ ${film.imdbRating} / 10`);
    rating.class("rating");
    rating.parent(info);

    info.parent(card);
    card.parent(grid);
  });
}