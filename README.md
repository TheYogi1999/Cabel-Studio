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
- Gesamtes Projekt als mehrseitiges PDF exportieren
- Zoom mit den Schaltflächen oder `Strg`/`⌘` + Mausrad

## Bedienung

1. Eine Bauteilgruppe aufklappen. Bauteil links anklicken, um es mittig einzufügen, oder auf die gewünschte Stelle des A4-Blatts ziehen. Die Ablageposition rastet auch bei verändertem Zoom im 4-mm-Raster ein.
2. **Verbinden** auswählen: Startanschluss anklicken, dann beliebig viele Rasterpunkte auf dem Blatt wählen und am Zielanschluss abschließen. Die Vorschau zeigt den Linienzug. Direkte Verbindungen ohne Zwischenpunkte sind ebenfalls möglich.
3. Ein platziertes Bauteil rechts anklicken, um Funktion (=), Ort (+), Betriebsmittel (−), Beschriftung und Wert getrennt zu bearbeiten. **Übernehmen** speichert, **Abbrechen** oder `Esc` verwirft die Eingaben.
4. Über **Projekt** als JSON speichern oder über **PDF exportieren** das gesamte Dokument herunterladen.

`V` aktiviert die Auswahl, `C` (weiterhin auch `W`) den Verbindungsmodus und `Esc` bricht die aktuelle Aktion ab.

## Umfang

Leitwerk ist ein Prototyp für einfache 2D-Schaltpläne. Es enthält noch keine elektrische Netzprüfung, Stücklisten, Mehrbenutzerbearbeitung oder native Zuken/E³-Datenkompatibilität.

## Routen und Projektdateien

Neue Drähte behalten `id`, `a`, `b` und die vorhandenen Drahtdaten. Optional kommt `points` hinzu: eine geordnete Liste von `{x, y}` in den bisherigen SVG-Blattkoordinaten. Die Endpunkte werden exakt aus den sichtbaren Anschlusspositionen berechnet und nicht separat aufs Raster gerundet. Linien, Drahtbeschriftungen und PDF-Export verwenden dieselbe Route.

Drähte verlaufen rechtwinklig über die gewählten Rasterpunkte; nötige Knicke werden ergänzt. Beim Verschieben eines Bauteils wird die Anschlussstrecke länger oder kürzer. Der benachbarte Knick wird nur quer zur Anschlussstrecke angepasst, sodass die übrigen Leitungsabschnitte stehen bleiben. Falls nötig entstehen zusätzliche Knicke, etwa wenn eine gerade Verbindung seitlich versetzt wird. Alte `anchor`-Felder bestimmen die Bewegung nicht mehr.

Im Auswahlmodus einen **Linienabschnitt direkt anklicken und ziehen**: waagrechte Abschnitte lassen sich nach oben/unten, senkrechte nach links/rechts verschieben. Der Versatz rastet in 4-mm-Schritten ein. Die Anschlüsse bleiben fest verbunden; angrenzende Strecken werden angepasst. Die Drahtbeschriftung lässt sich weiterhin unabhängig verschieben.

Speichern und Öffnen erhält die Routenpunkte. Alte Dateien mit oder ohne `sheets` bleiben lesbar; Drähte ohne `points` behalten ihre automatische rechtwinklige Route. Eine leere `points`-Liste bedeutet eine Verbindung ohne manuell gesetzte Zwischenpunkte; auch sie wird rechtwinklig geführt. Ältere Editorversionen können die zusätzlichen Punkte ignorieren.

## Browser-Smoke-Check

Im Cloud-Checkout sind Node.js, Playwright und Chromium vorhanden. Aus dem Repository starten:

```sh
node tests/browser-smoke.cjs
```

Außerhalb der Cloud muss das Node-Modul `playwright` verfügbar sein. Der Browserpfad kann mit `CHROMIUM_PATH` gesetzt werden (Standard: `/usr/bin/chromium`). Der Check startet einen temporären lokalen HTTP-Server und beendet Browser und Server anschließend. Er prüft Gruppen, Klick- und Drag-Platzierung bei Zoom, Rechtsklick-Bearbeitung, freie Routen, Verschieben beider Enden, JSON-Roundtrip, Altdateien, PDF-Export, Abbruch, Löschen und automatische Gerätelisten. Es gibt keinen Build-Schritt und keine weitere bestehende Testsuite.

