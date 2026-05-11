/* ══════════════════════════════════════════════════════
   main.js
   Pořadí sekcí:
   1. Notion konfigurace
   2. Demo data (fallback)
   3. Jazyk (CZ / EN)
   4. Tabs (výstavy)
   5. Pomocné funkce
   6. Renderování výstav
   7. Renderování médií
   8. Notion API fetch
   9. Inicializace
   10. Kontaktní formulář
   11. Scroll animace
   ══════════════════════════════════════════════════════ */


/* ── 1. NOTION KONFIGURACE ────────────────────────────
   Postup:
   a) Vytvořte Notion integraci na notion.so/my-integrations
   b) Sdílejte databáze s integrací (tlačítko "Connect to" na stránce DB)
   c) Vyplňte hodnoty níže

   Struktura databáze VÝSTAVY:
     Název    (title)
     Název EN (text)
     Místo    (text)
     Datum    (date)
     Stav     (select): "Probíhá" | "Chystané" | "Proběhlé"
     Popis    (text)
     Popis EN (text)

   Struktura databáze MÉDIA:
     Název    (title)
     Název EN (text)
     Médium   (text)  — např. "Respekt", "ČT24"
     Datum    (date)
     Odkaz    (url)

   POZOR: Notion API blokuje přímé volání z prohlížeče (CORS).
   Potřebujete proxy — viz README na konci tohoto souboru.
──────────────────────────────────────────────────── */

const CONFIG = {
  NOTION_TOKEN:    'YOUR_NOTION_TOKEN',           // secret_...
  EXHIBITIONS_DB:  'YOUR_EXHIBITIONS_DATABASE_ID',
  MEDIA_DB:        'YOUR_MEDIA_DATABASE_ID',
  PROXY_URL:       'https://vas-proxy.example.com/notion',
  USE_DEMO:        true,  // true = vždy demo data; false = zkusí Notion, při chybě demo
};


/* ── 2. DEMO DATA ─────────────────────────────────────
   Zobrazí se pokud USE_DEMO: true nebo Notion API selže.
   Smažte nebo ponechte jako zálohu.
──────────────────────────────────────────────────── */

const DEMO_EXHIBITIONS = [
  {
    id: '1',
    title: 'Intimní prostory',
    title_en: 'Intimate Spaces',
    place: 'Galerie Etc., Praha',
    date: '2025-03-01',
    status: 'Proběhlé',
    description: 'Úvodní výstava projektu v pražské Galerii Etc.',
    description_en: 'Opening exhibition of the project at Galerie Etc. Prague.',
  },
  {
    id: '2',
    title: 'Intimní prostory',
    title_en: 'Intimate Spaces',
    place: 'Dům umění, Brno',
    date: '2025-09-10',
    status: 'Proběhlé',
    description: 'Rozšířená verze výstavy s novými rozhovory.',
    description_en: 'Extended version of the exhibition with new interviews.',
  },
  {
    id: '3',
    title: 'Intimní prostory',
    title_en: 'Intimate Spaces',
    place: 'MeetFactory, Praha',
    date: '2026-06-15',
    status: 'Chystané',
    description: 'Letní repríza s doprovodným programem pro veřejnost.',
    description_en: 'Summer reprise with a public programme.',
  },
  {
    id: '4',
    title: 'Mezinárodní prezentace',
    title_en: 'International Presentation',
    place: 'Vienna Art Week',
    date: '2026-11-17',
    status: 'Chystané',
    description: 'Prezentace v rámci Vienna Art Week 2026.',
    description_en: 'Presentation at Vienna Art Week 2026.',
  },
];

const DEMO_MEDIA = [
  {
    id: '1',
    headline: 'Diplomantka, která rozbíjí tabu: Senioři mají právo na intimitu',
    headline_en: 'Graduate who breaks taboo: Seniors have a right to intimacy',
    outlet: 'Respekt',
    date: '2025-04-12',
    url: '#',
  },
  {
    id: '2',
    headline: 'Výstava v brněnském Domě umění staví zrcadlo institucionální péči',
    headline_en: 'Exhibition in Brno holds a mirror to institutional care',
    outlet: 'Český rozhlas',
    date: '2025-09-15',
    url: '#',
  },
  {
    id: '3',
    headline: 'Intimita bez věku. Výzkumný projekt odtabuizovává sexualitu v domovech pro seniory',
    headline_en: 'Intimacy without age. Research project detaboos sexuality in care homes',
    outlet: 'A2',
    date: '2025-10-03',
    url: '#',
  },
  {
    id: '4',
    headline: 'Kde se ve stáří ztrácí tělo? Rozhovor s autorkou projektu',
    headline_en: 'Where does the body disappear in old age? Interview with the project author',
    outlet: 'Deník N',
    date: '2025-11-20',
    url: '#',
  },
  {
    id: '5',
    headline: 'Výzkum, který stát nechce vidět. Intimita seniorů v Česku',
    headline_en: 'Research the state does not want to see. Senior intimacy in Czechia',
    outlet: 'ČT Art',
    date: '2026-01-08',
    url: '#',
  },
  {
    id: '6',
    headline: 'Intimní prostory na cestě do Vídně',
    headline_en: 'Intimate Spaces on its way to Vienna',
    outlet: 'Flash Art CZ',
    date: '2026-03-22',
    url: '#',
  },
];


