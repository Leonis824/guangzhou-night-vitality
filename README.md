# Guangzhou Night Vitality Design Lab

A responsive, static research dashboard for exploring nighttime vitality and
precomputed urban-design scenarios across four Guangzhou study areas.

## Public Website

After GitHub Pages deployment:

```text
https://leonis824.github.io/guangzhou-night-vitality/
```

## Decision Tasks

- **Building Conversion**: predicts the receiving grid after one inferred
  building-use conversion.
- **Grid Intervention**: predicts one selected 100 m grid after an intervention
  package.
- **Location Suitability**: evaluates candidate sites independently for site
  selection.

All outputs are associational model predictions. They do not represent causal
effects or spatial spillover.

## Technology

- Static HTML, CSS, and JavaScript
- MapLibre GL JS
- Plotly.js
- GitHub Pages
- Precomputed public research data in `data/`

No backend server, database, Firebase project, or API key is required.
