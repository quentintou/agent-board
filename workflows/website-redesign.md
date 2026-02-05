# Workflow: Refonte Site Web

Template de pipeline pour les projets de refonte site web via Agency.

## Etapes

### 1. Brief & Analyse (Agency)
- Recevoir le brief client
- Analyser le site existant (audit SEO, technique, contenu)
- Definir le perimetre et les priorites

### 2. Audit SEO (→ Research Agent)
- Audit technique (vitesse, mobile, indexation)
- Analyse mots-cles et positions actuelles
- Benchmark concurrence
- Recommandations priorisees
- **nextTask →** Etape 3

### 3. Architecture & Contenu (Agency + Content Creator)
- Arborescence du site
- Wireframes / structure des pages
- Redaction contenu SEO (→ Content Creator)
- **nextTask →** Etape 4

### 4. Dev & Integration (→ Coding Agent)
- Choix techno (Astro, HTML statique, etc.)
- Build des pages
- Integration SEO (schema, meta, sitemap)
- **nextTask →** Etape 5

### 5. Deploy Staging (→ Coding Agent)
- Deploy sur domaine de preview (ex: preview.getsmartkits.com)
- Config Nginx, SSL
- Tests (toutes pages 200, mobile, vitesse)
- **NE PAS deployer en prod sans validation client**

### 6. Validation Client (Agency)
- Presenter le staging au client
- Recueillir les retours
- Iterer si necessaire

### 7. Deploy Prod (→ Coding Agent)
- Pointer le domaine DNS
- SSL prod (Certbot)
- Monitoring post-deploy
- Redirection anciennes URLs si besoin

## Regles
- **Jamais de deploy prod sans validation staging**
- Chaque etape = une task sur le board avec nextTask
- Agency supervise et valide chaque etape
- Le client ne voit que le staging, jamais le board interne
