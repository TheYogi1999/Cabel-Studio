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

### Version 1.8.0: Einzelanschlüsse und lesbare Klemmenlisten

- Der Gerätebaum zeigt kompakte Symbol-/Kennzeichenzeilen ohne kleine Metadatenblöcke. Gelb/hellblau markieren weiterhin unplatzierte/platzierte Geräte; Details stehen im Bearbeitungsdialog (auch per Rechtsklick im Baum).
- Unter jeder Klemme lassen sich reguläre Pins und der Brückenanschluss mit `＋` als eigene Slave-Symbole platzieren. Diese bleiben der Klemme zugeordnet, können aber unabhängig bewegt, auf unplatziert gesetzt und erneut platziert werden. Das Entfernen der Klemme aus der Zeichnung lässt die bereits separat platzierten Pins stehen. Ein separat platzierter Pin wird am Elternsymbol ausgeblendet. Auch der Leistenmaster lässt sich unabhängig von seinen Pin-Slaves platzieren.
- Alle Anschlusspunkte einer Klemme liegen im 4-mm-Abstand auf einer waagerechten Linie: `1a — ◆ — 1b` bzw. `2a — 2b — ◆ — 2c — 2d`. Der braune Punkt in der Mitte ist im Brückenmodus anklickbar.
- Einzelpins werden als `terminal-pin` mit `masterId` und `pinIndex` gespeichert. Bestehende Leitungsenden werden beim Abtrennen auf das neue Pinsymbol übertragen. Verdrahtete Pins werden auf ihrem bisherigen Blatt abgetrennt; unverdrahtete Pins können auf einem anderen Zeichnungsblatt platziert werden. Dauerhaftes Entfernen einer Klemme entfernt auch ihre Pin-Slaves und deren Leitungen.
- Jede Klemmenleiste beginnt auf einer eigenen Klemmenlistenseite; Folgeseiten haben höchstens 16 Pinzeilen. Größere Schrift und Zeilenabstände, knappe Anschlussziele und braune Brückengrafiken verbessern die Lesbarkeit. Ein Pfeil markiert eine Brücke, deren zweites Ende auf einer anderen Listenseite liegt; der Tooltip zeigt die Anschlusskennungen.
- Rechtsklick auf eine Klemmenzeile öffnet den Bearbeitungsdialog, Rechtsklick auf den Listentitel bearbeitet den Leistenmaster. Die Liste aktualisiert sich nach dem Übernehmen; die Darstellung bleibt auch im PDF erhalten.

### Version 1.9.0: Geräte ziehen, Flächenauswahl und Objekttexte

- Gerätezeilen und noch nicht separat platzierte Pin-Anschlüsse lassen sich aus der Geräteübersicht auf ein Zeichnungsblatt ziehen. Der Ablagepunkt rastet auf dem aktuellen Raster ein. Unplatzierte Geräte werden mit derselben ID platziert; bereits platzierte Geräte werden verschoben. Verdrahtete Geräte/Pins bleiben auf ihrem Zeichnungsblatt, damit beim Blattwechsel keine Leitungen verloren gehen. Automatische Listenseiten nehmen keine Geräte auf.
- Größere, kräftige dunkle Schrift verbessert die Lesbarkeit auf gelbem bzw. hellblauem Statushintergrund. Rechtsklick funktioniert auf der gesamten Gerätezeile und auf Pin-Schaltflächen; bei noch nicht separat platzierten Pins öffnet er die Eigenschaften der Klemme.
- Im Auswahlmodus auf einer freien Blattfläche ein Rechteck ziehen: Alle platzierten Objekte, deren Mittelpunkt darin liegt, werden markiert. An einem markierten Objekt ziehen, um die Auswahl gemeinsam zu verschieben. Master/Slave-Überschneidungen werden nur einmal bewegt. Interne Leitungsrouten wandern mit; externe Anschlüsse werden angepasst. Esc oder ein Blattwechsel beendet die Mehrfachauswahl. Mittlere Maustaste verschiebt weiterhin das Blatt.
- In den Objekteigenschaften lassen sich Beschriftung, Wert/Typ, AKS, Pin-Nummern, Seitenverweis und Freitext getrennt ein-/ausblenden. Die Texte bleiben als Daten erhalten. Das Feld `textVisibility` speichert die Sichtbarkeit je Objekt; ausgeblendete Texte bleiben nach dem Wiederöffnen und im PDF ausgeblendet.

