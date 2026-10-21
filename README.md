# Leitwerk – Schaltplan Studio

Ein kleiner, eigenständiger Schaltplan-Editor für den Browser, umgesetzt mit HTML, CSS und JavaScript ohne zusätzliche Abhängigkeiten.

## Starten

`index.html` im Browser öffnen. Es ist kein Build-Schritt und kein Server erforderlich.

## Funktionen

- Bauteilbibliothek mit aufklappbaren Gruppen: passive Bauteile, Schaltgeräte, Verbraucher und Anschlüsse
- Widerstände, Schließer, Lampen, Spulen und Klemmen per Klick oder Drag-and-drop platzieren und verschieben
- Anschlüsse im Verbindungsmodus über beliebige Punkte im 4-mm-Raster verbinden
- AKS-Kennzeichen, Beschriftung und Wert per Rechtsklick bearbeiten; Doppelklick für die bisherige Schnellbearbeitung bleibt erhalten
- Elemente auswählen und mit `Entf` löschen
- Projekte als JSON speichern und JSON-Projekte wieder öffnen
- Zeichnung als SVG exportieren
- Zoom mit den Schaltflächen oder `Strg`/`⌘` + Mausrad

## Bedienung

1. Eine Bauteilgruppe aufklappen. Bauteil links anklicken, um es mittig einzufügen, oder auf die gewünschte Stelle des A4-Blatts ziehen. Die Ablageposition rastet auch bei verändertem Zoom im 4-mm-Raster ein.
2. **Verbinden** auswählen: Startanschluss anklicken, dann beliebig viele Rasterpunkte auf dem Blatt wählen und am Zielanschluss abschließen. Die Vorschau zeigt den Linienzug. Direkte Verbindungen ohne Zwischenpunkte sind ebenfalls möglich.
3. Ein platziertes Bauteil rechts anklicken, um Funktion (=), Ort (+), Betriebsmittel (−), Beschriftung und Wert getrennt zu bearbeiten. **Übernehmen** speichert, **Abbrechen** oder `Esc` verwirft die Eingaben.
4. Über **Projekt** speichern oder über **Exportieren** eine SVG-Datei erstellen.

`V` aktiviert die Auswahl, `C` (weiterhin auch `W`) den Verbindungsmodus und `Esc` bricht die aktuelle Aktion ab.

## Umfang

Leitwerk ist ein Prototyp für einfache 2D-Schaltpläne. Es enthält noch keine elektrische Netzprüfung, Stücklisten, Mehrbenutzerbearbeitung oder native Zuken/E³-Datenkompatibilität.

## Routen und Projektdateien

Neue Drähte behalten `id`, `a`, `b` und die vorhandenen Drahtdaten. Optional kommt `points` hinzu: eine geordnete Liste von `{x, y}` in den bisherigen SVG-Blattkoordinaten. Die Endpunkte werden exakt aus den sichtbaren Anschlusspositionen berechnet und nicht separat aufs Raster gerundet. Linien, Drahtbeschriftungen und SVG-Export verwenden dieselbe Route.

Drähte verlaufen rechtwinklig über die gewählten Rasterpunkte; nötige Knicke werden ergänzt. Beim Verschieben eines Bauteils wird die Anschlussstrecke länger oder kürzer. Der benachbarte Knick wird nur quer zur Anschlussstrecke angepasst, sodass die übrigen Leitungsabschnitte stehen bleiben. Falls nötig entstehen zusätzliche Knicke, etwa wenn eine gerade Verbindung seitlich versetzt wird. Alte `anchor`-Felder bestimmen die Bewegung nicht mehr.

Im Auswahlmodus einen **Linienabschnitt direkt anklicken und ziehen**: waagrechte Abschnitte lassen sich nach oben/unten, senkrechte nach links/rechts verschieben. Der Versatz rastet in 4-mm-Schritten ein. Die Anschlüsse bleiben fest verbunden; angrenzende Strecken werden angepasst. Die Drahtbeschriftung lässt sich weiterhin unabhängig verschieben.

Speichern und Öffnen erhält die Routenpunkte. Alte Dateien mit oder ohne `sheets` bleiben lesbar; Drähte ohne `points` behalten ihre automatische rechtwinklige Route. Eine leere `points`-Liste bedeutet eine Verbindung ohne manuell gesetzte Zwischenpunkte; auch sie wird rechtwinklig geführt. Ältere Editorversionen können die zusätzlichen Punkte ignorieren.

## Browser-Smoke-Check

Im Cloud-Checkout sind Node.js, Playwright und Chromium vorhanden. Aus dem Repository starten:

```sh
node tests/browser-smoke.cjs
```

