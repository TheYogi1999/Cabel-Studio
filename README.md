# Leitwerk – Schaltplan Studio

Ein kleiner, eigenständiger Schaltplan-Editor für den Browser, umgesetzt mit HTML, CSS und JavaScript ohne zusätzliche Abhängigkeiten.

## Starten

`index.html` im Browser öffnen. Es ist kein Build-Schritt und kein Server erforderlich.

## Funktionen

- Widerstände, Schließer, Lampen, Spulen und Klemmen platzieren und verschieben
- Anschlüsse im Verbindungsmodus verbinden
- Bauteilkennzeichen und Werte per Doppelklick ändern
- Elemente auswählen und mit `Entf` löschen
- Projekte als JSON speichern und JSON-Projekte wieder öffnen
- Zeichnung als SVG exportieren
- Zoom mit den Schaltflächen oder `Strg`/`⌘` + Mausrad

## Bedienung

1. Bauteil links anklicken, um es in der Mitte des Blatts einzufügen.
2. **Verbinden** auswählen und zwei grüne Anschlusspunkte anklicken.
3. Ein Bauteil doppelt anklicken, um Kennzeichen oder Wert zu ändern.
4. Über **Projekt** speichern oder über **Exportieren** eine SVG-Datei erstellen.

`V` aktiviert die Auswahl, `W` den Verbindungsmodus und `Esc` bricht die aktuelle Aktion ab.

## Umfang

Leitwerk ist ein Prototyp für einfache 2D-Schaltpläne. Es enthält noch keine elektrische Netzprüfung, Stücklisten, Mehrbenutzerbearbeitung oder native Zuken/E³-Datenkompatibilität.
