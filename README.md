# PartyParty

Ett partyspel för soffan. TV:n visar spelet, alla spelar med sin egen mobil och tävlar mot varandra i hushållet. Ingen app behövs, allt körs i webbläsaren.

## Så spelar man

1. Öppna sidan på TV:n eller en dator kopplad till TV:n (eller casta fliken).
2. Alla skannar QR-koden med mobilen, skriver sitt namn, väljer en figur (varje figur kan bara väljas av en spelare) och trycker **Jag är redo**.
3. Spelet startar när alla är redo (minst 2, max 10 spelare).

Alla börjar på 0. I vanliga omgångar får man **placeringspoäng**: sist får 100 och varje plats uppåt ger 100 till. Med 6 spelare blir det 600, 500, 400, 300, 200 och 100. I Ordningen och Höger eller vänster avgör antal rätt alltid före snabbhet; tiden räknas bara mellan dem med lika många rätt. Delad placering delar på poängen. Efter varje omgång visar TV:n en topplista med allas svar och totalpoäng.

I **finalen** satsar man före varje fråga, från 0 till allt man har. Alla rankas efter frågan, rätt svar först och sedan efter snabbhet. Etta får satsningen ×2 och sist ×0, med en jämn skala däremellan (med 6 spelare ×2, ×1,6, ×1,2, ×0,8, ×0,4, ×0). Fel svar förlorar alltid hela satsningen. Står man på 0 när det är dags att satsa får man 50 poäng att spela med.

| Del | Omgångar | Vad man gör |
| --- | --- | --- |
| Uppvärmning | 1 | En fråga utan poäng, så att alla lär sig mobilen |
| Skissen | 3 | En känd plats ritas upp streck för streck. Sätt en nål på världskartan. Poäng efter avstånd och hur tidigt man låste |
| Ordningen | 3 | Sortera fem uppfinningar från äldst till nyast |
| Mellan 0–1000 | 3 | Svaret ligger alltid mellan 0 och 1000. Dra reglaget, närmast vinner |
| Pusslet | 1 | Klassiskt pussel med 9 rutor, en tom. Alla får samma bild och samma blandning. Snabbast löst vinner, hinner ingen vinner flest brickor på rätt plats |
| Höger eller vänster | 1 | 20 ord på 30 sekunder. Flest rätt vinner. Fel svar skakar och spärrar en sekund |
| Kingen | en per spelare | Alla blir kingen en gång. Kingen skriver det hen tror att någon annan skriver: +100 per träff. De som skrev samma får −100, alla andra +100. Svar som inte är exakt samma röstar alla om |
| Finalen | 5 | Jeopardy-stil: se kategorin, satsa, svara snabbt och rätt |

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
- `king.js`: uppmaningar till Kingen
- `puzzles.js`: bilder till Pusslet, ritade som SVG i en ruta på 300 × 300

## Struktur

```
server/index.js    webbserver och Socket.IO
server/game.js     spelrummet och alla faser
server/scoring.js  poängräkning
public/            TV-vy (tv.html) och mobilvy (play.html)
content/           frågor och skisser
test/simulate.js   helt parti med botar
```

Världskartan ritas från [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, fri att använda) som följer med appen. Den behöver ingen nyckel och inget konto.