## Version 1.6.0 und Tastenkürzel

Die laufende Version steht dauerhaft oben neben **Leitwerk** und im Browser-Titel. Gespeicherte Projekte enthalten zusätzlich `appVersion`; entscheidend für den getesteten Editor ist die Anzeige in der App, nicht die Versionsangabe einer älteren Projektdatei.

| Taste | Funktion |
| --- | --- |
| `C` / `W` | Verbinden; Startanschluss, Rasterpunkte, Zielanschluss wählen |
| `V` | Auswahl |
| `Page Up` / `Page Down` (Bild ↑/↓) | Vorheriges / nächstes Blatt; am Dokumentanfang und -ende stoppen |
| `Alt` gedrückt halten | Temporär im 2-mm-Raster platzieren und verschieben; sonst 4 mm |
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

**Maße und Seitennummern:** Die normale Symbolbreite bzw. der Anschlussabstand beträgt exakt **8 mm** (zwei 4-mm-Rasterabstände). Mittelpunkt und Anschlüsse normaler Bauteile liegen auf dem Raster, auch nach 90°-Drehungen und Spiegelungen. Seiten werden in Navigation, Titelblock, Verweisen und Listen vierstellig dargestellt: **0001, 0002, 0003, …**. Der PDF-Export hat A4-Querformat (297 × 210 mm) und ist unabhängig von Zoom und Verschiebung der Bildschirmansicht.

Textobjekte und Seitenverweispfeile werden nicht als elektrische Geräte in Stückliste oder Geräteverzeichnis aufgenommen. Text lässt sich verschieben und per Rechtsklick oder Doppelklick bearbeiten; seine Ausrichtung bleibt auch bei gedrehten oder gespiegelten Objekten lesbar. Einzelbuchstaben-Tastenkürzel greifen nicht während der Texteingabe, in Dialogen oder zusammen mit Strg/⌘/Alt. Ctrl/⌘+C/X/V bearbeitet dort weiterhin normale Eingabetexte. Objektkopien erhalten neue IDs und elektrische Kennzeichen; ausgeschnittene Objekte behalten beim Einfügen ihre Identität. Kopierte Source-/Destination-Pfeile werden ohne bestehende Paarung eingefügt.

## Geräte, Artikelnummern und Pins (1.3.0)

Die Bauteilsymbole haben keine sichtbaren Auswahlkästen mehr. Die unsichtbare Trefferfläche bleibt zum Anklicken und Verschieben erhalten. Drahttexte sind kleiner und haben einen weißen Hintergrund ohne Rand; sie lassen sich weiterhin ziehen und per Doppelklick bearbeiten.

Im Rechtsklick-Dialog eines Bauteils lassen sich **Herstellernummer**, **SAP-Nummer** und **Pin-Nummern** eintragen. Die Pin-Nummern werden mit Komma getrennt eingegeben, zum Beispiel `13, 14` oder `:13, :14`, und an den Anschlüssen als `:13` und `:14` angezeigt. Neue Klemmen verwenden Klemmennummer plus Pin-Buchstabe, zum Beispiel `:1a`, `:1b`. Andere Geräte verwenden standardmäßig `:1`, `:2` usw. Bestehende ausdrücklich vergebene Pin-Nummern bleiben erhalten. Die Anschlussreferenzen der Drähte bleiben intern unverändert; die Kabelliste verwendet die angezeigten Pin-Nummern. Artikelnummern sind Textwerte, damit führende Nullen erhalten bleiben.

Die automatische A4-Geräteliste zeigt unter jeder Zeile Hersteller-/SAP-Nummern sowie die Master-/Slave-Zuordnung. Ein Klick auf die Zeile springt zum Symbol. Auch im Dialog **Listen** stehen die Nummern, ein Button **Zum Gerät** und der CSV-Export zur Verfügung.

## AKS-Ordner und Master/Slave

Rechts lässt sich zwischen **Blätter** und **Geräte** umschalten. In der Geräteansicht werden die AKS-Aspekte als Ordner dargestellt; Punkte erzeugen Unterordner. Beispielsweise wird `+TU001.01` zu `+TU001` → `01`. Ein **Ctrl-/⌘-Klick auf ein Gerät** öffnet seine Position im Baum, einschließlich der übergeordneten Ordner. Ein Klick auf den Geräteeintrag springt zum Symbol auf dem zugehörigen Blatt und markiert es.

