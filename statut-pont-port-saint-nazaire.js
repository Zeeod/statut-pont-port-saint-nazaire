/**
 * Carte Lovelace - Ponts de Saint-Nazaire
 * Version 2.0 - avec données temps réel, sens de circulation SVG, vent, prévisions
 * Source: https://github.com/Zeeod/statut-pont-port-saint-nazaire
 */

// ─── Utilitaires ────────────────────────────────────────────────────────────

function parseBridgeCode(code) {
  if (!code || typeof code !== 'string') return null;
  const m = code.match(/^(M[ue]?|Me|Mu)(\d)(\d)(\d)$/i);
  if (!m) {
    if (code === 'INDETERMINE') return { special: 'indetermine', lanes: [null, null, null] };
    return null;
  }
  const prefix = m[1].toUpperCase();
  const isEmergency = prefix.startsWith('MU') || prefix.startsWith('ME');
  const type = prefix.startsWith('MU') ? 'urgence' : prefix.startsWith('ME') ? 'travaux' : 'normal';
  const lanes = [parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
  const allClosed = lanes.every(l => l === 0);
  return { type, lanes, allClosed, raw: code };
}

function laneStatus(val) {
  if (val === 0) return 'closed';
  if (val === 1) return 'stnaz'; // St-Nazaire → St-Brévin
  if (val === 2) return 'stbrevin'; // St-Brévin → St-Nazaire
  return 'unknown';
}

function formatTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleString('fr-FR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return isoString; }
}

function windDirection(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function beaufortScale(kmh) {
  if (kmh < 1) return 0;
  if (kmh < 6) return 1;
  if (kmh < 12) return 2;
  if (kmh < 20) return 3;
  if (kmh < 29) return 4;
  if (kmh < 39) return 5;
  if (kmh < 50) return 6;
  if (kmh < 62) return 7;
  if (kmh < 75) return 8;
  if (kmh < 89) return 9;
  if (kmh < 103) return 10;
  if (kmh < 118) return 11;
  return 12;
}

function windAlert(kmh) {
  if (kmh >= 120) return { level: 'critical', msg: '🚫 Pont FERMÉ (vent > 120 km/h)' };
  if (kmh >= 80) return { level: 'warning', msg: '⚠️ Vitesse limitée 50 km/h – 2-roues interdits' };
  if (kmh >= 60) return { level: 'caution', msg: '💨 Vent fort – prudence recommandée' };
  return null;
}

// ─── SVG Sens de circulation ─────────────────────────────────────────────────

function renderLaneSVG(lanes, allClosed) {
  const W = 200, H = 80;
  const laneW = 50, laneH = 56;
  const startX = 25, startY = 12;
  const laneColors = { closed: '#444', stnaz: '#2196F3', stbrevin: '#FF9800', unknown: '#888' };

  let svgLanes = '';
  for (let i = 0; i < 3; i++) {
    const status = allClosed ? 'closed' : laneStatus(lanes[i]);
    const x = startX + i * (laneW + 2);
    const y = startY;
    const col = laneColors[status] || '#888';

    svgLanes += `<rect x="${x}" y="${y}" width="${laneW}" height="${laneH}" rx="6"
      fill="${col}" opacity="0.92"/>`;

    // Numéro de voie
    svgLanes += `<text x="${x + laneW/2}" y="${y + 10}" text-anchor="middle"
      font-size="9" fill="rgba(255,255,255,0.7)" font-family="sans-serif">V${i+1}</text>`;

    if (status === 'closed') {
      // Croix rouge
      svgLanes += `
        <line x1="${x+12}" y1="${y+22}" x2="${x+laneW-12}" y2="${y+laneH-14}"
          stroke="#ff5252" stroke-width="3" stroke-linecap="round"/>
        <line x1="${x+laneW-12}" y1="${y+22}" x2="${x+12}" y2="${y+laneH-14}"
          stroke="#ff5252" stroke-width="3" stroke-linecap="round"/>`;
    } else if (status === 'stnaz') {
      // Flèche vers le bas (St-Naz → St-Brévin = direction sud)
      const ax = x + laneW/2;
      svgLanes += `
        <line x1="${ax}" y1="${y+16}" x2="${ax}" y2="${y+laneH-16}"
          stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="${ax-7},${y+laneH-20} ${ax+7},${y+laneH-20} ${ax},${y+laneH-8}"
          fill="white"/>`;
    } else if (status === 'stbrevin') {
      // Flèche vers le haut (St-Brévin → St-Naz = direction nord)
      const ax = x + laneW/2;
      svgLanes += `
        <line x1="${ax}" y1="${y+laneH-16}" x2="${ax}" y2="${y+16}"
          stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="${ax-7},${y+20} ${ax+7},${y+20} ${ax},${y+8}"
          fill="white"/>`;
    }
  }

  // Labels
  const labelsY = H - 2;
  const labelStyle = 'font-size:8px;fill:rgba(255,255,255,0.5);font-family:sans-serif;text-anchor:middle';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:220px;display:block;margin:8px auto 0">
    <!-- Légende haut -->
    <text x="100" y="10" style="font-size:9px;fill:rgba(255,255,255,0.6);font-family:sans-serif;text-anchor:middle">← St-Nazaire</text>
    ${svgLanes}
    <!-- Légende bas -->
    <text x="100" y="${labelsY}" style="font-size:9px;fill:rgba(255,255,255,0.6);font-family:sans-serif;text-anchor:middle">St-Brévin →</text>
    <!-- Légende couleurs -->
    <rect x="2" y="${startY}" width="8" height="8" rx="2" fill="#2196F3"/>
    <text x="12" y="${startY+7}" style="${labelStyle};text-anchor:start">→ StNaz</text>
    <rect x="2" y="${startY+12}" width="8" height="8" rx="2" fill="#FF9800"/>
    <text x="12" y="${startY+19}" style="${labelStyle};text-anchor:start">→ StBrévin</text>
  </svg>`;
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

// ─── Rendu Pont de Saint-Nazaire ─────────────────────────────────────────────

function renderSaintNazaireBridge(hass, config, detectedEntityId = null) {
  const entityCode = config.entity_pont_st_naz || config.main_bridge || detectedEntityId || 'sensor.pont_saint_nazaire_code';
  const entityLib = config.entity_pont_st_naz_lib || 'sensor.pont_saint_nazaire_libelle';
  const entityTpsSN = config.entity_pont_tps_sn || 'sensor.pont_saint_nazaire_temps_vers_stbrevin';
  const entityTpsSB = config.entity_pont_tps_sb || 'sensor.pont_saint_nazaire_temps_vers_stnazaire';
  const entityNextCode = config.entity_pont_next_code || 'sensor.pont_saint_nazaire_prochaine_code';
  const entityNextLib = config.entity_pont_next_lib || 'sensor.pont_saint_nazaire_prochaine_libelle';
  const entityNextFrom = config.entity_pont_next_from || 'sensor.pont_saint_nazaire_prochaine_depuis';
  const entityWind = config.entity_wind || 'sensor.pont_saint_nazaire_vent_vitesse';
  const entityWindDir = config.entity_wind_dir || 'sensor.pont_saint_nazaire_vent_direction';
  const entityWindGust = config.entity_wind_gust || 'sensor.pont_saint_nazaire_vent_rafales';

  // États
  const stCode = hass.states[entityCode];
  const stLib = hass.states[entityLib];
  const stTpsSN = hass.states[entityTpsSN];
  const stTpsSB = hass.states[entityTpsSB];
  const stNextCode = hass.states[entityNextCode];
  const stNextLib = hass.states[entityNextLib];
  const stNextFrom = hass.states[entityNextFrom];
  const stWind = hass.states[entityWind];
  const stWindDir = hass.states[entityWindDir];
  const stWindGust = hass.states[entityWindGust];

  // Récupération souple du code et du libellé (support capteur unique multi-attributs ou capteurs séparés)
  const attrs = stCode ? (stCode.attributes || {}) : {};
  const rawCode = attrs.code_current_mode || attrs.code_mode || (stCode ? stCode.state : null);
  const code = rawCode && rawCode !== 'unavailable' && rawCode !== 'unknown' ? rawCode : null;
  const lib = attrs.lib_current_mode || attrs.voies_ouvertes || (stLib ? stLib.state : null) || (code && !code.startsWith('M') ? code : (code || '—'));
  const parsed = parseBridgeCode(code);
  const allClosed = parsed ? parsed.allClosed : (code === 'M000' || (stCode && ['ferme','closed','fermé'].includes(stCode.state.toLowerCase())));
  const isEmergency = parsed && (parsed.type === 'urgence' || parsed.type === 'travaux');

  const tpsSN = attrs.time_certe_stbrevin != null ? parseFloat(attrs.time_certe_stbrevin) : (attrs.temps_vers_st_brevin != null ? parseFloat(attrs.temps_vers_st_brevin) : (stTpsSN ? parseFloat(stTpsSN.state) : null));
  const tpsSB = attrs.time_stbrevin_certe != null ? parseFloat(attrs.time_stbrevin_certe) : (attrs.temps_vers_st_nazaire != null ? parseFloat(attrs.temps_vers_st_nazaire) : (stTpsSB ? parseFloat(stTpsSB.state) : null));

  const nextCode = attrs.prochaine_code || (stNextCode ? stNextCode.state : null);
  const nextLib = attrs.prochaine_libelle || (stNextLib ? stNextLib.state : null);
  const nextFrom = attrs.prochaine_depuis || (stNextFrom ? stNextFrom.state : null);

  const windSpeed = attrs.vent != null ? parseFloat(attrs.vent) : (attrs.wind_speed != null ? parseFloat(attrs.wind_speed) : (stWind ? parseFloat(stWind.state) : null));
  const windDir = attrs.direction_vent != null ? parseFloat(attrs.direction_vent) : (attrs.wind_dir != null ? parseFloat(attrs.wind_dir) : (stWindDir ? parseFloat(stWindDir.state) : null));
  const windGust = attrs.rafales != null ? parseFloat(attrs.rafales) : (attrs.wind_gust != null ? parseFloat(attrs.wind_gust) : (stWindGust ? parseFloat(stWindGust.state) : null));

  // Couleur principale
  let headerBg = 'linear-gradient(135deg, #1565C0 0%, #1976D2 100%)';
  let statusBadge = '';
  let statusColor = '#42A5F5';

  if (allClosed || code === 'M000') {
    headerBg = 'linear-gradient(135deg, #B71C1C 0%, #D32F2F 100%)';
    statusBadge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
    statusColor = '#ef5350';
  } else if (isEmergency) {
    headerBg = 'linear-gradient(135deg, #E65100 0%, #F57C00 100%)';
    statusBadge = `<span class="psnz-badge psnz-badge--orange">${parsed.type === 'urgence' ? 'URGENCE' : 'TRAVAUX'}</span>`;
    statusColor = '#FFA726';
  } else if (parsed || (stCode && !['unavailable', 'unknown'].includes(stCode.state.toLowerCase()))) {
    statusBadge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';
  }

  // Temps de traversée et embouteillage
  let tpsHtml = '';
  if (tpsSN !== null || tpsSB !== null) {
    const congestionSN = tpsSN !== null ? (tpsSN > 10 ? '🔴' : tpsSN > 7 ? '🟡' : '🟢') : '';
    const congestionSB = tpsSB !== null ? (tpsSB > 10 ? '🔴' : tpsSB > 7 ? '🟡' : '🟢') : '';
    tpsHtml = `
      <div class="psnz-row psnz-row--times">
        ${tpsSN !== null ? `<div class="psnz-time-item">
          <span class="psnz-time-label">⬇ St-Naz→St-Brévin</span>
          <span class="psnz-time-val">${congestionSN} ${Math.round(tpsSN)} min</span>
        </div>` : ''}
        ${tpsSB !== null ? `<div class="psnz-time-item">
          <span class="psnz-time-label">⬆ St-Brévin→St-Naz</span>
          <span class="psnz-time-val">${congestionSB} ${Math.round(tpsSB)} min</span>
        </div>` : ''}
      </div>`;
  }

  // SVG voies
  let svgHtml = '';
  if (parsed && parsed.lanes) {
    svgHtml = renderLaneSVG(parsed.lanes, allClosed);
  } else if (!code || code === 'unavailable' || code === 'unknown') {
    svgHtml = `<div class="psnz-unavail">⚠️ Données indisponibles</div>`;
  }

  // Prévision prochaine
  let nextHtml = '';
  if (nextLib || nextCode) {
    const nextParsed = parseBridgeCode(nextCode);
    const nextAllClosed = nextParsed ? nextParsed.allClosed : false;
    const nextIcon = nextAllClosed ? '🔴' : '🔵';
    nextHtml = `
      <div class="psnz-next">
        <div class="psnz-next-title">📅 Prochaine évolution</div>
        <div class="psnz-next-body">
          ${nextIcon} ${nextLib || nextCode || '—'}
          ${nextFrom ? `<br><span class="psnz-next-from">⏰ ${formatTime(nextFrom)}</span>` : ''}
        </div>
      </div>`;
  }

  // Vent
  let windHtml = '';
  if (windSpeed !== null && !isNaN(windSpeed)) {
    const kmh = Math.round(windSpeed);
    const bft = beaufortScale(kmh);
    const alert = windAlert(kmh);
    const dirLabel = windDirection(windDir);
    const gustHtml = windGust !== null && !isNaN(windGust) ? ` (rafales ${Math.round(windGust)} km/h)` : '';
    const alertHtml = alert ? `<div class="psnz-wind-alert psnz-wind-alert--${alert.level}">${alert.msg}</div>` : '';
    windHtml = `
      <div class="psnz-wind">
        <div class="psnz-wind-header">💨 Vent au sommet du pont</div>
        <div class="psnz-wind-body">
          <span class="psnz-wind-speed">${kmh} km/h</span>
          <span class="psnz-wind-detail"> Bft ${bft} · ${dirLabel}${gustHtml}</span>
        </div>
        ${alertHtml}
      </div>`;
  }

  return `
    <div class="psnz-card psnz-card--stnaz" data-entity="${entityCode}" style="background:${headerBg}">
      <div class="psnz-card-header">
        <div class="psnz-card-title">
          <span class="psnz-icon">🌉</span>
          <span>Pont de Saint-Nazaire</span>
        </div>
        ${statusBadge}
      </div>
      <div class="psnz-lib">${lib || '—'}</div>
      ${svgHtml}
      ${tpsHtml}
      ${windHtml}
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
  const isOpen = !isClosed && !isImminent;

  let bgGrad = 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)';
  let badge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';
  let icon = '🟢';
  if (isClosed) {
    bgGrad = 'linear-gradient(135deg, #B71C1C 0%, #C62828 100%)';
    badge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
    icon = '🔴';
  } else if (isImminent) {
    bgGrad = 'linear-gradient(135deg, #E65100 0%, #EF6C00 100%)';
    badge = `<span class="psnz-badge psnz-badge--orange">⚠️ ${minutesLeft ? `Ferme dans ${minutesLeft} min` : 'Fermeture imminente'}</span>`;
    icon = '🟠';
  }

  // Dernière fermeture/ouverture
  let historyHtml = '';
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

  // Prochain événement
  let nextHtml = '';
  if (nextEvent || nextEventTime) {
    nextHtml = `<div class="psnz-history psnz-history--next">
      <span class="psnz-history-label">📅 Prochain :</span>
      <span class="psnz-history-val">${nextEvent || ''} ${nextEventTime ? formatTime(nextEventTime) : ''}</span>
    </div>`;
  }

  return `
    <div class="psnz-card psnz-card--port" data-entity="${entityId}" style="background:${bgGrad}">
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

// ─── Styles CSS ───────────────────────────────────────────────────────────────

const CARD_STYLES = `
  :host { display: block; }

  .psnz-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 14px;
    font-family: 'Inter', 'Roboto', sans-serif;
  }

  .psnz-card {
    border-radius: 14px;
    padding: 14px 16px;
    color: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.28);
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    overflow: hidden;
    position: relative;
  }
  .psnz-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.38);
  }
  .psnz-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: rgba(255,255,255,0.25);
  }

  .psnz-card--missing {
    background: linear-gradient(135deg, #37474F 0%, #455A64 100%);
    cursor: default;
  }
  .psnz-missing-label { font-size: 0.85em; opacity: 0.8; }

  .psnz-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .psnz-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1em;
    font-weight: 700;
    letter-spacing: 0.2px;
  }
  .psnz-icon { font-size: 1.2em; }

  .psnz-badge {
    font-size: 0.72em;
    font-weight: 700;
    letter-spacing: 0.8px;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    white-space: nowrap;
    border: 1.5px solid rgba(255,255,255,0.35);
    background: rgba(0,0,0,0.22);
  }
  .psnz-badge--green { border-color: #A5D6A7; }
  .psnz-badge--red { border-color: #EF9A9A; }
  .psnz-badge--orange { border-color: #FFCC80; }

  .psnz-lib {
    font-size: 0.82em;
    opacity: 0.85;
    margin-bottom: 4px;
    font-style: italic;
  }

  /* SVG voies */
  .psnz-unavail {
    text-align: center;
    font-size: 0.8em;
    opacity: 0.7;
    padding: 6px 0;
  }

  /* Temps de traversée */
  .psnz-row--times {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.18);
  }
  .psnz-time-item {
    flex: 1;
    min-width: 120px;
    background: rgba(0,0,0,0.18);
    border-radius: 8px;
    padding: 6px 10px;
  }
  .psnz-time-label {
    display: block;
    font-size: 0.72em;
    opacity: 0.75;
    margin-bottom: 2px;
  }
  .psnz-time-val {
    font-size: 1.05em;
    font-weight: 700;
  }

  /* Vent */
  .psnz-wind {
    margin-top: 10px;
    padding: 8px 10px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    border-top: 1px solid rgba(255,255,255,0.15);
  }
  .psnz-wind-header {
    font-size: 0.75em;
    opacity: 0.75;
    margin-bottom: 4px;
  }
  .psnz-wind-body { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .psnz-wind-speed { font-size: 1.1em; font-weight: 700; }
  .psnz-wind-detail { font-size: 0.78em; opacity: 0.8; }
  .psnz-wind-alert {
    margin-top: 5px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.8em;
    font-weight: 600;
  }
  .psnz-wind-alert--critical { background: rgba(183,28,28,0.6); }
  .psnz-wind-alert--warning { background: rgba(230,81,0,0.6); }
  .psnz-wind-alert--caution { background: rgba(0,0,0,0.25); }

  /* Prévisions */
  .psnz-next {
    margin-top: 8px;
    padding: 7px 10px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
  }
  .psnz-next-title { font-size: 0.72em; opacity: 0.7; margin-bottom: 3px; }
  .psnz-next-body { font-size: 0.85em; font-weight: 600; }
  .psnz-next-from { font-size: 0.8em; font-weight: 400; opacity: 0.8; }

  /* Historique */
  .psnz-history {
    margin-top: 6px;
    font-size: 0.78em;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .psnz-history--next { margin-top: 3px; }
  .psnz-history-label { opacity: 0.7; }
  .psnz-history-val { font-weight: 600; }

  /* Titre de section */
  .psnz-section-title {
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--secondary-text-color);
    padding: 4px 2px 2px;
    opacity: 0.75;
  }

  /* Dernière MAJ */
  .psnz-footer {
    text-align: right;
    font-size: 0.68em;
    color: var(--secondary-text-color);
    opacity: 0.6;
    padding: 2px 2px 0;
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
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
  description: 'Statut temps réel des ponts du Port et du Pont de Saint-Nazaire. Sens de circulation SVG, temps de traversée, vent, prévisions.',
  preview: true,
  documentationURL: 'https://github.com/Zeeod/statut-pont-port-saint-nazaire',
};
if (existingIdx >= 0) window.customCards[existingIdx] = cardDef;
else window.customCards.push(cardDef);