/* ── 3. JAZYK (CZ / EN) ───────────────────────────────
   Přepíná všechny elementy s atributy data-cs / data-en.
──────────────────────────────────────────────────── */

let currentLang = 'cs';

function setLang(lang) {
  currentLang = lang;

  document.querySelectorAll('[data-cs]').forEach(el => {
    el.textContent = lang === 'cs' ? el.dataset.cs : el.dataset.en;
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  document.documentElement.lang = lang;

  // Znovu vyrenderovat dynamický obsah v novém jazyce
  renderExhibitions(currentExhibitions, currentTab);
  renderMedia(currentMedia);
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});


/* ── 4. TABS (výstavy) ────────────────────────────────
   Filtrování výstav podle stavu.
──────────────────────────────────────────────────── */

let currentTab = 'vsechny';
let currentExhibitions = [];
let currentMedia = [];

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderExhibitions(currentExhibitions, currentTab);
  });
});


/* ── 5. POMOCNÉ FUNKCE ────────────────────────────────
──────────────────────────────────────────────────── */

function formatDate(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-GB', options);
}


/* ── 6. RENDEROVÁNÍ VÝSTAV ────────────────────────────
──────────────────────────────────────────────────── */

function renderExhibitions(data, tab) {
  const container = document.getElementById('exhibitionsContainer');
  const lang = currentLang;

  // Filtrování podle tabu
  let filtered = data;
  if (tab === 'chystane') filtered = data.filter(e => e.status === 'Chystané');
  if (tab === 'probehle') filtered = data.filter(e => e.status === 'Proběhlé');

  if (!filtered.length) {
    container.innerHTML = `<div class="loading-state">${lang === 'cs' ? 'Žádné výstavy.' : 'No exhibitions.'}</div>`;
    return;
  }

  const badgeLabel = {
    'Chystané': lang === 'cs' ? 'Chystané' : 'Upcoming',
    'Probíhá':  lang === 'cs' ? 'Probíhá'  : 'Current',
    'Proběhlé': lang === 'cs' ? 'Proběhlé' : 'Past',
  };
  const badgeClass = {
    'Chystané': 'upcoming',
    'Probíhá':  'current',
    'Proběhlé': 'past',
  };

  container.innerHTML = `
    <div class="exhibition-list">
      ${filtered.map(e => `
        <div class="exhibition-item">
          <div class="ex-date">${formatDate(e.date, lang)}</div>
          <div>
            <div class="ex-title">${lang === 'cs' ? e.title : (e.title_en || e.title)}</div>
            <div class="ex-meta">${e.place}</div>
            ${e.description
              ? `<div class="ex-description">${lang === 'cs' ? e.description : (e.description_en || e.description)}</div>`
              : ''}
          </div>
          <span class="ex-badge ${badgeClass[e.status] || 'past'}">
            ${badgeLabel[e.status] || e.status}
          </span>
        </div>
      `).join('')}
    </div>
  `;
}


/* ── 7. RENDEROVÁNÍ MÉDIÍ ─────────────────────────────
──────────────────────────────────────────────────── */

