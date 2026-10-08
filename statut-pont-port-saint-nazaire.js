/**
 * Carte Lovelace - Ponts de Saint-Nazaire
 * Version 2.3 - Design Minimaliste Sombre : Flèches horizontales épurées & Vitesse du vent
 * Source: https://github.com/Zeeod/statut-pont-port-saint-nazaire
 */

// ─── Utilitaires ────────────────────────────────────────────────────────────

function parseBridgeCode(code) {
  if (!code || typeof code !== 'string') return null;
  const clean = code.trim();
  const m = clean.match(/^(M[ue]?|Me|Mu)(\d)(\d)(\d)$/i);
  if (m) {
    const prefix = m[1].toUpperCase();
    const isEmergency = prefix.startsWith('MU') || prefix.startsWith('ME');
    const type = prefix.startsWith('MU') ? 'urgence' : prefix.startsWith('ME') ? 'travaux' : 'normal';
    const lanes = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
    const allClosed = lanes.every(l => l === 0);
    return { type, lanes, allClosed, raw: clean };
  }
  if (['ferme', 'fermé', 'closed'].includes(clean.toLowerCase())) {
    return { type: 'ferme', lanes: [0, 0, 0], allClosed: true, raw: clean };
  }
  if (clean === 'INDETERMINE') {
    return { special: 'indetermine', lanes: [null, null, null], raw: clean };
  }
  return null;
}

function formatTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('fr-FR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
}

