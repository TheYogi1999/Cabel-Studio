# Leitwerk – Schaltplan Studio

Ein kleiner, eigenständiger Schaltplan-Editor für den Browser, umgesetzt mit HTML, CSS und JavaScript ohne zusätzliche Abhängigkeiten.

## Starten

`index.html` im Browser öffnen. Es ist kein Build-Schritt und kein Server erforderlich.

## Funktionen

- Bauteilbibliothek mit aufklappbaren Ordnern nach Bauteilgruppe
- Widerstände, Schließer, Lampen, Spulen und Klemmen per Drag-and-drop platzieren und verschieben
- Anschlüsse über frei gesetzte Rasterpunkte verbinden; die Punkte folgen angeschlossenen Bauteilen beim Verschieben
- AKS-Kennzeichen, Beschriftung und Wert per Rechtsklick oder Doppelklick im Dialog ändern
- Elemente auswählen und mit `Entf` löschen
- Projekte als JSON speichern und JSON-Projekte wieder öffnen
- Zeichnung als SVG exportieren
- Zoom mit den Schaltflächen oder `Strg`/`⌘` + Mausrad

## Bedienung

1. Links einen Gruppenordner öffnen und ein Bauteil auf das Blatt ziehen. Ein Klick fügt es in der Blattmitte ein.
2. **Verbinden** auswählen, den grünen Startanschluss anklicken, beliebige Rasterpunkte setzen und am Zielanschluss abschließen. `Rücktaste` entfernt den letzten gesetzten Punkt, `Esc` bricht ab. Ohne Zwischenpunkte entsteht eine direkte Verbindung.
3. In **Auswahl** Bauteile verschieben. Zwischenpunkte bewegen sich anteilig mit beiden angeschlossenen Bauteilen; näher am Start liegende Punkte folgen stärker dem Startbauteil. Ausgewählte Verbindungen zeigen verschiebbare Punktgriffe.
4. Rechtsklick oder Doppelklick auf ein Bauteil öffnet den Dialog für Funktion, Einbauort, Betriebsmittel, freie Beschriftung und Wert. **Übernehmen** aktualisiert auch die Gerätelisten; **Abbrechen** verwirft die Eingaben.
5. Über **Projekt** alle Blätter einschließlich Verbindungspunkten speichern oder über **Exportieren** das aktuelle Blatt als SVG exportieren. Ältere Projektdateien ohne Zwischenpunkte bleiben lesbar.

`V` aktiviert die Auswahl, `W` den Verbindungsmodus und `Esc` bricht die aktuelle Aktion ab.

## Umfang

Leitwerk ist ein Prototyp für einfache 2D-Schaltpläne. Es enthält noch keine elektrische Netzprüfung, Stücklisten, Mehrbenutzerbearbeitung oder native Zuken/E³-Datenkompatibilität.