### Version 1.9.1: Textschalter am Eingabefeld

Die Checkbox „Anzeigen“ steht direkt neben dem zugehörigen Eingabefeld: Beschriftung/Freitext, Wert, Betriebsmittel (gesamte AKS), Pin-Nummern und Gegenziel (Seitenverweis). Die bisherigen Sichtbarkeitswerte bleiben erhalten; das zusätzliche Sichtbarkeitsfeld am Ende des Dialogs entfällt.

### Version 1.10.0: Einheitliches Betriebsmittel

Für Bauteile gibt es nur noch das Feld „Betriebsmittel“. Zeichnung, Geräteübersicht, Verweisziele und Geräteliste verwenden denselben Wert; die frühere Spalte „Beschriftung“ heißt ebenfalls „Betriebsmittel“. Auch Doppelklick und Kopieren halten den Namen einheitlich. In Projektdateien bleibt `label` als Spiegel von `deviceCode` erhalten; bei vorhandenen unterschiedlichen Werten hat `deviceCode` Vorrang. Freie Textobjekte behalten ihr separates Feld „Text“. Die Sichtbarkeit des Betriebsmittels und der vollständigen AKS lässt sich direkt am Betriebsmittel-Feld einstellen.

### Version 1.11.0: Undo/Redo, Mehrfachbearbeitung und neue Symbole

- `Ctrl/Cmd+Z` macht die letzte Dokumentänderung rückgängig, `Ctrl/Cmd+Y` bzw. `Ctrl/Cmd+Shift+Z` stellt sie wieder her. Eine gesamte Ziehbewegung ist ein Schritt, einschließlich aller beteiligten Leitungen. Bis zu 100 Schritte bleiben während der Sitzung erhalten; neue Änderungen verwerfen den Redo-Verlauf. Eingabefelder behalten ihr natives Text-Undo. Das Öffnen eines Projekts startet einen neuen Verlauf.
- Rechtsklick auf ein markiertes Objekt einer Mehrfachauswahl öffnet die gemeinsame Bearbeitung. Nur ausdrücklich angehakte Felder werden übernommen; Textsichtbarkeit kann gemeinsam auf Ein/Aus gesetzt oder unverändert gelassen werden. Entf/Backspace entfernt alle markierten Geräte aus der Zeichnung und behält sie unplatziert; ausgewählte freie Texte/Verweise werden gelöscht. Angeschlossene Leitungen werden entfernt. Undo stellt die gesamte Aktion wieder her.
- Die Klemmenübersicht ist dichter angeordnet; Klemmenlisten enthalten bis zu 20 Pinzeilen je Seite. Separat platzierte Pins übernehmen automatisch das Betriebsmittel der Leiste, beispielsweise `X1` mit Pin `:1a`, statt eines zusammengesetzten Gerätenamens. Eine Umbenennung der Leiste aktualisiert diese Pins mit.
- Neu in der Bibliothek: Kondensator, Diode, LED, Sicherung, Öffner, Wechsler mit drei Anschlüssen und Motor. Anschlüsse liegen auf dem 4-mm-Raster und unterstützen Verdrahtung, Transformationen, JSON und PDF.
- Symboltexte stehen oberhalb der tatsächlichen Symbolgeometrie in kompakten 9-Punkt-Abständen, auch nach Rotation/Spiegelung. Die Hauptbeschriftungen bleiben waagerecht und ungespiegelt. Sichtbarkeitsschalter bleiben wirksam.

### Version 1.12.0: Relais und automatische Klemmenköpfe

