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
      const modeCirculation = stateObj.attributes.mode_circulation;

      let bgColor = '#4CAF50'; // Vert (Ouvert / Normal)
      let statusText = 'Ouvert';
      let subDetail = '';

      // Gestion spécifique du Grand Pont (avec voies réversibles / vent)
      if (entityId.includes('grand_pont')) {
        if (state === 'ferme' || state === 'closed') {
          bgColor = '#F44336';
          statusText = 'Pont Fermé (Vent fort)';
        } else if (state === 'alerte' || state === 'restreint') {
          bgColor = '#FF9800';
          statusText = 'Circulation Restreinte';
        } else {
          statusText = modeCirculation || 'Circulation normale';
        }

        if (voiesOuvertes) {
          subDetail = `<div style="font-size: 0.78em; opacity: 0.9; margin-top: 4px; font-weight: 400;">🚗 ${voiesOuvertes}</div>`;
        }
      } 
      // Gestion des ponts mobiles du port
      else {
        if (state === 'ferme' || state === 'closed' || state === 'off' || state === 'fermé') {
          bgColor = '#F44336'; // Rouge
          statusText = 'Fermé';
        } else if (state === 'fermeture_imminente' || (minutesLeft !== undefined && minutesLeft !== null && minutesLeft <= 15)) {
          bgColor = '#FF9800'; // Orange
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

    // Rendre chaque carte cliquable pour ouvrir l'historique de l'entité
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

  // Permet à Home Assistant de reconnaître l'éditeur visuel
  static getConfigElement() {
    return document.createElement('statut-pont-port-saint-nazaire-card-editor');
  }

  static getStubConfig() {
    return {
      title: "Ponts de Saint-Nazaire",
      entities: [
        "sensor.pont_du_pertuis",
        "sensor.pont_joubert",
        "sensor.pont_ecluse_est",
        "sensor.pont_sud_amont",
        "sensor.pont_sud_aval",
        "sensor.grand_pont_saint_nazaire"
      ]
    };
  }

  getCardSize() {
    return (this.config.entities || []).length || 1;
  }
}

// Classe de l'éditeur visuel pour l'interface graphique Home Assistant
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
  description: "Affiche l'état en temps réel des ponts du port et du Grand Pont de Saint-Nazaire (sens de circulation, voies ouvertes, historique).",
  preview: true,
});