function renderMedia(data) {
  const container = document.getElementById('mediaContainer');
  const lang = currentLang;

  if (!data.length) {
    container.innerHTML = `<div class="loading-state">${lang === 'cs' ? 'Žádné zmínky.' : 'No press.'}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="media-grid">
      ${data.map(m => `
        <a href="${m.url || '#'}" target="_blank" rel="noopener" class="media-card">
          <div class="media-outlet">${m.outlet}</div>
          <div class="media-headline">${lang === 'cs' ? m.headline : (m.headline_en || m.headline)}</div>
          <div class="media-date">${formatDate(m.date, lang)}</div>
          <span class="media-link-label">${lang === 'cs' ? 'Číst článek →' : 'Read article →'}</span>
        </a>
      `).join('')}
    </div>
  `;
}


/* ── 8. NOTION API FETCH ──────────────────────────────
   Volá proxy endpoint, který přeposílá požadavky na Notion API.
   Při selhání se zobrazí demo data.
──────────────────────────────────────────────────── */

async function fetchFromNotion(dbId, sorts) {
  if (CONFIG.USE_DEMO || CONFIG.NOTION_TOKEN === 'YOUR_NOTION_TOKEN') {
    return null; // přeskočit, použít demo data
  }

  try {
    const resp = await fetch(`${CONFIG.PROXY_URL}/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sorts }),
    });
    if (!resp.ok) throw new Error(`Notion API error: ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('Notion fetch selhal, zobrazuji demo data:', err);
    return null;
  }
}

// Pomocná funkce pro čtení hodnot z Notion properties
function notionPropText(prop) {
  if (!prop) return '';
  if (prop.type === 'title')     return prop.title.map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.type === 'select')    return prop.select?.name || '';
  if (prop.type === 'date')      return prop.date?.start || '';
  if (prop.type === 'url')       return prop.url || '';
  return '';
}

function parseExhibitions(notionData) {
  return notionData.results.map(page => ({
    id:           page.id,
    title:        notionPropText(page.properties['Název']),
    title_en:     notionPropText(page.properties['Název EN']),
    place:        notionPropText(page.properties['Místo']),
    date:         notionPropText(page.properties['Datum']),
    status:       notionPropText(page.properties['Stav']),
    description:  notionPropText(page.properties['Popis']),
    description_en: notionPropText(page.properties['Popis EN']),
  }));
}

function parseMedia(notionData) {
  return notionData.results.map(page => ({
    id:          page.id,
    headline:    notionPropText(page.properties['Název']),
    headline_en: notionPropText(page.properties['Název EN']),
    outlet:      notionPropText(page.properties['Médium']),
    date:        notionPropText(page.properties['Datum']),
    url:         notionPropText(page.properties['Odkaz']),
  }));
}


/* ── 9. INICIALIZACE ──────────────────────────────────
   Spustí se po načtení stránky.
──────────────────────────────────────────────────── */

async function init() {
  // Výstavy
  const exData = await fetchFromNotion(
    CONFIG.EXHIBITIONS_DB,
    [{ property: 'Datum', direction: 'descending' }]
  );
  currentExhibitions = exData ? parseExhibitions(exData) : DEMO_EXHIBITIONS;
  renderExhibitions(currentExhibitions, currentTab);

  // Média
  const mData = await fetchFromNotion(
    CONFIG.MEDIA_DB,
    [{ property: 'Datum', direction: 'descending' }]
  );
  currentMedia = mData ? parseMedia(mData) : DEMO_MEDIA;
  renderMedia(currentMedia);

  // Skrýt setup banner pokud je Notion nakonfigurován
  if (CONFIG.NOTION_TOKEN !== 'YOUR_NOTION_TOKEN') {
    const banner = document.getElementById('setupBanner');
    if (banner) banner.style.display = 'none';
  }

  // Rok ve footeru
  document.getElementById('footerYear').textContent =
    `© ${new Date().getFullYear()} Jméno Příjmení`;
}

init();


/* ── 10. KONTAKTNÍ FORMULÁŘ ───────────────────────────
   Napojte na Formspree nebo jiný backend.
──────────────────────────────────────────────────── */

document.getElementById('contactForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  /* Odkomentujte a vyplňte YOUR_FORMSPREE_ID pro skutečné odesílání:

  const resp = await fetch('https://formspree.io/f/YOUR_FORMSPREE_ID', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new FormData(this),
  });
  if (!resp.ok) {
    alert('Odeslání selhalo. Zkuste to prosím znovu.');
    return;
  }

  */

  const success = document.getElementById('formSuccess');
  success.style.display = 'block';
  this.reset();
  setTimeout(() => { success.style.display = 'none'; }, 5000);
});


/* ── 11. SCROLL ANIMACE ───────────────────────────────
   Elementy s třídou .animate se objeví při scrollování.
──────────────────────────────────────────────────── */

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.animate').forEach(el => observer.observe(el));


/* ══════════════════════════════════════════════════════
   README – NOTION PROXY

   Notion API blokuje přímé volání z prohlížeče (CORS).
   Nejjednodušší řešení:

   VARIANTA A — Netlify Functions (zdarma):
   Vytvořte soubor netlify/functions/notion.js:

     const fetch = require('node-fetch');
     exports.handler = async (event) => {
       const body = JSON.parse(event.body);
       const url  = `https://api.notion.com/v1/databases/${body.dbId}/query`;
       const r    = await fetch(url, {
         method: 'POST',
         headers: {
           'Authorization':  `Bearer ${process.env.NOTION_TOKEN}`,
           'Notion-Version': '2022-06-28',
           'Content-Type':   'application/json',
         },
         body: JSON.stringify({ sorts: body.sorts }),
       });
       return { statusCode: 200, body: await r.text() };
     };

   Pak nastavte: PROXY_URL = '/.netlify/functions/notion'
   A přidejte NOTION_TOKEN do Netlify environment variables.

   VARIANTA B — Vercel Edge Function:
   Podobně, viz docs.vercel.com/functions

   KONTAKTNÍ FORMULÁŘ — Formspree:
   1. Zaregistrujte se na formspree.io
   2. Vytvořte formulář → získáte ID (např. "xvojkpgb")
   3. Odkomentujte fetch() v sekci 10 výše a doplňte ID
══════════════════════════════════════════════════════ */

// ── SCROLL — schovat/ukázat nav
let lastScroll = 0;
const navEl = document.querySelector('nav');

window.addEventListener('scroll', () => {
  const current = window.scrollY;
  if (current > lastScroll && current > 80) {
    navEl.classList.add('hidden');    // scroll dolů → schovat
  } else {
    navEl.classList.remove('hidden'); // scroll nahoru → ukázat
  }
  lastScroll = current;
});