Im Rechtsklick-Dialog kann unter **Master / übergeordnete Komponente** ein vorhandenes Gerät gewählt werden. Slaves und ihre Unterpositionen stehen im Baum unter ihrem Master. Kreisförmige Zuordnungen sind ausgeschlossen. Beim Verschieben eines Masters folgen seine Slaves auf demselben Blatt; einzelne Slaves können separat verschoben werden. Interne Drähte werden gemeinsam verschoben, externe Anschlussstrecken entsprechend angepasst. Geräte auf anderen Blättern behalten ihre Position. Bei einem gelöschten oder vorübergehend ausgeschnittenen Master bleiben die Slaves erhalten und erscheinen gegebenenfalls als eigene Einträge.

Unter **Anschlüsse → Klemmenleiste erstellen** wird ein eigener Leisten-Master, zum Beispiel **X1**, mit 2 bis 24 Klemmen als Slaves angelegt. Jede Klemme erhält 2 bis 8 Pins. Kennzeichen, Anzahl, Pin-Anzahl, Herstellernummer und SAP-Nummer werden im Dialog festgelegt. Die Hierarchie lautet beispielsweise **X1 → Klemme 1 → 1a, 1b** und **X1 → Klemme 2 → 2a, 2b**. Alle Klemmen und Pins bleiben im Gerätebaum einzeln erreichbar. Die Leiste kann am Master gemeinsam verschoben werden.

Die zusätzlichen optionalen Objektfelder heißen `manufacturerNumber`, `sapNumber`, `pinNumbers`, `masterId` und `assemblyName`. Speichern/Öffnen erhält diese Daten; Projekte ohne diese Felder bleiben lesbar.

## Dokumentation und PDF (1.4.0)

Die Seitenfolge wird automatisch aufgebaut:

1. Titelseite
2. Inhaltsverzeichnis (bei Bedarf mehrere Seiten)
3. Schaltplanblätter
4. Geräteliste
5. Klemmenliste (bei Bedarf mehrere Seiten)

Die Seitenzahlen sind dokumentweit vierstellig; das erste Schaltplanblatt beginnt daher normalerweise bei **0003**. Das Inhaltsverzeichnis ist anklickbar. Alle erzeugten Seiten werden bei Änderungen aus den aktuellen Projektdaten neu aufgebaut und können nicht wie normale Zeichnungsblätter bearbeitet werden. Gespeicherte Dateien enthalten nur ihre Kennungen, keine duplizierten Listeninhalte; beim Öffnen werden die Listen erneut erzeugt. `activeSheetId` erhält die geöffnete Seite auch nach geänderter Seitenfolge. Alte Projektdateien bleiben lesbar.

Über **Projektkopf** lassen sich Projekttitel, Firma, Dokumentnummer, Revision, Bearbeiter, Datum und Beschreibung pflegen. Titelseite und der neue gemeinsame Zeichnungskopf verwenden dieselben Angaben. Der A4-Rahmen enthält Koordinatenzonen; die automatischen Dokumentseiten haben keinen Zeichnungsraster-Hintergrund.

**PDF exportieren** lädt direkt eine PDF-Datei mit allen Seiten herunter, ohne Druckdialog, zusätzliche Bibliothek oder Online-Dienst. Die Bildschirmansicht wird danach wiederhergestellt. Die PDF enthält gerenderte A4-Seitenbilder mit ca. 240 dpi; Text ist darin nicht separat auswählbar. SVG wird nicht mehr als Exportformat angeboten. Der interne SVG-Zeichnungseditor bleibt erhalten.

## Drahttexte, Klemmenpins und Blattverschiebung

Querschnitt/Farbkennzeichen richten sich automatisch nach dem Leitungsabschnitt aus: horizontal auf waagrechten Strecken, vertikal und von rechts lesbar auf senkrechten Strecken. Ihre Ankerposition rastet auf dem 4-mm-Raster entlang des Drahts ein. Alte manuelle Ausrichtungsvorgaben werden dabei nicht mehr angewendet. Die Beschriftung hat einen weißen Hintergrund ohne Rand und lässt sich auf einen anderen Abschnitt ziehen. Auf importierten, nicht rastergenauen oder kürzeren Strecken bleibt sie am Draht, auch wenn dort kein Rasterpunkt liegt.

