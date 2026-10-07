# 🌉 Statut Ponts de Saint-Nazaire — Home Assistant

Carte Lovelace personnalisée pour Home Assistant affichant en **temps réel** :
- L'état du **Pont de Saint-Nazaire** (sens de circulation des 3 voies, temps de traversée, prévisions, vent)
- L'état des **ponts mobiles du Port** (Pertuis, Joubert, écluses)

---

## 📸 Aperçu

La carte affiche pour le Pont de Saint-Nazaire :
- **Schéma SVG** des 3 voies avec flèches de sens de circulation (bleu = St-Naz→St-Brévin, orange = St-Brévin→St-Naz, croix = fermée)
- **Temps de traversée en temps réel** avec indicateur de congestion (🟢 / 🟡 / 🔴)
- **Vent** : vitesse, direction, rafales + alertes automatiques (> 80 km/h, > 120 km/h)
- **Prochaine évolution** : code + libellé + heure du prochain changement de configuration
- **Alerte bouchons** intégrée

Pour chaque pont du port :
- Statut ouvert/fermé/fermeture imminente avec code couleur
- Heure de la dernière ouverture ou fermeture
- Prochain événement prévu

---

## 📡 Sources de données

| Donnée | Source | Fréquence | Clé API requise |
|--------|--------|-----------|-----------------|
| Sens de circulation & temps de traversée Pont St-Naz | [data.loire-atlantique.fr](https://data.loire-atlantique.fr) — Open Data officiel | Toutes les 2 min | ❌ Aucune |
| Vent sur le pont | [Open-Meteo.com](https://open-meteo.com) — Modèle météo libre | Toutes les 10 min | ❌ Aucune |
| Ponts du port (Pertuis, Joubert, écluses) | Saisie manuelle via helpers HA (app "À bon port") | Manuel | ❌ Aucune |

> **Note :** Le Grand Port Maritime de Nantes Saint-Nazaire ne dispose pas d'API publique pour les ponts du port. La mise à jour se fait manuellement ou via les notifications de l'app officielle [À bon port](https://play.google.com/store/apps/details?id=com.citykomi.port).

---

## 🚀 Installation

### Méthode 1 — Via HACS (recommandée)

1. Dans HACS → **Dépôts personnalisés**
2. Ajoutez `https://github.com/Zeeod/statut-pont-port-saint-nazaire` → Catégorie : **Lovelace**
3. Cliquez sur **Télécharger**
4. Redémarrez Home Assistant

### Méthode 2 — Installation manuelle

1. Copiez `statut-pont-port-saint-nazaire.js` dans votre dossier `config/www/`
2. Dans HA → **Paramètres → Tableau de bord → Ressources**
3. Ajoutez `/local/statut-pont-port-saint-nazaire.js` (type : Module JavaScript)
4. Rechargez la page

---

## ⚙️ Configuration Home Assistant

### Étape 1 — Ajouter les capteurs REST (Pont de St-Nazaire + vent)

Copiez le contenu du fichier `home_assistant_config.yaml` dans votre `configuration.yaml`.

**Option recommandée — Fichiers séparés :**

```yaml
# configuration.yaml
rest: !include ponts_rest.yaml
template: !include ponts_template.yaml
input_select: !include ponts_input_select.yaml
input_text: !include ponts_input_text.yaml
automation: !include ponts_automations.yaml
```

**Option simple — Tout dans configuration.yaml :**

Copiez les sections `rest:`, `template:`, `input_select:`, `input_text:` et `automation:` du fichier `home_assistant_config.yaml` directement dans votre `configuration.yaml`.

> ⚠️ Si vous avez déjà une section `rest:` dans votre config, ajoutez les nouvelles entrées **sous** la liste existante (ne pas dupliquer la clé).

### Étape 2 — Redémarrer Home Assistant

```
Paramètres → Système → Redémarrer
```

### Étape 3 — Vérifier les entités

Dans **Outils de développement → États**, vérifiez que ces entités existent :

| Entité | Valeur attendue |
|--------|-----------------|
| `sensor.pont_saint_nazaire_code` | ex: `M112` |
| `sensor.pont_saint_nazaire_libelle` | ex: `2 voies sens Saint-Nazaire - Saint-Brevin` |
| `sensor.pont_saint_nazaire_temps_vers_st_brevin` | ex: `6` |
| `sensor.pont_saint_nazaire_prochaine_code` | ex: `M102` |
| `sensor.pont_saint_nazaire_vent_vitesse` | ex: `23.5` |

### Étape 4 — Créer les helpers pour les ponts du port

Via l'interface HA (**Paramètres → Appareils → Helpers → + Créer**) :

Créez un **input_select** pour chaque pont :

| Helper | Options |
|--------|---------|
| `input_select.pont_pertuis_etat` | `ouvert`, `fermé`, `fermeture_imminente`, `inconnu` |
| `input_select.pont_joubert_etat` | `ouvert`, `fermé`, `fermeture_imminente`, `inconnu` |
| `input_select.pont_ecluse_est_etat` | `ouvert`, `fermé`, `fermeture_imminente`, `inconnu` |
| `input_select.pont_ecluse_sud_basc_etat` | `ouvert`, `fermé`, `fermeture_imminente`, `inconnu` |
| `input_select.pont_ecluse_sud_turn_etat` | `ouvert`, `fermé`, `fermeture_imminente`, `inconnu` |

Créez des **input_text** pour l'historique :

| Helper | Rôle |
|--------|------|
| `input_text.pont_pertuis_last_state` | Dernier état (ex: `ouvert`) |
| `input_text.pont_pertuis_last_time` | Heure du changement (ex: `2024-01-15T08:30:00`) |
| `input_text.pont_pertuis_next_event` | Prochain événement (ex: `Entrée navire`) |
| `input_text.pont_pertuis_next_time` | Heure du prochain événement |
| *(Même chose pour joubert et ecluse_est)* | |

---

## 📊 Ajouter la carte au dashboard

### Via l'éditeur visuel

1. Éditez votre dashboard → **+ Ajouter une carte**
2. Cherchez **Carte Ponts Saint-Nazaire** dans la liste
3. Configurez via l'UI

### Via l'éditeur YAML (recommandé pour le contrôle total)

```yaml
type: custom:statut-pont-port-saint-nazaire-card
title: "🌉 Ponts de Saint-Nazaire"
show_st_nazaire_bridge: true
show_port_bridges: true

# Entités du Pont de Saint-Nazaire (auto-créées par la config REST)
entity_pont_st_naz: sensor.pont_saint_nazaire_code
entity_pont_st_naz_lib: sensor.pont_saint_nazaire_libelle
entity_pont_tps_sn: sensor.pont_saint_nazaire_temps_vers_st_brevin
entity_pont_tps_sb: sensor.pont_saint_nazaire_temps_vers_st_nazaire
entity_pont_next_code: sensor.pont_saint_nazaire_prochaine_code
entity_pont_next_lib: sensor.pont_saint_nazaire_prochaine_libelle
entity_pont_next_from: sensor.pont_saint_nazaire_prochaine_depuis
entity_wind: sensor.pont_saint_nazaire_vent_vitesse
entity_wind_dir: sensor.pont_saint_nazaire_vent_direction
entity_wind_gust: sensor.pont_saint_nazaire_vent_rafales

# Entités des ponts du port
port_bridge_entities:
  - sensor.pont_du_pertuis
  - sensor.porte_amont_joubert
  - sensor.pont_tournant_ecluse_est
  - sensor.pont_basculant_ecluse_sud
  - sensor.pont_tournant_ecluse_sud
```

---

## 🗺️ Comprendre les codes de circulation

Le Pont de Saint-Nazaire utilise un format de code **Mxyz** pour ses 3 voies :

| Code | Sens | Description |
|------|------|-------------|
| `0` | ❌ | Voie fermée |
| `1` | 🔵 → | Voie sens **St-Nazaire → St-Brévin** |
| `2` | 🟠 ← | Voie sens **St-Brévin → St-Nazaire** |

**Exemples :**

| Code | Voie 1 | Voie 2 (centrale) | Voie 3 | Situation |
|------|--------|-------------------|--------|-----------|
| `M112` | → SN→SB | → SN→SB | ← SB→SN | 2 voies sortante, 1 entrante |
| `M122` | → SN→SB | ← SB→SN | ← SB→SN | 1 voie sortante, 2 entrantes |
| `M102` | → SN→SB | ❌ fermée | ← SB→SN | Voie centrale fermée (travaux) |
| `M000` | ❌ | ❌ | ❌ | Pont fermé |
| `Mu___` | — | — | — | Situation d'urgence |
| `Me___` | — | — | — | Mode exceptionnel (travaux/accident) |

---

## 🔔 Automations incluses

Les automations du fichier de config font :

1. **Archivage** : Log HA de chaque changement d'état du pont (historique consultable)
2. **Notification fermeture** : Alerte sur votre téléphone si le pont se ferme ou passe en urgence/travaux
3. **Alerte vent** : Notification si le vent dépasse 80 km/h (limite réglementaire)

### Personnaliser les notifications

Remplacez `notify.notify` par votre service de notification :
- Mobile : `notify.mobile_app_<nom_de_votre_telephone>`
- Telegram : `notify.telegram`
- Email : `notify.smtp`

---

## 💨 Règles de circulation liées au vent

| Vent (km/h) | Restriction |
|-------------|-------------|
| < 80 | Circulation normale |
| ≥ 80 | Limite 50 km/h – 2-roues, piétons, remorques interdits |
| ≥ 120 | **Pont fermé à toute circulation** |

Ces alertes sont affichées automatiquement sur la carte.

---

## 🔧 Dépannage

**Les entités n'apparaissent pas après redémarrage :**
- Vérifiez les logs : Paramètres → Système → Journaux → cherchez `sensor.pont_saint_nazaire`
- Vérifiez la syntaxe YAML avec le validateur : Outils de développement → YAML

**Les données ne se mettent pas à jour :**
- Vérifiez la connexion internet de votre HA
- Testez l'URL manuellement : `https://data.loire-atlantique.fr/api/explore/v2.1/catalog/datasets/224400028_tps-de-parcours-et-sens-de-circulation-du-pont-de-saint-nazaire-rt/exports/json`

**La carte n'apparaît pas dans le sélecteur :**
- Vérifiez que la ressource JS est bien chargée (F12 → Console → pas d'erreur 404)
- Videz le cache navigateur (Ctrl+Shift+R)

**Entité "unavailable" :**
- L'API Open Data peut être temporairement indisponible (très rare)
- Le capteur repassera automatiquement en ligne au prochain scan (2 min)

---

## 📝 Historique des versions

### v2.0.0
- ✅ Connexion à l'API Open Data officielle Loire-Atlantique (temps réel)
- ✅ Schéma SVG des 3 voies avec sens de circulation
- ✅ Temps de traversée en temps réel avec indicateur de congestion
- ✅ Vent via Open-Meteo (sans clé API)
- ✅ Prévisions de la prochaine évolution du plan de circulation
- ✅ Historique dernier état pour les ponts du port
- ✅ Automations de notification
- ✅ Shadow DOM pour l'isolation des styles

### v1.0.0
- Version initiale avec entités manuelles

---

## 📄 Licence

Licence ouverte — Etalab 2.0 (même licence que les données open data utilisées)

## 🤝 Contribuer

Issues et Pull Requests bienvenues sur [GitHub](https://github.com/Zeeod/statut-pont-port-saint-nazaire).
