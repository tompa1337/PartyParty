# PartyParty

Ett partyspel för soffan. TV:n visar spelet, alla spelar med sin egen mobil och tävlar mot varandra i hushållet. Ingen app behövs, allt körs i webbläsaren.

## Så spelar man

1. Öppna sidan på TV:n eller en dator kopplad till TV:n (eller casta fliken).
2. Alla skannar QR-koden med mobilen, skriver sitt namn och trycker **Jag är redo**.
3. Spelet startar när alla är redo (minst 2, max 10 spelare).

Alla börjar med **1 000 poäng**. Före varje omgång satsar man poäng (minst 10 % av det man har). Efter omgången rankas spelarna: bäst får satsningen ×2, sist får ×0 och övriga en jämn skala däremellan. Delad placering delar på multiplikatorerna.

| Del | Omgångar | Vad man gör |
| --- | --- | --- |
| Uppvärmning | 1 | En fråga utan poäng, så att alla lär sig mobilen |
| Skissen | 3 | En känd plats ritas upp streck för streck. Sätt en nål på världskartan. Poäng efter avstånd och hur tidigt man låste |
| Ordningen | 1 | Sortera fem uppfinningar från äldst till nyast |
| Närmast vinner | 3 | Svaret ligger alltid mellan 0 och 1000. Dra reglaget, närmast vinner |
| Höger eller vänster | 1 | 20 ord på 30 sekunder. Swipa åt rätt kategori. Fel svar skakar och spärrar en sekund |
| Finalen | 5 | Jeopardy-stil: se kategorin, satsa 0–200, rätt ger poängen och fel tar dem |

På TV:n går man vidare med **Enter**, mellanslag eller knappen Nästa. Annars går spelet vidare när alla tryckt Nästa i mobilen.

## Köra lokalt

```bash
npm install
npm start          # http://localhost:3000
npm test           # spelar ett helt parti med botar
```

`TIME_SCALE=0.5 npm start` kör alla tidsgränser dubbelt så snabbt, praktiskt när man testar.

För att testa med mobilen hemma: öppna TV-sidan via datorns IP-adress (till exempel `http://192.168.1.20:3000`) så att QR-koden pekar rätt.

## Köra på Railway

1. Skapa ett nytt projekt i Railway: **Deploy from GitHub repo** och välj `PartyParty`.
2. Railway känner igen Node-appen och kör `npm start`. Inga miljövariabler behövs, porten sätts automatiskt.
3. Under **Settings → Networking**, klicka **Generate Domain** så får du en adress.
4. Öppna adressen på TV:n. QR-koden pekar automatiskt på samma adress.

Allt spelläge ligger i minnet på servern, så kör bara **en** instans. Pågående spel försvinner om servern startas om.

## Innehåll

Allt innehåll ligger i `content/` och är lätt att bygga ut:

- `landmarks.js`: skisserna som SVG-streck i en ruta på 400 × 300, i den ordning de ritas
- `inventions.js`: uppfinningar med årtal och vad årtalet syftar på
- `narmast.js`: frågor med svar mellan 0 och 1000
- `swipe.js`: kategoripar med ord
- `final.js`: finalfrågor med kategori och fyra alternativ
- `warmup.js`: uppvärmningsfrågor

## Struktur

```
server/index.js    webbserver och Socket.IO
server/game.js     spelrummet och alla faser
server/scoring.js  poängräkning
public/            TV-vy (tv.html) och mobilvy (play.html)
content/           frågor och skisser
test/simulate.js   helt parti med botar
```

Kartan använder kartbilder från CARTO och OpenStreetMap. De är gratis för mindre användning; vid större trafik behövs ett eget kartkonto.