- Die Bibliothek enthält „Relais · 3 Wechsler“. Einfügen oder Ziehen platziert ein Gesamtsymbol mit Spule und drei Wechslern. Dazu entstehen eine separate rechteckige Relais-Spule (A1/A2) und drei Wechsler-Slaves (11/12/14, 21/22/24, 31/32/34), die zunächst unplatziert in der Geräteübersicht stehen. Die Hierarchie lautet Gesamtsymbol → Spule → drei Wechsler.
- Die anklickbaren Verweise am Gesamtsymbol platzieren/öffnen die Teilsymbole; deren Gesamt-Verweis und `J` führen zurück. Auch Platzierung aus der Geräteübersicht funktioniert. Alle Teilsymbole übernehmen BMK, Funktion und Ort des Gesamtsymbols. Die gemeinsame BMK wird am Gesamtsymbol bearbeitet. Gesamtsymbol und Teilsymbole besitzen eigene gespeicherte Leitungsanker mit passenden Pin-Nummern; Verweise entstehen aus der gespeicherten Master/Slave-Zuordnung.
- Haupttexte stehen in der Reihenfolge **AKS → BMK → Typ/Wert** von oben nach unten oberhalb des Symbols. Bei Klemmen wird als Typ der tatsächliche Klemmentyp verwendet; bei separat platzierten Pins der Typ ihrer Klemme.
- Liegt eine platzierte Klemme bzw. ein einzelner Pin genau 4 oder 8 mm unter einer anderen Darstellung desselben Stegs und in derselben Spalte, entfallen die wiederholte AKS und BMK. Der Typ entfällt ebenfalls, wenn er sich gegenüber dem nächstgelegenen passenden Vorgänger nicht ändert. Ein Typwechsel zeigt den neuen Typ erneut. Größere Lücken, andere Spalten und andere Stege beginnen einen neuen Kopf. Verschieben, Unplatzieren und Typänderungen berechnen die Darstellung sofort neu.
- Automatisches Ausblenden verändert keine gespeicherten Textsichtbarkeiten; manuelle Schalter bleiben wirksam. JSON, Undo/Redo und PDF übernehmen die Relaisstruktur und erzeugen dieselbe Klemmenansicht erneut.

### Version 1.13.0: Erhaltene Anschlusspunkte und Blattkoordinaten

- Separat platzierte Klemmenpins blenden am Hauptsymbol weder Anschlusskreise noch Pin-Nummern oder den Brückenanschluss aus. Bereits vorhandene Leitungen behalten ihre bisherigen Anker am Hauptsymbol. Hauptsymbol und Einzelpin können unabhängig verdrahtet und verschoben werden.
- Beide Darstellungen erhalten anklickbare Gegenverweise. Das Hauptsymbol nennt Pin und Ziel, etwa `:1a /0003.A3`; der Einzelpin verweist zurück auf das Hauptsymbol. Einzelpins lassen sich auch auf einem anderen Blatt platzieren, ohne vorhandene Hauptsymbol-Leitungen mitzunehmen. Die Klemmenliste berücksichtigt Verbindungen beider Darstellungen.
- Objektverweise verwenden `/0003.A3`: vierstellige Blattnummer, Punkt, Zeilenbuchstabe A–E und Spaltenzahl 1–8. Die gedruckten Blattzonen entsprechen exakt dieser Berechnung. Pin-, Source/Destination-, Relais-, Geräte- und Klemmenlistenverweise verwenden dieselbe Funktion und aktualisieren sich beim Verschieben oder bei geänderter Blattfolge. Unplatzierte Ziele werden als solche gekennzeichnet.
- Klemmen-Hauptsymbole verwenden ebenfalls den Steg als BMK (`X1` statt `X1.1`). Die Klemmennummer bleibt separat in `terminalNumber`, Pin-Nummern bleiben unverändert.
- Das Relais-Gesamtsymbol steht vertikal: Spule oben, darunter die drei Wechsler. Alle elf Anschlussindizes bleiben stabil und liegen weiterhin auf dem 4-mm-Raster. Die Sprungverweise stehen daneben; Teilsymbole bleiben frei platzierbar.