Klemmen zeigen ihre einzelnen **Pins als Slave-Unterpositionen** im Gerätebaum, zum Beispiel `Pin :1a` und `Pin :1b`. Es sind keine zusätzlichen physischen Bauteile: Die vorhandenen Anschlussreferenzen bleiben unverändert. Ein Klick auf den Pin-Slave springt zur Klemme und markiert den Anschluss. Ctrl-/⌘-Klick direkt auf einen Anschluss öffnet dessen Pin-Unterposition im Gerätebaum. Die Pin-Nummern werden weiterhin im Rechtsklick-Dialog der Klemme bearbeitet.

Die automatische Klemmenliste enthält jeden Klemmenanschluss mit Leiste, Klemmennummer, Pin-Nummer, Verbindungsziel und Blattnummer. Ein Klick auf die Zeile führt zum jeweiligen Pin. Hinzufügen, Löschen, Umnummerieren oder Verdrahten einer Klemme aktualisiert die Liste und ihre Seitenzahl automatisch.

Mit gedrückter **mittlerer Maustaste / Mausrad** lässt sich das Blatt verschieben. Das verändert weder Bauteilkoordinaten noch Verdrahtung oder PDF-Maßstab.

## Klemmen und Brücken (1.5.0)

Eine Klemmenleiste besitzt einen eigenen Master. Beispiel:

- **X1** – Leisten-Master
  - **Klemme 1** – Slave, Pins **1a, 1b** (optional 1c bis 1h)
  - **Klemme 2** – Slave, Pins **2a, 2b** (optional 2c bis 2h)

Die Klemmenliste sortiert nach Leiste und numerischer Klemmennummer und zeigt alle Pins, auch unverdrahtete. In der Geräteübersicht sind sowohl Klemme **1** als auch **1a/1b** und Klemme **2** mit **2a/2b** erreichbar. Über den Rechtsklick-Dialog lassen sich Klemmennummer, Leiste (bei nicht zugeordneten Klemmen) und Pin-Namen ändern. Ein Komma-getrennter Eintrag wie `1a, 1b, 1c, 1d` erzeugt vier echte, separat verdrahtbare Anschlüsse. Zwei bis acht eindeutige Namen sind zulässig. Zusätzliche Pins liegen ebenfalls am Raster; vorhandene Anschlussindizes behalten ihre Position. Bereits verdrahtete Pins können erst nach Entfernen ihrer Verbindungen gelöscht werden.

Ältere automatisch erzeugte Leisten, deren erste Klemme als Master diente, werden beim Öffnen um einen eigenen Leisten-Master ergänzt. Die bisherigen Klemmen-IDs und Drahtreferenzen bleiben erhalten. Alte automatische Pin-Namen `1, 2` werden zu `1a/1b`, `2a/2b` usw.; individuelle Pin-Namen bleiben unverändert. Diese Umstellung wird beim erneuten Speichern mitgesichert.

**Klemmenbrücken:** Den Button **Klemmenbrücke** aktivieren, Startpin und Zielpin derselben Leiste wählen; Zwischenpunkte sind wie bei normalen Leitern möglich. Brücken werden **braun und doppelt so dick** wie die dünnen normalen Leiter gezeichnet und als **Brücke** beschriftet. Der weiße Beschriftungshintergrund hat keinen Rand. Normale Leiter sind ungefähr 0,26 mm, Brücken ungefähr 0,53 mm breit. Die Strichbreite hängt nicht vom Leiterquerschnitt ab.

In **Drahtdaten → Verbindungstyp** lässt sich eine vorhandene Verbindung zwischen Leiter und Klemmenbrücke umstellen. Brücken zu gewöhnlichen Bauteilen oder zwischen verschiedenen Leisten werden abgewiesen. Die Klemmenliste nennt Brücken bei den Verbindungszielen. Route, Verbindungstyp und Darstellung bleiben nach Speichern/Öffnen und im PDF erhalten.

Zusätzlich gespeichert werden der Objekttyp `terminal-strip`, die optionalen Felder `terminalNumber` und `stripName` sowie `kind: "bridge"` an Brücken. Gewöhnliche Drähte ohne `kind` bleiben normale Leiter. Die Zuordnung der Pins erfolgt weiterhin über die vorhandenen Anschlussindizes.

