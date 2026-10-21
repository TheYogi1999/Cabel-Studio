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

Beim Verschieben des Startbauteils folgt ausschließlich der erste Zwischenpunkt um denselben Betrag; beim Verschieben des Zielbauteils ausschließlich der letzte. Alle übrigen Zwischenpunkte bleiben stehen. Bei nur einem Zwischenpunkt folgt dieser jedem der beiden angeschlossenen Bauteile. Alte `anchor`-Felder bleiben lesbar, bestimmen die Bewegung aber nicht mehr.

Speichern und Öffnen erhält die Routenpunkte. Alte Dateien mit oder ohne `sheets` bleiben lesbar; Drähte ohne `points` behalten ihre automatische rechtwinklige Route. Eine leere `points`-Liste bedeutet eine direkte Verbindung. Ältere Editorversionen können die zusätzlichen Punkte ignorieren.

## Browser-Smoke-Check

Im Cloud-Checkout sind Node.js, Playwright und Chromium vorhanden. Aus dem Repository starten:

```sh
node tests/browser-smoke.cjs
```

Außerhalb der Cloud muss das Node-Modul `playwright` verfügbar sein. Der Browserpfad kann mit `CHROMIUM_PATH` gesetzt werden (Standard: `/usr/bin/chromium`). Der Check startet einen temporären lokalen HTTP-Server und beendet Browser und Server anschließend. Er prüft Gruppen, Klick- und Drag-Platzierung bei Zoom, Rechtsklick-Bearbeitung, freie Routen, Verschieben beider Enden, JSON-Roundtrip, Altdateien, SVG-Export, Abbruch, Löschen und automatische Gerätelisten. Es gibt keinen Build-Schritt und keine weitere bestehende Testsuite.

## Version 1.1.0 und Tastenkürzel

Die laufende Version steht dauerhaft oben neben **Leitwerk** und im Browser-Titel. Gespeicherte Projekte enthalten zusätzlich `appVersion`; entscheidend für den getesteten Editor ist die Anzeige in der App, nicht die Versionsangabe einer älteren Projektdatei.

| Taste | Funktion |
| --- | --- |
| `C` / `W` | Verbinden; Startanschluss, Rasterpunkte, Zielanschluss wählen |
| `V` | Auswahl |
| `R` | Ausgewähltes Objekt um 90° im Uhrzeigersinn drehen |
| `Y` | Ausgewähltes Objekt vertikal spiegeln (oben/unten) |
| `X` | Ausgewähltes Objekt horizontal spiegeln (links/rechts) |
| `T` | Freien Text eingeben und mittig einfügen; anschließend verschieben |
| `J` | Zum hinterlegten Gegenobjekt springen und es markieren; ohne Verweis Seitenauswahl öffnen |
| `Entf` / `Backspace` | Auswahl löschen, einschließlich angeschlossener Drähte |
| `Esc` | Verbindung oder Bearbeitungsdialog abbrechen |

Drehung und Spiegelung gelten um den Objektmittelpunkt, Spiegelungen entlang der lokalen Objektachsen. Anschlüsse und der jeweils benachbarte Drahtknick folgen der Transformation; übrige Routenpunkte bleiben stehen. Transformationen werden als optionale `rotation`, `flipX` und `flipY` am Objekt gespeichert. Alte Objekte ohne diese Felder bleiben unverändert.

**Seitenverweise:** Unter **Anschlüsse** das dreieckige Objekt **Seitenverweis** einfügen. Per Rechtsklick im Feld **Gegenziel (Objekt)** das Ziel auf einem beliebigen Schaltplanblatt auswählen. Beim ausgewählten Verweis springt `J` zum Zielobjekt, zentriert und markiert es. Alternativ die Verweisbeschriftung unter dem Objekt anklicken. Das Ziel darf selbst ein Seitenverweis sein; für einen Rücksprung dort den entsprechenden Gegenverweis festlegen. Stabile Blatt-IDs und `targetSheetId`/`targetPartId` erhalten die Zuordnung beim Speichern und Öffnen. Fehlende Ziele werden gemeldet.

Textobjekte und Seitenverweispfeile werden nicht als elektrische Geräte in Stückliste oder Geräteverzeichnis aufgenommen. Text lässt sich wie ein Bauteil verschieben, drehen, spiegeln und per Rechtsklick oder Doppelklick bearbeiten. Die Tastenkürzel greifen nicht während der Texteingabe, in Dialogen oder zusammen mit Strg/⌘/Alt.
