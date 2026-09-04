class StatutPontPortSaintNazaireCard extends HTMLElement {
  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error("Veuillez définir une liste d'entités (entities).");
    }
    this.config = config;
  }

  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `
        <ha-card header="${this.config.title || 'Ponts du Port de Saint-Nazaire'}">
          <div id="container" style="padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 8px;"></div>
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

      let bgColor = '#4CAF50'; // Vert (Ouvert)
      let statusText = 'Ouvert';

      if (state === 'ferme' || state === 'closed' || state === 'off' || state === 'fermé') {
        bgColor = '#F44336'; // Rouge (Fermé)
        statusText = 'Fermé';
      } else if (state === 'fermeture_imminente' || (minutesLeft !== undefined && minutesLeft !== null && minutesLeft <= 15)) {
        bgColor = '#FF9800'; // Orange (< 15 min)
        statusText = minutesLeft ? `Ferme dans ${minutesLeft} min` : 'Fermeture < 15 min';
      }

      return `
        <div style="
          background-color: ${bgColor};
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
          transition: background-color 0.3s ease;
        ">
          <span style="font-size: 1em;">${friendlyName}</span>
          <span style="
            background: rgba(0, 0, 0, 0.25);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.85em;
            letter-spacing: 0.3px;
          ">${statusText}</span>
        </div>
      `;
    }).join('');
  }

  getCardSize() {
    return (this.config.entities || []).length || 1;
  }
}

customElements.define('statut-pont-port-saint-nazaire-card', StatutPontPortSaintNazaireCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "statut-pont-port-saint-nazaire-card",
  name: "Carte Statut Pont Port Saint-Nazaire",
  description: "Affiche l'état des ponts du port de Saint-Nazaire entité par entité avec couleur dynamique."
});