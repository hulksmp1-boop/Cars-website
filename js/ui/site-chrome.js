/**
 * AETHER GT — Shared site chrome: header, navigation, footer, model credits.
 * Rendered from config.js into <header data-site-header> and <footer data-site-footer>
 * so every page shares one definition.
 */

import { SITE, VEHICLES, MODELS } from '../config.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(href, text, className) {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

function renderHeader(host, current, vehicleId) {
  host.className = 'site-header';
  const inner = el('div', 'site-header__inner container');

  const brand = link(SITE.intro, '', 'brand');
  brand.setAttribute('aria-label', `${SITE.name}: introduction`);
  brand.append('Aether ', el('span', '', 'GT'));

  const nav = el('nav', 'nav');
  nav.setAttribute('aria-label', 'Primary');

  // The wordmark already goes home; the explicit Home link is hidden on narrow screens (chrome.css).
  const home = link(SITE.intro, 'Home', 'nav__home');
  if (current === 'intro') home.setAttribute('aria-current', 'page');
  const collection = link(SITE.collection, 'Collection');
  if (current === 'collection') collection.setAttribute('aria-current', 'page');

  // "Cars": a native <details> disclosure, so it works without any script.
  const menu = el('details', 'nav__cars');
  if (current === 'car') menu.dataset.current = '';
  menu.append(el('summary', '', 'Cars'));
  const list = el('ol', 'nav__cars-list');
  VEHICLES.forEach((vehicle, index) => {
    const li = el('li');
    const a = link(vehicle.page, '');
    a.append(el('b', '', String(index + 1).padStart(2, '0')), `${vehicle.make} ${vehicle.model}`);
    if (vehicle.id === vehicleId) a.setAttribute('aria-current', 'page');
    li.append(a);
    list.append(li);
  });
  menu.append(list);
  nav.append(home, collection, menu);

  // Close on outside click, Escape, or choosing a link.
  document.addEventListener('click', (event) => { if (!menu.contains(event.target)) menu.open = false; });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
  });

  inner.append(brand, nav);
  host.replaceChildren(inner);
}

function creditLine(credit) {
  const p = el('p', 'site-footer__credit');
  p.append('3D model “', credit.title, '” by ');
  p.append(link(credit.authorUrl || credit.sourceUrl, credit.author), ', licensed ');
  p.append(link(credit.licenseUrl, credit.license), ', via ');
  p.append(link(credit.sourceUrl, 'Sketchfab'), '.');
  [...p.querySelectorAll('a')].forEach((a) => { a.rel = 'noopener'; });
  return p;
}

function renderFooter(host, currentVehicleId) {
  host.className = 'site-footer';
  const inner = el('div', 'container site-footer__inner');

  // Wordmark, one line, and the CC BY credits for the model(s) on this page.
  const brand = el('div', 'site-footer__brand');
  const mark = link(SITE.intro, '', 'site-footer__mark');
  mark.append('Aether ', el('em', '', 'GT'));
  brand.append(mark, el('p', 'site-footer__line', 'A study of five modern performance cars.'));

  const credits = el('div', 'site-footer__credits');
  const ids = currentVehicleId ? [currentVehicleId] : VEHICLES.map((v) => v.id);
  ids.forEach((id) => {
    const credit = MODELS[id] && MODELS[id].credit;
    if (credit) credits.append(creditLine(credit));
  });
  if (credits.children.length) brand.append(credits);

  // The five cars, in collection order.
  const cars = el('nav', 'site-footer__cars');
  cars.setAttribute('aria-label', 'The five cars');
  cars.append(el('p', 'site-footer__label', 'The collection'));
  const list = el('ol');
  VEHICLES.forEach((vehicle, index) => {
    const li = el('li');
    const a = link(vehicle.page, '');
    a.append(el('b', '', String(index + 1).padStart(2, '0')), `${vehicle.make} ${vehicle.model}`);
    if (vehicle.id === currentVehicleId) a.setAttribute('aria-current', 'page');
    li.append(a);
    list.append(li);
  });
  cars.append(list);

  const pages = el('nav', 'site-footer__pages');
  pages.setAttribute('aria-label', 'Site');
  pages.append(el('p', 'site-footer__label', 'Site'));
  const pageList = el('ul');
  [['Introduction', SITE.intro], ['Collection', SITE.collection]].forEach(([label, href]) => {
    const li = el('li');
    li.append(link(href, label));
    pageList.append(li);
  });
  pages.append(pageList);

  inner.append(brand, cars, pages);
  host.replaceChildren(inner);
}

/**
 * @param {{ current: 'intro' | 'collection' | 'car', vehicleId?: string }} options
 */
export function mountChrome({ current, vehicleId } = {}) {
  const header = document.querySelector('[data-site-header]');
  const footer = document.querySelector('[data-site-footer]');
  if (header) renderHeader(header, current, vehicleId);
  if (footer) renderFooter(footer, vehicleId);
}
