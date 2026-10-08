/**
 * Carte Lovelace - Ponts de Saint-Nazaire
 * Version 2.2 - Design moderne, voies fluides, affichage du vent et temps de trajet
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

function laneStatus(val) {
  if (val === 0) return 'closed';
  if (val === 1) return 'stnaz'; // St-Nazaire → St-Brévin (Sud)
  if (val === 2) return 'stbrevin'; // St-Brévin → St-Nazaire (Nord)
  return 'unknown';
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

// ─── Rendu Moderne des Voies ──────────────────────────────────────────────────

function renderModernLanes(lanes, allClosed) {
  if (!lanes || lanes.length !== 3) return '';

  const laneItems = lanes.map((val, idx) => {
    const status = allClosed ? 'closed' : laneStatus(val);
    let bgClass = 'psnz-lane--closed';
    let icon = '❌';
    let dirText = 'Fermée';

    if (status === 'stnaz') {
      bgClass = 'psnz-lane--stnaz';
      icon = '⬇';
      dirText = 'Vers St-Brévin';
    } else if (status === 'stbrevin') {
      bgClass = 'psnz-lane--stbrevin';
      icon = '⬆';
      dirText = 'Vers St-Nazaire';
    }

    return `
      <div class="psnz-lane-col ${bgClass}">
        <div class="psnz-lane-tag">Voie ${idx + 1}</div>
        <div class="psnz-lane-arrow">${icon}</div>
        <div class="psnz-lane-dir">${dirText}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="psnz-lanes-wrapper">
      <div class="psnz-lanes-header">
        <span>← Sens St-Nazaire</span>
        <span>Sens St-Brévin →</span>
      </div>
      <div class="psnz-lanes-row">
        ${laneItems}
      </div>
    </div>
  `;
}

// ─── Rendu Pont de Saint-Nazaire ─────────────────────────────────────────────

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
  
  // Recherche intelligente du capteur de vent
  let entityWind = config.entity_wind || 'sensor.vent_pont_saint_nazaire';
  let stWind = hass.states[entityWind];
  if (!stWind) {
    // Essayer d'autres noms courants
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

  // Extraction souple des attributs
  const attrs = stCode ? (stCode.attributes || {}) : {};
  const rawCode = attrs.code_current_mode || attrs.code_mode || (stCode ? stCode.state : null);
  const code = rawCode && rawCode !== 'unavailable' && rawCode !== 'unknown' ? rawCode : null;
  const lib = attrs.lib_current_mode || attrs.voies_ouvertes || (stLib ? stLib.state : null) || (code && !code.startsWith('M') ? code : (code || ''));
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

  // Couleur principale
  let headerBg = 'linear-gradient(135deg, #1976D2 0%, #0D47A1 100%)';
  let statusBadge = '';

  if (allClosed || code === 'M000') {
    headerBg = 'linear-gradient(135deg, #C62828 0%, #8E0000 100%)';
    statusBadge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
  } else if (isEmergency) {
    headerBg = 'linear-gradient(135deg, #EF6C00 0%, #E65100 100%)';
    statusBadge = `<span class="psnz-badge psnz-badge--orange">${parsed.type === 'urgence' ? 'URGENCE' : 'TRAVAUX'}</span>`;
  } else if (parsed || (stCode && !['unavailable', 'unknown'].includes(stCode.state.toLowerCase()))) {
    statusBadge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';
  }

  // Rendu des Voies
  let lanesHtml = '';
  if (parsed && parsed.lanes) {
    lanesHtml = renderModernLanes(parsed.lanes, allClosed);
  } else if (stCode && ['ouvert', 'open'].includes((stCode.state || '').toLowerCase())) {
    lanesHtml = `<div class="psnz-simple-status">🟢 Pont ouvert à la circulation</div>`;
  } else if (!code || code === 'unavailable' || code === 'unknown' || !stCode) {
    lanesHtml = `<div class="psnz-unavail">⚠️ Données indisponibles</div>`;
  }

  // Blocs Métriques (Temps de traversée + Vent)
  let metricsList = [];

  if (tpsSN !== null && !isNaN(tpsSN)) {
    const isHeavy = tpsSN > 10;
    const isMedium = tpsSN > 7;
    const dot = isHeavy ? '🔴' : isMedium ? '🟡' : '🟢';
    metricsList.push(`
      <div class="psnz-metric-card">
        <div class="psnz-metric-label">St-Naz ➔ St-Brévin</div>
        <div class="psnz-metric-value">${dot} <strong>${Math.round(tpsSN)}</strong> min</div>
      </div>
    `);
  }

  if (tpsSB !== null && !isNaN(tpsSB)) {
    const isHeavy = tpsSB > 10;
    const isMedium = tpsSB > 7;
    const dot = isHeavy ? '🔴' : isMedium ? '🟡' : '🟢';
    metricsList.push(`
      <div class="psnz-metric-card">
        <div class="psnz-metric-label">St-Brévin ➔ St-Naz</div>
        <div class="psnz-metric-value">${dot} <strong>${Math.round(tpsSB)}</strong> min</div>
      </div>
    `);
  }

  if (windSpeed !== null && !isNaN(windSpeed)) {
    const kmh = Math.round(windSpeed);
    const dirStr = windDirection(windDir);
    const gustStr = (windGust !== null && !isNaN(windGust)) ? ` · Raf. ${Math.round(windGust)}` : '';
    const alert = windAlert(kmh);
    metricsList.push(`
      <div class="psnz-metric-card ${alert ? 'psnz-metric-card--alert' : ''}">
        <div class="psnz-metric-label">💨 Vent direct</div>
        <div class="psnz-metric-value"><strong>${kmh}</strong> km/h <span class="psnz-metric-sub">${dirStr}${gustStr}</span></div>
      </div>
    `);
  }

  const metricsHtml = metricsList.length > 0 ? `
    <div class="psnz-metrics-grid">
      ${metricsList.join('')}
    </div>
  ` : '';

  // Alerte vent spécifique
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
    const nextIcon = nextAllClosed ? '🔴' : '🔵';
    nextHtml = `
      <div class="psnz-next">
        <div class="psnz-next-title">📅 Prochaine évolution</div>
        <div class="psnz-next-body">
          ${nextIcon} ${nextLib || nextCode || '—'}
          ${nextFrom ? `<span class="psnz-next-from">⏰ ${formatTime(nextFrom)}</span>` : ''}
        </div>
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
      ${lib ? `<div class="psnz-lib">${lib}</div>` : ''}
      ${lanesHtml}
      ${metricsHtml}
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

  let bgGrad = 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)';
  let badge = '<span class="psnz-badge psnz-badge--green">OUVERT</span>';

  if (isUnavailable) {
    bgGrad = 'linear-gradient(135deg, #424242 0%, #303030 100%)';
    badge = '<span class="psnz-badge" style="border-color:#9E9E9E;">INDISPONIBLE</span>';
  } else if (isClosed) {
    bgGrad = 'linear-gradient(135deg, #C62828 0%, #8E0000 100%)';
    badge = '<span class="psnz-badge psnz-badge--red">FERMÉ</span>';
  } else if (isImminent) {
    bgGrad = 'linear-gradient(135deg, #EF6C00 0%, #E65100 100%)';
    badge = `<span class="psnz-badge psnz-badge--orange">⚠️ ${minutesLeft ? `Ferme dans ${minutesLeft} min` : 'Fermeture < 15 min'}</span>`;
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

// ─── Styles CSS Modernes ───────────────────────────────────────────────────────

const CARD_STYLES = `
  :host { display: block; }

  .psnz-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .psnz-card {
    border-radius: 16px;
    padding: 16px 18px;
    color: #ffffff;
    box-shadow: 0 4px 18px rgba(0,0,0,0.24);
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    overflow: hidden;
    position: relative;
  }
  .psnz-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 26px rgba(0,0,0,0.36);
  }
  .psnz-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: rgba(255,255,255,0.22);
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
    font-size: 1.08em;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .psnz-icon { font-size: 1.25em; }

  .psnz-badge {
    font-size: 0.74em;
    font-weight: 700;
    letter-spacing: 0.8px;
    padding: 4px 12px;
    border-radius: 20px;
    text-transform: uppercase;
    white-space: nowrap;
    border: 1.5px solid rgba(255,255,255,0.4);
    background: rgba(0,0,0,0.25);
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .psnz-badge--green { border-color: #81C784; background: rgba(46, 125, 50, 0.4); }
  .psnz-badge--red { border-color: #E57373; background: rgba(198, 40, 40, 0.4); }
  .psnz-badge--orange { border-color: #FFB74D; background: rgba(239, 108, 0, 0.4); }

  .psnz-lib {
    font-size: 0.86em;
    opacity: 0.92;
    margin-bottom: 12px;
    font-weight: 500;
  }

  /* Rendu moderne des 3 voies */
  .psnz-lanes-wrapper {
    background: rgba(0, 0, 0, 0.22);
    border-radius: 12px;
    padding: 10px 12px 12px;
    margin-bottom: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .psnz-lanes-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.72em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.75;
    margin-bottom: 8px;
  }
  .psnz-lanes-row {
    display: flex;
    gap: 10px;
  }
  .psnz-lane-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 6px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform 0.15s ease;
  }
  .psnz-lane-col:hover {
    transform: translateY(-2px);
  }
  .psnz-lane--stnaz {
    background: linear-gradient(180deg, #1E88E5 0%, #1565C0 100%);
    border: 1px solid rgba(255,255,255,0.25);
  }
  .psnz-lane--stbrevin {
    background: linear-gradient(180deg, #FB8C00 0%, #EF6C00 100%);
    border: 1px solid rgba(255,255,255,0.25);
  }
  .psnz-lane--closed {
    background: linear-gradient(180deg, #424242 0%, #263238 100%);
    border: 1px solid rgba(244,67,54,0.4);
    opacity: 0.85;
  }
  .psnz-lane-tag {
    font-size: 0.72em;
    font-weight: 700;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .psnz-lane-arrow {
    font-size: 1.4em;
    line-height: 1;
    margin: 4px 0;
  }
  .psnz-lane-dir {
    font-size: 0.74em;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
  }

  /* Grille des métriques (Temps + Vent) */
  .psnz-metrics-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .psnz-metric-card {
    flex: 1;
    min-width: 100px;
    background: rgba(0, 0, 0, 0.22);
    border-radius: 10px;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .psnz-metric-card--alert {
    border-color: rgba(255, 183, 77, 0.6);
    background: rgba(230, 81, 0, 0.25);
  }
  .psnz-metric-label {
    font-size: 0.72em;
    opacity: 0.75;
    margin-bottom: 3px;
    font-weight: 500;
  }
  .psnz-metric-value {
    font-size: 0.95em;
    font-weight: 600;
  }
  .psnz-metric-value strong {
    font-size: 1.15em;
  }
  .psnz-metric-sub {
    font-size: 0.8em;
    opacity: 0.8;
    font-weight: normal;
  }

  /* Alerte vent */
  .psnz-wind-alert {
    margin-top: 10px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.82em;
    font-weight: 600;
  }
  .psnz-wind-alert--critical { background: rgba(183,28,28,0.7); border: 1px solid #FF5252; }
  .psnz-wind-alert--warning { background: rgba(230,81,0,0.7); border: 1px solid #FFB74D; }
  .psnz-wind-alert--caution { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); }

  /* Prévisions */
  .psnz-next {
    margin-top: 10px;
    padding: 8px 12px;
    background: rgba(0,0,0,0.22);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .psnz-next-title { font-size: 0.72em; opacity: 0.75; margin-bottom: 3px; font-weight: 600; }
  .psnz-next-body { font-size: 0.86em; font-weight: 600; }
  .psnz-next-from { font-size: 0.82em; font-weight: 400; opacity: 0.85; margin-left: 6px; }

  /* Historique */
  .psnz-history {
    margin-top: 6px;
    font-size: 0.8em;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .psnz-history--next { margin-top: 3px; }
  .psnz-history-label { opacity: 0.75; font-weight: 400; }
  .psnz-history-val { font-weight: 600; }

  /* Titre de section */
  .psnz-section-title {
    font-size: 0.74em;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--secondary-text-color, #8e8e93);
    padding: 4px 4px 2px;
    opacity: 0.85;
  }

  /* Dernière MAJ */
  .psnz-footer {
    text-align: right;
    font-size: 0.7em;
    color: var(--secondary-text-color, #8e8e93);
    opacity: 0.7;
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
  description: 'Statut temps réel des ponts du Port et du Pont de Saint-Nazaire. Sens de circulation moderne, temps de traversée, vent en direct.',
  preview: true,
  documentationURL: 'https://github.com/Zeeod/statut-pont-port-saint-nazaire',
};
if (existingIdx >= 0) window.customCards[existingIdx] = cardDef;
else window.customCards.push(cardDef);