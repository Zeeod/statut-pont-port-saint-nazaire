class StatutPontPortSaintNazaireCard extends HTMLElement {
  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("Veuillez définir une liste d'entités (entities).");
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.content) {
      this.innerHTML = `
        <ha-card header="${this.config.title || 'Ponts de Saint-Nazaire'}">
          <div id="container" style="padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 10px;"></div>
        </ha-card>
      `;
      this.content = this.querySelector('#container');
    }

    const entities = this.config.entities;

    this.content.innerHTML = entities.map(entityId => {
      const stateObj = hass.states[entityId];

      if (!stateObj) {
        return `
          <div style="padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px; font-size: 0.9em; color: var(--secondary-text-color);">
            Entité non trouvée : ${entityId}
          </div>`;
      }

      const friendlyName = stateObj.attributes.friendly_name || entityId;
      const state = (stateObj.state || '').toLowerCase();
      const minutesLeft = stateObj.attributes.minutes_avant_fermeture;
      const voiesOuvertes = stateObj.attributes.voies_ouvertes;
      const tpsStBrevin = stateObj.attributes.temps_vers_st_brevin;
      const tpsStNazaire = stateObj.attributes.temps_vers_st_nazaire;

      let bgColor = '#4CAF50'; // Vert (Ouvert)
      let statusText = 'Ouvert';
      let subDetail = '';

      // Traitement spécifique du Pont de Saint-Nazaire
      if (entityId.includes('pont_de_saint_nazaire')) {
        if (state === 'ferme' || state === 'closed') {
          bgColor = '#F44336';
          statusText = 'Fermé';
        } else {
          statusText = 'Ouvert';
        }

        let times = [];
        if (tpsStNazaire !== undefined && tpsStNazaire !== null) times.push(`📍 St-Nazaire: ${tpsStNazaire} min`);
        if (tpsStBrevin !== undefined && tpsStBrevin !== null) times.push(`📍 St-Brevin: ${tpsStBrevin} min`);

        subDetail = `
          <div style="font-size: 0.8em; opacity: 0.95; margin-top: 6px; font-weight: 400; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px;">
            <div>🚦 ${voiesOuvertes || 'Informations voies indisponibles'}</div>
            ${times.length > 0 ? `<div style="margin-top: 2px;">⏱️ ${times.join(' | ')}</div>` : ''}
          </div>`;
      } 
      // Traitement des ponts du port
      else {
        if (state === 'ferme' || state === 'closed' || state === 'off' || state === 'fermé') {
          bgColor = '#F44336';
          statusText = 'Fermé';
        } else if (state === 'fermeture_imminente' || (minutesLeft !== undefined && minutesLeft !== null && minutesLeft <= 15)) {
          bgColor = '#FF9800';
          statusText = minutesLeft ? `Ferme dans ${minutesLeft} min` : 'Fermeture < 15 min';
        }
      }

      return `
        <div class="bridge-row" data-entity="${entityId}" style="
          background-color: ${bgColor};
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
          transition: transform 0.15s ease, background-color 0.3s ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
            <span style="font-size: 1em;">${friendlyName}</span>
            <span style="
              background: rgba(0, 0, 0, 0.25);
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 0.85em;
              letter-spacing: 0.3px;
            ">${statusText}</span>
          </div>
          ${subDetail}
        </div>
      `;
    }).join('');

    this.content.querySelectorAll('.bridge-row').forEach(element => {
      element.addEventListener('click', () => {
        const entityId = element.getAttribute('data-entity');
        const event = new Event('hass-more-info', {
          bubbles: true,
          composed: true,
        });
        event.detail = { entityId: entityId };
        this.dispatchEvent(event);
      });
    });
  }

  static getConfigElement() {
    return document.createElement('statut-pont-port-saint-nazaire-card-editor');
  }

  getCardSize() {
    return (this.config.entities || []).length || 1;
  }
}

class StatutPontPortSaintNazaireCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }
}

customElements.define('statut-pont-port-saint-nazaire-card-editor', StatutPontPortSaintNazaireCardEditor);
customElements.define('statut-pont-port-saint-nazaire-card', StatutPontPortSaintNazaireCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "statut-pont-port-saint-nazaire-card",
  name: "Carte Statut Ponts Saint-Nazaire",
  description: "Affiche l'état des ponts du port et du Pont de Saint-Nazaire avec sens de circulation et temps de parcours.",
  preview: true,
});