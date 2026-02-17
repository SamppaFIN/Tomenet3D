# 🗡️ TomeNet 3D - Roguelike RPG

**TomeNet 3D** on moderni 3D-toteutus perinteisestä Roguelike-seikkailusta. Peli yhdistää klassisen syvyyden ja satunnaisuuden moderniin kolmiulotteiseen grafiikkaan ja edistyneisiin geometrisiin muotoihin (kuten Gomboc ja Oloid).

---

## 🎮 Pelin ominaisuudet

- **Satunnainen luolasto**: BSP-pohjainen algoritmi luo jokaiselle tasolle uudet huoneet, käytävät ja salaisuudet.
- **Auto-Explore**: Paina `VÄLILYÖNTIÄ`, niin hahmo tutkii luolastoa automaattisesti etsien tuntemattomia alueita.
- **Inventaario & Varusteet**: Hallitse aseita, panssareita ja tarvikkeita painamalla `I`. Varusteiden todelliset ominaisuudet paljastuvat vasta, kun ne puetaan päälle.
- **Edistynyt 3D-grafiikka**: Käyttää Three.js-pohjaista moottoria, jossa hirviöt ja portaalit on visualisoitu eksoottisilla 3D-muodoilla (Oloid/Gomboc).
- **Portaalit**: Löydä mystisiä portaaleja, jotka teleporttaavat sinut uusiin paikkoihin luolastossa.
- **Tutoriaalit**: Interaktiivinen tutoriaalijärjestelmä opastaa uusia pelaajia perusmekaniikoissa.

---

## 🕹️ Ohjaus

| Näppäin | Toiminto |
|---------|----------|
| **W, A, S, D** | Liiku ylös, vasemmalle, alas, oikealle |
| **Välilyönti** | Auto-Explore (Automaattinen tutkinta) |
| **I** | Inventaario (Inventory) |
| **G** | Poimi tavara (Pickup) |
| **X** | Etsi seinistä salaisuuksia |
| **>** | Laskeudu portaissa alaspäin |
| **<** | Nouse portaissa ylöspäin |
| **1, 2, 3...** | Käytä pikavalinnan esineitä (esim. loitsut/juomat) |

---

## 🛠️ Kehityksen tila (Status)

Peli on tällä hetkellä **aktiivisessa kehitysvaiheessa**. Viimeisimmät päivitykset sisältävät:
- ✅ **Auto-Explore**: Täysin toimiva BFS-pohjainen automaattinen tutkinta.
- ✅ **Varusteiden tunnistus**: Esineiden bonukset ja lumoukset (kirotut/lumotut) pysyvät piilossa ensimmäiseen käyttöön asti.
- ✅ **Advanced Shapes**: Hirviöillä on nyt dynaamisia geometrisia muotoja.
- ✅ **Portaalit**: Portaali-tile ja teleportaatiologiikka lisätty.
- ✅ **UI Parannukset**: Uusi inventaariopaneeli ja HUD-päivitykset.

---

## 🚀 Käynnistys

Peli vaatii paikallisen web-palvelimen toimiakseen oikein (esim. Python http.server tai VS Code Live Server).

```bash
# Esimerkki käynnistyksestä Pythonilla:
python -m http.server 8087
```

Avaa sitten selaimessa osoite: `http://localhost:8087`

---

**Kehittäjä**: [SamppaFIN](https://github.com/SamppaFIN)  
**Moottori**: Three.js & Custom Roguelike Engine