## Navigation, Raster und gemischte Klemmentypen (1.6.0)

**Page Up / Page Down** wechseln durch die gesamte Dokumentfolge einschließlich Titelseite, Inhaltsverzeichnis und Listen. Am ersten und letzten Blatt wird gestoppt. Während der Texteingabe und in Dialogen bleiben die Tasten für die Eingabe bzw. das Scrollen verfügbar.

Das Zeichnungsraster hat deutlichere Punkte und feine Rasterlinien. Der Button **Raster ein/aus** neben den Zoomtasten blendet es aus oder ein. Das Ausblenden schaltet die Einrastfunktion nicht ab. Mit gedrückter **Alt-Taste** werden Rasterdarstellung und Einrasten vorübergehend auf **2 mm** umgestellt. Das gilt für Bauteilpositionen, Drahtpunkte, verschobene Leitungsabschnitte und Leiterbeschriftungen. Beim Loslassen oder Fokusverlust gelten wieder 4 mm; bereits platzierte Objekte werden dabei nicht verschoben. In Eingabefeldern und Dialogen aktiviert Alt keine Rasterumschaltung. Rasteranzeige und Alt-Zustand sind Ansichtseinstellungen und werden nicht in Projektdateien gespeichert.

Auf den A4-Gerätelisten stehen jetzt **Herstellernummer** und **SAP-Nummer** in eigenen Spalten direkt hinter **Wert / Typ**. Die Werte erscheinen auch im PDF und behalten führende Nullen. Master-/Slave-Angaben stehen weiterhin als Zusatzzeile unter dem Gerät.

Eine Klemmenleiste darf unterschiedliche **Klemmentypen** enthalten, etwa Durchgangs-, PE-, Trenn- oder Sicherungsklemmen. Im Dialog **Klemmenleiste erstellen** wird ein Vorgabetyp gewählt; anschließend lässt er sich per Rechtsklick für jede einzelne Klemme ändern. Pin-Anzahl, Pin-Namen, Hersteller- und SAP-Nummer bleiben je Klemme unabhängig. Der Typ wird im optionalen Feld `terminalType` gespeichert und in Gerätebaum, Geräteliste, Klemmenliste und CSV angezeigt. Die Stückliste trennt unterschiedliche Typen bzw. Artikelnummern. Ältere Klemmen ohne dieses Feld bleiben lesbar und verwenden ihren bisherigen Wert bzw. die Bezeichnung „Klemme“.

### Version 1.7.0: Platzierung und Klemmenpflege

- Entf entfernt Geräte nur aus der Zeichnung und löscht deren angeschlossene Leitungen. Gerätedaten und Master/Slave-Zuordnungen bleiben gespeichert. Texte und Seitenverweise werden weiterhin gelöscht.
- Die Geräteübersicht zeigt unplatzierte Geräte gelb und platzierte hellblau. Ein Klick auf ein unplatziertes Gerät platziert es in der Mitte des aktuellen Zeichnungsblatts (aus einer Listenseite auf dem letzten Zeichnungsblatt). Danach kann es verschoben werden. Slaves lassen sich einzeln platzieren und bewegen; das Verschieben eines Masters nimmt seine platzierten Slaves desselben Blatts mit.
- „+ Klemme“ am Leistenmaster ergänzt die nächste freie Klemmennummer als unplatziertes Gerät. Typ, Pinanzahl und Bestellnummern werden von der letzten Klemme übernommen und bleiben bearbeitbar. „Klemme entfernen“ löscht eine Klemme nach Bestätigung dauerhaft einschließlich ihrer Verbindungen.
- Jede Klemme hat einen separaten braunen Brückenanschluss oberhalb des Symbols. Neue Brücken können dort angeschlossen werden; vorhandene Brücken an normalen Pins bleiben kompatibel. Die Anschlusskennung `:8` ist für den Brückenanschluss reserviert und bleibt bei Änderungen der Pinanzahl stabil.
- Symbolbeschriftungen sind kleiner und blau, auch im PDF. Das optionale JSON-Feld `unplaced: true` erhält den Platzierungsstatus beim Wiederöffnen; alte Projekte gelten weiterhin als platziert.