Außerhalb der Cloud muss das Node-Modul `playwright` verfügbar sein. Der Browserpfad kann mit `CHROMIUM_PATH` gesetzt werden (Standard: `/usr/bin/chromium`). Der Check startet einen temporären lokalen HTTP-Server und beendet Browser und Server anschließend. Er prüft Gruppen, Klick- und Drag-Platzierung bei Zoom, Rechtsklick-Bearbeitung, freie Routen, Verschieben beider Enden, JSON-Roundtrip, Altdateien, SVG-Export, Abbruch, Löschen und automatische Gerätelisten. Es gibt keinen Build-Schritt und keine weitere bestehende Testsuite.

## Version 1.2.0 und Tastenkürzel

Die laufende Version steht dauerhaft oben neben **Leitwerk** und im Browser-Titel. Gespeicherte Projekte enthalten zusätzlich `appVersion`; entscheidend für den getesteten Editor ist die Anzeige in der App, nicht die Versionsangabe einer älteren Projektdatei.

| Taste | Funktion |
| --- | --- |
| `C` / `W` | Verbinden; Startanschluss, Rasterpunkte, Zielanschluss wählen |
| `V` | Auswahl |
| `Ctrl/⌘+C` | Ausgewähltes Objekt in die app-interne Zwischenablage kopieren |
| `Ctrl/⌘+X` | Objekt ausschneiden; angeschlossene Drähte werden entfernt |
| `Ctrl/⌘+V` | Kopie bzw. ausgeschnittenes Objekt mit Rasterversatz einfügen |
| `R` | Ausgewähltes Objekt um 90° im Uhrzeigersinn drehen |
| `Y` | Ausgewähltes Objekt vertikal spiegeln (oben/unten) |
| `X` | Ausgewähltes Objekt horizontal spiegeln (links/rechts) |
| `T` | Freien Text eingeben und mittig einfügen; anschließend verschieben |
| `J` | Zum hinterlegten Gegenobjekt springen und es markieren; ohne Verweis Seitenauswahl öffnen |
| `Entf` / `Backspace` | Auswahl löschen, einschließlich angeschlossener Drähte |
| `Esc` | Verbindung oder Bearbeitungsdialog abbrechen |

Drehung und Spiegelung gelten um den Objektmittelpunkt, Spiegelungen entlang der lokalen Objektachsen. Anschlüsse folgen der Transformation; Anschlussstrecken werden rechtwinklig angepasst. Beschriftungen werden getrennt vom Symbol gezeichnet: Sie sind immer von unten oder von rechts lesbar, niemals gespiegelt oder kopfstehend. Transformationen werden als optionale `rotation`, `flipX` und `flipY` am Objekt gespeichert. Alte Objekte ohne diese Felder bleiben unverändert.

**Source-/Destination-Verweise:** Unter **Anschlüsse** gibt es zwei Dreieckspfeile: **Source-Verweis** und **Destination-Verweis**. Im Rechtsklick-Dialog einer Source wird eine Destination als **Gegenziel (Objekt)** gewählt (oder umgekehrt). Beide Gegenverweise werden automatisch gekoppelt. `J` oder ein Klick auf die Verweisbeschriftung springt in beide Richtungen zum Gegenobjekt, zentriert und markiert es. Beim Wechsel des Gegenpartners wird die alte Paarung gelöst. Stabile Blatt-IDs und `targetSheetId`/`targetPartId` erhalten die Zuordnung beim Speichern und Öffnen. Fehlende Ziele werden gemeldet. Alte Verweise auf gewöhnliche Objekte bleiben lesbar.

**Maße und Seitennummern:** Die normale Symbolbreite bzw. der Anschlussabstand beträgt exakt **8 mm** (zwei 4-mm-Rasterabstände). Mittelpunkt und Anschlüsse normaler Bauteile liegen auf dem Raster, auch nach 90°-Drehungen und Spiegelungen. Seiten werden in Navigation, Titelblock, Verweisen und Listen vierstellig dargestellt: **0001, 0002, 0003, …**. Der SVG-Export hat A4-Querformat (297 × 210 mm) und ist unabhängig von Zoom und Verschiebung der Bildschirmansicht.

Textobjekte und Seitenverweispfeile werden nicht als elektrische Geräte in Stückliste oder Geräteverzeichnis aufgenommen. Text lässt sich verschieben und per Rechtsklick oder Doppelklick bearbeiten; seine Ausrichtung bleibt auch bei gedrehten oder gespiegelten Objekten lesbar. Einzelbuchstaben-Tastenkürzel greifen nicht während der Texteingabe, in Dialogen oder zusammen mit Strg/⌘/Alt. Ctrl/⌘+C/X/V bearbeitet dort weiterhin normale Eingabetexte. Objektkopien erhalten neue IDs und elektrische Kennzeichen; ausgeschnittene Objekte behalten beim Einfügen ihre Identität. Kopierte Source-/Destination-Pfeile werden ohne bestehende Paarung eingefügt.