function windDirection(deg) {
  if (deg == null || isNaN(deg)) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function windAlert(kmh) {
  if (kmh >= 120) return { level: 'critical', msg: '🚫 Pont FERMÉ (vent > 120 km/h)' };
  if (kmh >= 80) return { level: 'warning', msg: '⚠️ Vitesse limitée à 50 km/h – 2-roues & remorques interdits' };
  if (kmh >= 60) return { level: 'caution', msg: '💨 Vent fort – vigilance requise' };
  return null;
}

// ─── Détection Pont de Saint-Nazaire ──────────────────────────────────────────

function isSaintNazaireBridge(entityId, friendlyName = '') {
  const lowerId = (entityId || '').toLowerCase();
  const lowerName = (friendlyName || '').toLowerCase();
  if (
    lowerId.includes('pertuis') ||
    lowerId.includes('joubert') ||
    lowerId.includes('ecluse') ||
    lowerId.includes('écluse') ||
    lowerId.includes('sud_amont') ||
    lowerId.includes('sud_aval') ||
    lowerName.includes('pertuis') ||
    lowerName.includes('joubert') ||
    lowerName.includes('écluse') ||
    lowerName.includes('ecluse') ||
    lowerName.includes('sud amont') ||
    lowerName.includes('sud aval')
  ) {
    return false;
  }
  return lowerId.includes('pont_saint_nazaire') || 
         lowerId.includes('pont_de_saint_nazaire') || 
         lowerId.includes('grand_pont') ||
         lowerName.includes('pont de saint-nazaire') ||
         lowerName.includes('pont de saint nazaire');
}

// ─── Rendu Épuré des Voies (Flèches horizontales superposées) ──────────────────

function renderMinimalLanes(lanes, allClosed) {
  if (!lanes || lanes.length !== 3) return '';

  const rows = lanes.map((val, idx) => {
    const isClosed = allClosed || val === 0;
    const toStBrevin = val === 1; // St-Nazaire (gauche) -> St-Brévin (droite) = flèche droite ➔
    const toStNaz = val === 2;    // St-Brévin (droite) -> St-Nazaire (gauche) = flèche gauche ⬅

    let arrow = '✖';
    let lineClass = 'psnz-lane-row--closed';

    if (!isClosed) {
      lineClass = 'psnz-lane-row--open';
      if (toStBrevin) {
        arrow = '➔';
      } else if (toStNaz) {
        arrow = '⬅';
      } else {
        arrow = '➔';
      }
    }

    return `
      <div class="psnz-lane-line ${lineClass}">
        <span class="psnz-lane-num">V${idx + 1}</span>
        <span class="psnz-lane-arrow-icon">${arrow}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="psnz-lanes-center-col">
      ${rows}
    </div>
  `;
}

// ─── Rendu Grand Pont de Saint-Nazaire ────────────────────────────────────────

function renderSaintNazaireBridge(hass, config, detectedEntityId = null) {
  let entityCode = config.entity_pont_st_naz || config.main_bridge || detectedEntityId;
  let stCode = entityCode ? hass.states[entityCode] : null;

  // Si non trouvé ou si l'entité actuelle est unavailable, chercher un candidat actif dans hass.states
  if ((!stCode || ['unavailable', 'unknown'].includes((stCode.state || '').toLowerCase())) && hass.states) {
    const candidateKeys = Object.keys(hass.states).filter(k => isSaintNazaireBridge(k, hass.states[k]?.attributes?.friendly_name));
    const activeKey = candidateKeys.find(k => {
      const s = hass.states[k];
      return s && !['unavailable', 'unknown'].includes((s.state || '').toLowerCase());
    });
    if (activeKey) {
      entityCode = activeKey;
      stCode = hass.states[activeKey];
    } else if (!stCode && candidateKeys.length > 0) {
      entityCode = candidateKeys[0];
      stCode = hass.states[candidateKeys[0]];
    }
  }

  const entityLib = config.entity_pont_st_naz_lib || 'sensor.pont_saint_nazaire_libelle';
  const entityTpsSN = config.entity_pont_tps_sn || 'sensor.pont_saint_nazaire_temps_vers_stbrevin';
  const entityTpsSB = config.entity_pont_tps_sb || 'sensor.pont_saint_nazaire_temps_vers_stnazaire';
  const entityNextCode = config.entity_pont_next_code || 'sensor.pont_saint_nazaire_prochaine_code';
  const entityNextLib = config.entity_pont_next_lib || 'sensor.pont_saint_nazaire_prochaine_libelle';
  const entityNextFrom = config.entity_pont_next_from || 'sensor.pont_saint_nazaire_prochaine_depuis';
  
  // Recherche automatique du capteur de vent
  let entityWind = config.entity_wind || 'sensor.vent_pont_saint_nazaire';
  let stWind = hass.states[entityWind];
  if (!stWind) {
    const windKeys = ['sensor.pont_saint_nazaire_vent_vitesse', 'sensor.vent_saint_nazaire', 'sensor.vitesse_du_vent', 'sensor.wind_speed'];
    for (const k of windKeys) {
      if (hass.states[k]) {
        stWind = hass.states[k];
        break;
      }
    }
  }

  // États
  const stLib = hass.states[entityLib];
  const stTpsSN = hass.states[entityTpsSN];
  const stTpsSB = hass.states[entityTpsSB];
  const stNextCode = hass.states[entityNextCode];
  const stNextLib = hass.states[entityNextLib];
  const stNextFrom = hass.states[entityNextFrom];

  // Extraction des attributs
  const attrs = stCode ? (stCode.attributes || {}) : {};
  const rawCode = attrs.code_current_mode || attrs.code_mode || (stCode ? stCode.state : null);
  const code = rawCode && rawCode !== 'unavailable' && rawCode !== 'unknown' ? rawCode : null;
  const parsed = parseBridgeCode(code);
  const allClosed = parsed ? parsed.allClosed : (code === 'M000' || (stCode && ['ferme','closed','fermé'].includes(stCode.state.toLowerCase())));
  const isEmergency = parsed && (parsed.type === 'urgence' || parsed.type === 'travaux');

  const tpsSN = attrs.time_certe_stbrevin != null ? parseFloat(attrs.time_certe_stbrevin) : (attrs.temps_vers_st_brevin != null ? parseFloat(attrs.temps_vers_st_brevin) : (stTpsSN ? parseFloat(stTpsSN.state) : null));
  const tpsSB = attrs.time_stbrevin_certe != null ? parseFloat(attrs.time_stbrevin_certe) : (attrs.temps_vers_st_nazaire != null ? parseFloat(attrs.temps_vers_st_nazaire) : (stTpsSB ? parseFloat(stTpsSB.state) : null));

  const nextCode = attrs.prochaine_code || (stNextCode ? stNextCode.state : null);
  const nextLib = attrs.prochaine_libelle || (stNextLib ? stNextLib.state : null);
  const nextFrom = attrs.prochaine_depuis || (stNextFrom ? stNextFrom.state : null);

  // Vent
  const windSpeed = attrs.vent != null ? parseFloat(attrs.vent) : (attrs.wind_speed != null ? parseFloat(attrs.wind_speed) : (stWind ? parseFloat(stWind.state) : null));
  const windDir = attrs.direction_vent != null ? parseFloat(attrs.direction_vent) : (attrs.wind_dir != null ? parseFloat(attrs.wind_dir) : (stWind?.attributes?.wind_direction_10m != null ? parseFloat(stWind.attributes.wind_direction_10m) : null));
  const windGust = attrs.rafales != null ? parseFloat(attrs.rafales) : (attrs.wind_gust != null ? parseFloat(attrs.wind_gust) : (stWind?.attributes?.wind_gusts_10m != null ? parseFloat(stWind.attributes.wind_gusts_10m) : null));

  let statusBadge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';
  if (allClosed || code === 'M000') {
    statusBadge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
  } else if (isEmergency) {
    statusBadge = `<span class="psnz-badge psnz-badge--orange">${parsed.type === 'urgence' ? 'URGENCE' : 'TRAVAUX'}</span>`;
  }

  // Rendu des Voies au centre
  let lanesHtml = '';
  if (parsed && parsed.lanes) {
    lanesHtml = renderMinimalLanes(parsed.lanes, allClosed);
  } else if (stCode && ['ouvert', 'open'].includes((stCode.state || '').toLowerCase())) {
    lanesHtml = `<div class="psnz-simple-status">🟢 Ouvert</div>`;
  } else if (!code || code === 'unavailable' || code === 'unknown' || !stCode) {
    lanesHtml = `<div class="psnz-unavail">⚠️ Données indisponibles</div>`;
  }

  // Ligne de vent discrète & moderne
  let windRowHtml = '';
  if (windSpeed !== null && !isNaN(windSpeed)) {
    const kmh = Math.round(windSpeed);
    const dirStr = windDirection(windDir);
    const gustStr = (windGust !== null && !isNaN(windGust)) ? ` (rafales ${Math.round(windGust)} km/h)` : '';
    windRowHtml = `
      <div class="psnz-wind-row">
        <span>💨 Vent : <strong>${kmh} km/h</strong> ${dirStr}${gustStr}</span>
      </div>
    `;
  }

  // Alerte vent
  let windAlertHtml = '';
  if (windSpeed !== null && !isNaN(windSpeed)) {
    const alert = windAlert(Math.round(windSpeed));
    if (alert) {
      windAlertHtml = `<div class="psnz-wind-alert psnz-wind-alert--${alert.level}">${alert.msg}</div>`;
    }
  }

  // Prévision prochaine
  let nextHtml = '';
  if (nextLib || nextCode) {
    const nextParsed = parseBridgeCode(nextCode);
    const nextAllClosed = nextParsed ? nextParsed.allClosed : false;
    const nextIcon = nextAllClosed ? '🔴' : '🟢';
    nextHtml = `
      <div class="psnz-next-bar">
        <span>📅 ${nextIcon} ${nextLib || nextCode || '—'}</span>
        ${nextFrom ? `<span>⏰ ${formatTime(nextFrom)}</span>` : ''}
      </div>`;
  }

  return `
    <div class="psnz-card psnz-card--stnaz" data-entity="${entityCode}">
      <div class="psnz-card-header">
        <div class="psnz-card-title">
          <span class="psnz-icon">🌉</span>
          <span>Pont de Saint-Nazaire</span>
        </div>
        ${statusBadge}
      </div>

      <!-- Flux horizontal : Saint-Nazaire (Gauche) -> Flèches Voies (Centre) -> Saint-Brévin (Droite) -->
      <div class="psnz-bridge-flow">
        <div class="psnz-city-side psnz-city--left">
          <div class="psnz-city-name">Saint-Nazaire</div>
          ${tpsSN !== null && !isNaN(tpsSN) ? `<div class="psnz-city-time">⏱️ <span>${Math.round(tpsSN)} min</span></div>` : ''}
        </div>

        ${lanesHtml}

        <div class="psnz-city-side psnz-city--right">
          <div class="psnz-city-name">Saint-Brévin</div>
          ${tpsSB !== null && !isNaN(tpsSB) ? `<div class="psnz-city-time">⏱️ <span>${Math.round(tpsSB)} min</span></div>` : ''}
        </div>
      </div>

      ${windRowHtml}
      ${windAlertHtml}
      ${nextHtml}
    </div>`;
}

// ─── Rendu Pont du Port ───────────────────────────────────────────────────────

function renderPortBridge(hass, entityId) {
  const stateObj = hass.states[entityId];
  if (!stateObj) {
    return `<div class="psnz-card psnz-card--missing">
      <span class="psnz-missing-label">⚠️ Entité non trouvée : ${entityId}</span>
    </div>`;
  }

  const name = stateObj.attributes.friendly_name || entityId;
  const state = (stateObj.state || '').toLowerCase();
  const lastChanged = stateObj.last_changed;
  const lastState = stateObj.attributes.last_state;
  const lastStateTime = stateObj.attributes.last_state_time;
  const minutesLeft = stateObj.attributes.minutes_avant_fermeture;
  const nextEvent = stateObj.attributes.next_event;
  const nextEventTime = stateObj.attributes.next_event_time;

  const isClosed = ['ferme', 'closed', 'off', 'fermé', 'fermeture'].includes(state);
  const isImminent = !isClosed && (state === 'fermeture_imminente' || (minutesLeft !== undefined && minutesLeft !== null && minutesLeft <= 15));
  const isUnavailable = state === 'unavailable' || state === 'unknown';

  let badge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';
  let cardClass = 'psnz-port--open';

  if (isUnavailable) {
    badge = '<span class="psnz-badge psnz-badge--gray">INDISPONIBLE</span>';
    cardClass = 'psnz-port--unavail';
  } else if (isClosed) {
    badge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
    cardClass = 'psnz-port--closed';
  } else if (isImminent) {
    badge = `<span class="psnz-badge psnz-badge--orange">⚠️ ${minutesLeft ? `Ferme dans ${minutesLeft} min` : 'Fermeture < 15 min'}</span>`;
    cardClass = 'psnz-port--warning';
  }

  // Historique dernier changement
  let historyHtml = '';
  if (!isUnavailable) {
    if (lastState) {
      const lastLabel = ['ferme','closed','off','fermé'].includes((lastState||'').toLowerCase()) ? 'Dernière fermeture' : 'Dernière ouverture';
      historyHtml = `<div class="psnz-history">
        <span class="psnz-history-label">${lastLabel} :</span>
        <span class="psnz-history-val">${lastStateTime ? formatTime(lastStateTime) : '—'}</span>
      </div>`;
    } else if (lastChanged) {
      const lcLabel = isClosed ? 'Fermé depuis' : 'Ouvert depuis';
      historyHtml = `<div class="psnz-history">
        <span class="psnz-history-label">${lcLabel} :</span>
        <span class="psnz-history-val">${formatTime(lastChanged)}</span>
      </div>`;
    }
  }

  // Prochain événement
  let nextHtml = '';
  if (nextEvent || nextEventTime) {
    nextHtml = `<div class="psnz-history psnz-history--next">
      <span class="psnz-history-label">📅 Prochain :</span>
      <span class="psnz-history-val">${nextEvent || ''} ${nextEventTime ? formatTime(nextEventTime) : ''}</span>
    </div>`;
  }

  return `
    <div class="psnz-card psnz-card--port ${cardClass}" data-entity="${entityId}">
      <div class="psnz-card-header">
        <div class="psnz-card-title">
          <span class="psnz-icon">🚢</span>
          <span>${name}</span>
        </div>
        ${badge}
      </div>
      ${historyHtml}
      ${nextHtml}
    </div>`;
}

// ─── Styles CSS Modernes & Épurés ──────────────────────────────────────────────

const CARD_STYLES = `
  :host { display: block; }

  .psnz-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .psnz-card {
    background: #18191c;
    border-radius: 14px;
    padding: 14px 16px;
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    border: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
    overflow: hidden;
  }
  .psnz-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .psnz-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .psnz-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.05em;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .psnz-icon { font-size: 1.2em; }

  /* Badges */
  .psnz-badge {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.6px;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.3);
  }
  .psnz-badge--green { border-color: #4CAF50; color: #81C784; background: rgba(76, 175, 80, 0.15); }
  .psnz-badge--red { border-color: #F44336; color: #E57373; background: rgba(244, 67, 54, 0.15); }
  .psnz-badge--orange { border-color: #FF9800; color: #FFB74D; background: rgba(255, 152, 0, 0.15); }
  .psnz-badge--gray { border-color: #757575; color: #BDBDBD; background: rgba(117, 117, 117, 0.15); }

  /* Ponts du port */
  .psnz-port--open { border-left: 4px solid #4CAF50; }
  .psnz-port--closed { border-left: 4px solid #F44336; }
  .psnz-port--warning { border-left: 4px solid #FF9800; }
  .psnz-port--unavail { border-left: 4px solid #757575; }

  /* Flux Grand Pont */
  .psnz-bridge-flow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    gap: 12px;
  }
  .psnz-city-side {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .psnz-city--left { text-align: left; }
  .psnz-city--right { text-align: right; }
  .psnz-city-name {
    font-size: 0.9em;
    font-weight: 700;
    color: #e0e0e0;
  }
  .psnz-city-time {
    font-size: 0.85em;
    color: #81C784;
    margin-top: 4px;
    font-weight: 600;
  }
  .psnz-city-time span {
    font-weight: 700;
  }

  /* Colonne centrale des 3 voies superposées */
  .psnz-lanes-center-col {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 90px;
    align-items: center;
  }
  .psnz-lane-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.85em;
    font-weight: 700;
  }
  .psnz-lane-row--open {
    background: rgba(76, 175, 80, 0.12);
    border: 1px solid rgba(76, 175, 80, 0.3);
    color: #81C784;
  }
  .psnz-lane-row--closed {
    background: rgba(244, 67, 54, 0.12);
    border: 1px solid rgba(244, 67, 54, 0.3);
    color: #E57373;
  }
  .psnz-lane-num {
    font-size: 0.75em;
    opacity: 0.8;
  }
  .psnz-lane-arrow-icon {
    font-size: 1.1em;
    line-height: 1;
  }

  /* Vent & Prévisions */
  .psnz-wind-row {
    margin-top: 10px;
    font-size: 0.82em;
    color: #b0bec5;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .psnz-wind-row strong {
    color: #ffffff;
  }
  .psnz-wind-alert {
    margin-top: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.8em;
    font-weight: 600;
  }
  .psnz-wind-alert--critical { background: rgba(244, 67, 54, 0.2); border: 1px solid #F44336; color: #FF8A80; }
  .psnz-wind-alert--warning { background: rgba(255, 152, 0, 0.2); border: 1px solid #FF9800; color: #FFD180; }
  .psnz-wind-alert--caution { background: rgba(255, 255, 255, 0.05); color: #e0e0e0; }

  .psnz-next-bar {
    margin-top: 8px;
    font-size: 0.78em;
    color: #9e9e9e;
    display: flex;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    padding: 4px 8px;
    border-radius: 6px;
  }

  /* Historique Ponts du Port */
  .psnz-history {
    margin-top: 6px;
    font-size: 0.8em;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    color: #cfd8dc;
  }
  .psnz-history-label { opacity: 0.75; font-weight: 400; }
  .psnz-history-val { font-weight: 600; color: #ffffff; }

  /* Titre de section */
  .psnz-section-title {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--secondary-text-color, #8e8e93);
    padding: 6px 4px 2px;
    opacity: 0.8;
  }

  /* Dernière MAJ */
  .psnz-footer {
    text-align: right;
    font-size: 0.7em;
    color: var(--secondary-text-color, #8e8e93);
    opacity: 0.6;
    padding: 2px 4px 0;
  }
`;

// ─── Web Component ────────────────────────────────────────────────────────────

class StatutPontPortSaintNazaireCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this.config = {
      title: 'Ponts de Saint-Nazaire',
      show_port_bridges: true,
      show_st_nazaire_bridge: true,
      show_wind: true,
      show_next_mode: true,
      port_bridge_entities: [],
      ...config
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    const hass = this._hass;
    const config = this.config;

    // Détection automatique de l'entité du pont de St-Nazaire
    let stNazEntityId = config.entity_pont_st_naz || config.main_bridge || null;
    if (!stNazEntityId && config.entities && Array.isArray(config.entities)) {
      stNazEntityId = config.entities.find(id => {
        const stateObj = hass.states[id];
        return isSaintNazaireBridge(id, stateObj?.attributes?.friendly_name);
      }) || null;
    }

    // Construire le contenu
    let sectionsHtml = '';

    // Section Pont de St-Nazaire
    if (config.show_st_nazaire_bridge !== false) {
      sectionsHtml += renderSaintNazaireBridge(hass, config, stNazEntityId);
    }

    // Section Ponts du Port (filtrage strict pour éviter tout doublon)
    const rawPortList = (config.port_bridge_entities && config.port_bridge_entities.length > 0)
      ? config.port_bridge_entities
      : (Array.isArray(config.entities) ? config.entities : []);

    const portEntities = rawPortList.filter(id => {
      const stateObj = hass.states[id];
      return id !== stNazEntityId && !isSaintNazaireBridge(id, stateObj?.attributes?.friendly_name);
    });

    if (config.show_port_bridges !== false && portEntities.length > 0) {
      if (config.show_st_nazaire_bridge !== false) {
        sectionsHtml += `<div class="psnz-section-title">${config.port_section_title || 'Ponts du Port'}</div>`;
      }
      portEntities.forEach(entityId => {
        sectionsHtml += renderPortBridge(hass, entityId);
      });
    }

    // Timestamp
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    sectionsHtml += `<div class="psnz-footer">Mis à jour à ${now}</div>`;

    const fullHtml = `
      <style>
        ${CARD_STYLES}
      </style>
      <ha-card header="${config.title || 'Ponts de Saint-Nazaire'}">
        <div class="psnz-wrapper">${sectionsHtml}</div>
      </ha-card>`;

    this.shadowRoot.innerHTML = fullHtml;

    // Click → fiche détail
    this.shadowRoot.querySelectorAll('.psnz-card[data-entity]').forEach(el => {
      el.addEventListener('click', () => {
        const entityId = el.getAttribute('data-entity');
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true, composed: true,
          detail: { entityId }
        }));
      });
    });
  }

  static getConfigElement() {
    return document.createElement('statut-pont-port-saint-nazaire-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'Ponts de Saint-Nazaire',
      show_st_nazaire_bridge: true,
      show_port_bridges: true,
      entity_pont_st_naz: 'sensor.pont_saint_nazaire_code',
      port_bridge_entities: [
        'sensor.pont_du_pertuis',
        'sensor.pont_joubert',
      ]
    };
  }

  getCardSize() {
    let size = 0;
    if (this.config.show_st_nazaire_bridge !== false) size += 4;
    const portBridges = (this.config.port_bridge_entities || this.config.entities || []).length;
    size += portBridges;
    return Math.max(size, 1);
  }
}

// ─── Éditeur (basique) ────────────────────────────────────────────────────────

class StatutPontPortSaintNazaireCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; }
}

// ─── Enregistrement ───────────────────────────────────────────────────────────

customElements.define('statut-pont-port-saint-nazaire-card-editor', StatutPontPortSaintNazaireCardEditor);
customElements.define('statut-pont-port-saint-nazaire-card', StatutPontPortSaintNazaireCard);

window.customCards = window.customCards || [];
const existingIdx = window.customCards.findIndex(c => c.type === 'statut-pont-port-saint-nazaire-card');
const cardDef = {
  type: 'statut-pont-port-saint-nazaire-card',
  name: 'Carte Ponts Saint-Nazaire',
  description: 'Statut temps réel des ponts du Port et du Pont de Saint-Nazaire. Design sombre minimaliste, sens de circulation épuré, vent.',
  preview: true,
  documentationURL: 'https://github.com/Zeeod/statut-pont-port-saint-nazaire',
};
if (existingIdx >= 0) window.customCards[existingIdx] = cardDef;
else window.customCards.push(cardDef);